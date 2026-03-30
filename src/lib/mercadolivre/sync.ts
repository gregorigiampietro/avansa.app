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

export interface SyncProductsOptions {
  incremental?: boolean;
}

/** Existing product data used for incremental comparison */
interface ExistingProduct {
  ml_item_id: string;
  price: number | null;
  listing_type: string | null;
  category_id: string | null;
  ml_fee: number | null;
  shipping_cost: number | null;
  net_margin: number | null;
  margin_percent: number | null;
  cost_price: number | null;
  packaging_cost: number | null;
  other_costs: number | null;
  tax_percent: number | null;
}

/**
 * Sync products for a Mercado Livre account.
 *
 * When `options.incremental` is true, skips fee/shipping API calls for items
 * whose price, listing type, and category have not changed since last sync.
 * Also skips the deletion step (only full sync removes stale products).
 *
 * 1. Creates a sync_log entry with status "running"
 * 2. Fetches all item IDs from ML API
 * 3. Fetches full item details in batches of 20
 * 4. Upserts each item into the products table
 * 5. Updates the sync_log with the final status
 */
export async function syncProducts(
  accountId: string,
  mlUserId: number,
  options?: SyncProductsOptions
): Promise<SyncResult> {
  const incremental = options?.incremental ?? false;
  const supabase = createAdminClient();

  // Create sync log entry
  const { data: syncLog, error: syncLogError } = await supabase
    .from("sync_logs")
    .insert({
      ml_account_id: accountId,
      sync_type: incremental ? "products_incremental" : "products",
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

    // Load existing products for cost preservation and incremental comparison
    const existingItemIds = items.map((item) => item.id);
    const { data: existingProducts } = await supabase
      .from("products")
      .select(
        "ml_item_id, price, listing_type, category_id, ml_fee, shipping_cost, net_margin, margin_percent, cost_price, packaging_cost, other_costs, tax_percent"
      )
      .eq("ml_account_id", accountId)
      .in("ml_item_id", existingItemIds);

    const existingMap = new Map<string, ExistingProduct>(
      (existingProducts ?? []).map((p) => [p.ml_item_id, p as ExistingProduct])
    );

    // Determine which items need fee/shipping recalculation
    // In incremental mode, skip items where price/listing/category are unchanged
    const itemsNeedingFees: MlItem[] = [];
    const itemsReusing: Map<string, ExistingProduct> = new Map();

    for (const item of items) {
      const existing = existingMap.get(item.id);
      if (
        incremental &&
        existing &&
        existing.price === item.price &&
        existing.listing_type === item.listing_type_id &&
        existing.category_id === item.category_id &&
        existing.ml_fee != null &&
        existing.shipping_cost != null
      ) {
        // Price/listing/category unchanged — reuse existing fee/shipping/margin
        itemsReusing.set(item.id, existing);
      } else {
        itemsNeedingFees.push(item);
      }
    }

    // Fetch ML fees (deduplicated by price|listing_type|category) — only for changed items
    const feeCache = new Map<string, number>();
    for (const item of itemsNeedingFees) {
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

    // Fetch shipping costs (batched with concurrency limit) — only for changed items
    const shippingCostMap = new Map<string, number>();
    const SHIPPING_BATCH_SIZE = 5;
    for (let i = 0; i < itemsNeedingFees.length; i += SHIPPING_BATCH_SIZE) {
      const batch = itemsNeedingFees.slice(i, i + SHIPPING_BATCH_SIZE);
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
      if (i + SHIPPING_BATCH_SIZE < itemsNeedingFees.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Map ML items to product rows for upsert
    const now = new Date().toISOString();
    const productRows: ProductInsert[] = items.map((item: MlItem) => {
      // Check if this item can reuse existing fee/shipping/margin values
      const reused = itemsReusing.get(item.id);
      const existing = existingMap.get(item.id);

      let mlFee: number;
      let shippingCost: number;
      let netMargin: number;
      let marginPercent: number;

      if (reused) {
        // Reuse existing values — price/listing/category unchanged
        mlFee = reused.ml_fee ?? 0;
        shippingCost = reused.shipping_cost ?? 0;
        netMargin = reused.net_margin ?? 0;
        marginPercent = reused.margin_percent ?? 0;
      } else {
        // Fetch fresh values for changed/new items
        const feeKey = `${item.price}|${item.listing_type_id}|${item.category_id}`;
        mlFee = feeCache.get(feeKey) ?? 0;
        shippingCost = shippingCostMap.get(item.id) ?? 0;

        const costPrice = existing?.cost_price ?? 0;
        const packagingCost = existing?.packaging_cost ?? 0;
        const otherCosts = existing?.other_costs ?? 0;
        const taxPercent = existing?.tax_percent ?? 0;

        const margin = calculateMargin({
          price: item.price,
          cost_price: costPrice,
          packaging_cost: packagingCost,
          other_costs: otherCosts,
          ml_fee: mlFee,
          shipping_cost: shippingCost,
          tax_percent: taxPercent,
        });
        netMargin = margin.net_margin;
        marginPercent = margin.margin_percent;
      }

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
        net_margin: netMargin,
        margin_percent: marginPercent,
        catalog_product_id: item.catalog_product_id ?? null,
        catalog_listing: item.catalog_listing ?? false,
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

    // Remove products that no longer exist in ML (closed/deleted)
    // Only on full sync — incremental sync should not delete stale products
    // CASCADE on inventory_status.product_id will clean up inventory too
    if (!incremental) {
      const syncedItemIds = items.map((item) => item.id);
      if (syncedItemIds.length > 0) {
        await supabase
          .from("products")
          .delete()
          .eq("ml_account_id", accountId)
          .not("ml_item_id", "in", `(${syncedItemIds.join(",")})`);
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
