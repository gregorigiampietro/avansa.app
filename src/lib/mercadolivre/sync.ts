import { createAdminClient } from "@/lib/supabase/admin";
import { getAllItemIds, getItems } from "./api";
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

    // Map ML items to product rows for upsert
    const now = new Date().toISOString();
    const productRows: ProductInsert[] = items.map((item: MlItem) => ({
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
      last_synced_at: now,
    }));

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
