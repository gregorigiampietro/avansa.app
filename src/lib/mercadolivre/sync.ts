import { createAdminClient } from "@/lib/supabase/admin";
import { getAllItemIds, getItems, getListingPrices, getShippingOptions } from "./api";
import { calculateMargin } from "@/lib/utils/calculations";
import type { MlItem } from "./types";
import type { Database } from "@/types/database";

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];

export interface SyncResult {
  syncLogId: string;
  itemsSynced: number;
  status: "completed" | "error";
  errorMessage?: string;
}

/**
 * Full sync of all products for a Mercado Livre account.
 *
 * 1. Creates a sync_log entry with status "running"
 * 2. Fetches all item IDs from ML API
 * 3. Fetches full item details in batches of 20
 * 4. Upserts each item into the products table
 * 5. Updates the sync_log with the final status
 */
export async function syncProducts(
  accountId: string,
  mlUserId: number
): Promise<SyncResult> {
  const supabase = createAdminClient();

  // Create sync log entry
  const { data: syncLog, error: syncLogError } = await supabase
    .from("sync_logs")
    .insert({
      ml_account_id: accountId,
      sync_type: "products",
      status: "running",
      items_synced: 0,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (syncLogError || !syncLog) {
    throw new Error(
      `Erro ao criar registro de sync: ${syncLogError?.message ?? "desconhecido"}`
    );
  }

  const syncLogId = syncLog.id;

  try {
    // Fetch all item IDs from ML
    const itemIds = await getAllItemIds(accountId, mlUserId);

    // Fetch full item details (already batched in groups of 20 inside getItems)
    const items = await getItems(accountId, itemIds);

    // Fetch ML fees (deduplicated by price|listing_type|category)
    const feeCache = new Map<string, number>();
    for (const item of items) {
      const key = `${item.price}|${item.listing_type_id}|${item.category_id}`;
      if (!feeCache.has(key)) {
        try {
          const priceData = await getListingPrices(
            accountId,
            item.price,
            item.listing_type_id,
            item.category_id
          );
          feeCache.set(key, priceData.sale_fee_amount ?? 0);
        } catch {
          feeCache.set(key, 0);
        }
      }
    }

    // Fetch shipping costs (batched with concurrency limit)
    const shippingCostMap = new Map<string, number>();
    const SHIPPING_BATCH_SIZE = 5;
    for (let i = 0; i < items.length; i += SHIPPING_BATCH_SIZE) {
      const batch = items.slice(i, i + SHIPPING_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((item) => getShippingOptions(accountId, item.id))
      );
      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled" && result.value.options?.length > 0) {
          const standardOption =
            result.value.options.find((o) => o.shipping_method_type === "standard") ??
            result.value.options[0];
          shippingCostMap.set(batch[j].id, standardOption.list_cost);
        } else {
          shippingCostMap.set(batch[j].id, 0);
        }
      }
      // Small delay between batches to avoid rate limits
      if (i + SHIPPING_BATCH_SIZE < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Fetch existing cost data to preserve user-entered costs and recalculate margins
    const existingItemIds = items.map((item) => item.id);
    const { data: existingProducts } = await supabase
      .from("products")
      .select("ml_item_id, cost_price, packaging_cost, other_costs")
      .eq("ml_account_id", accountId)
      .in("ml_item_id", existingItemIds);

    const existingCostsMap = new Map(
      (existingProducts ?? []).map((p) => [p.ml_item_id, p])
    );

    // Map ML items to product rows for upsert
    const now = new Date().toISOString();
    const productRows: ProductInsert[] = items.map((item: MlItem) => {
      const feeKey = `${item.price}|${item.listing_type_id}|${item.category_id}`;
      const mlFee = feeCache.get(feeKey) ?? 0;
      const shippingCost = shippingCostMap.get(item.id) ?? 0;

      // Preserve existing user-entered costs for margin recalculation
      const existing = existingCostsMap.get(item.id);
      const costPrice = existing?.cost_price ?? 0;
      const packagingCost = existing?.packaging_cost ?? 0;
      const otherCosts = existing?.other_costs ?? 0;

      const { net_margin, margin_percent } = calculateMargin({
        price: item.price,
        cost_price: costPrice,
        packaging_cost: packagingCost,
        other_costs: otherCosts,
        ml_fee: mlFee,
        shipping_cost: shippingCost,
      });

      return {
        ml_account_id: accountId,
        ml_item_id: item.id,
        title: item.title,
        thumbnail: item.thumbnail,
        category_id: item.category_id,
        status: item.status,
        listing_type: item.listing_type_id,
        price: item.price,
        available_quantity: item.available_quantity,
        sold_quantity: item.sold_quantity,
        permalink: item.permalink,
        sku: item.seller_sku ?? null,
        condition: item.condition,
        ml_fee: mlFee,
        shipping_cost: shippingCost,
        net_margin: net_margin,
        margin_percent: margin_percent,
        last_synced_at: now,
      };
    });

    // Upsert in batches to avoid overly large payloads
    const UPSERT_BATCH_SIZE = 100;
    for (let i = 0; i < productRows.length; i += UPSERT_BATCH_SIZE) {
      const batch = productRows.slice(i, i + UPSERT_BATCH_SIZE);

      const { error: upsertError } = await supabase
        .from("products")
        .upsert(batch, {
          onConflict: "ml_account_id,ml_item_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        throw new Error(
          `Erro ao salvar produtos (batch ${i}): ${upsertError.message}`
        );
      }
    }

    // Mark sync as completed
    await supabase
      .from("sync_logs")
      .update({
        status: "completed",
        items_synced: items.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLogId);

    return {
      syncLogId,
      itemsSynced: items.length,
      status: "completed",
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Erro desconhecido durante o sync";

    // Mark sync as failed
    await supabase
      .from("sync_logs")
      .update({
        status: "error",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLogId);

    return {
      syncLogId,
      itemsSynced: 0,
      status: "error",
      errorMessage,
    };
  }
}
