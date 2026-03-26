import { createAdminClient } from "@/lib/supabase/admin";
import { mlGet } from "./api";
import type { MlFulfillmentStockResponse, MlInventoryStatusResponse } from "./types";
import type { Database, Json } from "@/types/database";

type InventoryInsert = Database["public"]["Tables"]["inventory_status"]["Insert"];

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 200;

export interface InventorySyncResult {
  syncLogId: string;
  itemsSynced: number;
  status: "completed" | "error";
  errorMessage?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Map from ML detailed status to our column names */
const STATUS_COLUMN_MAP: Record<string, string> = {
  damaged: "damaged",
  not_supported: "not_apt_for_sale",
  lost: "lost",
  withdrawal: "not_apt_for_sale",
  no_fiscal_coverage: "not_apt_for_sale",
  internal_process: "not_apt_for_sale",
  transfer: "in_transfer",
};

/**
 * Fetch detailed fulfillment stock with subconditions.
 * Uses /inventories/{id}/stock/fulfillment?include_attributes=conditions
 * Falls back to basic /inventory/status if the detailed endpoint fails.
 */
async function fetchItemInventory(
  accountId: string,
  itemId: string,
  inventoryId: string | null
): Promise<{
  available: number;
  damaged: number;
  expired: number;
  lost: number;
  in_transfer: number;
  reserved: number;
  not_apt_for_sale: number;
  conditionDetails: Json;
} | null> {
  // Try detailed endpoint first if we have an inventory_id
  if (inventoryId) {
    try {
      const data = await mlGet<MlFulfillmentStockResponse>(
        accountId,
        `/inventories/${inventoryId}/stock/fulfillment?include_attributes=conditions`
      );

      // Map detailed statuses to our columns
      const columns = {
        available: data.available_quantity,
        damaged: 0,
        expired: 0,
        lost: 0,
        in_transfer: 0,
        reserved: 0,
        not_apt_for_sale: 0,
      };

      for (const detail of data.not_available_detail) {
        const col = STATUS_COLUMN_MAP[detail.status];
        if (col && col in columns) {
          columns[col as keyof typeof columns] += detail.quantity;
        }
      }

      return {
        ...columns,
        conditionDetails: data.not_available_detail as unknown as Json,
      };
    } catch {
      // Fall through to basic endpoint
    }
  }

  // Fallback: basic inventory status
  try {
    const data = await mlGet<MlInventoryStatusResponse>(
      accountId,
      `/inventory/status?item_id=${itemId}`
    );

    const detail = data.result.not_available_detail;
    const getQty = (status: string) =>
      detail.find((d) => d.status === status)?.quantity ?? 0;

    return {
      available: data.result.available_quantity,
      damaged: getQty("damaged"),
      expired: getQty("expired"),
      lost: getQty("lost"),
      in_transfer: getQty("in_transfer"),
      reserved: getQty("reserved"),
      not_apt_for_sale: getQty("not_apt_for_sale"),
      conditionDetails: detail as unknown as Json,
    };
  } catch {
    return null;
  }
}

/**
 * Sync inventory status for all products in an ML account.
 * Tries detailed fulfillment endpoint first (with subconditions),
 * falls back to basic endpoint, or uses available_quantity from products.
 */
export async function syncInventoryStatus(
  accountId: string
): Promise<InventorySyncResult> {
  const supabase = createAdminClient();

  // Create sync log
  const { data: syncLog, error: syncLogError } = await supabase
    .from("sync_logs")
    .insert({
      ml_account_id: accountId,
      sync_type: "inventory",
      status: "running",
      items_synced: 0,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (syncLogError || !syncLog) {
    throw new Error(
      `Erro ao criar registro de sync de estoque: ${syncLogError?.message ?? "desconhecido"}`
    );
  }

  const syncLogId = syncLog.id;

  try {
    // Fetch all products for this account (including inventory_id if available)
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, ml_item_id, available_quantity")
      .eq("ml_account_id", accountId);

    if (productsError) {
      throw new Error(`Erro ao buscar produtos: ${productsError.message}`);
    }

    if (!products || products.length === 0) {
      await supabase
        .from("sync_logs")
        .update({
          status: "completed",
          items_synced: 0,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLogId);

      return { syncLogId, itemsSynced: 0, status: "completed" };
    }

    const now = new Date().toISOString();
    const inventoryRows: InventoryInsert[] = [];

    // Process in batches to respect rate limits
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map((product) =>
          fetchItemInventory(accountId, product.ml_item_id, null)
        )
      );

      for (let j = 0; j < batch.length; j++) {
        const product = batch[j];
        const inventoryData = results[j];

        if (inventoryData) {
          inventoryRows.push({
            product_id: product.id,
            ml_account_id: accountId,
            ml_item_id: product.ml_item_id,
            available: inventoryData.available,
            damaged: inventoryData.damaged,
            expired: inventoryData.expired,
            lost: inventoryData.lost,
            in_transfer: inventoryData.in_transfer,
            reserved: inventoryData.reserved,
            not_apt_for_sale: inventoryData.not_apt_for_sale,
            condition_details: inventoryData.conditionDetails,
            last_synced_at: now,
          });
        } else {
          // Item not in fulfillment — use basic available_quantity
          inventoryRows.push({
            product_id: product.id,
            ml_account_id: accountId,
            ml_item_id: product.ml_item_id,
            available: product.available_quantity ?? 0,
            damaged: 0,
            expired: 0,
            lost: 0,
            in_transfer: 0,
            reserved: 0,
            not_apt_for_sale: 0,
            condition_details: [],
            last_synced_at: now,
          });
        }
      }

      // Delay between batches to avoid rate limits
      if (i + BATCH_SIZE < products.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    // Upsert inventory data
    const UPSERT_BATCH_SIZE = 100;
    for (let i = 0; i < inventoryRows.length; i += UPSERT_BATCH_SIZE) {
      const batch = inventoryRows.slice(i, i + UPSERT_BATCH_SIZE);

      const { error: upsertError } = await supabase
        .from("inventory_status")
        .upsert(batch, {
          onConflict: "product_id,ml_account_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        throw new Error(
          `Erro ao salvar estoque (batch ${i}): ${upsertError.message}`
        );
      }
    }

    // Mark sync as completed
    await supabase
      .from("sync_logs")
      .update({
        status: "completed",
        items_synced: inventoryRows.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLogId);

    return {
      syncLogId,
      itemsSynced: inventoryRows.length,
      status: "completed",
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Erro desconhecido durante sync de estoque";

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
