import { createAdminClient } from "@/lib/supabase/admin";
import { mlGet } from "./api";
import type { MlOrder, MlOrderSearchResponse } from "./types";
import type { Database } from "@/types/database";

type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];

/** Max orders per search page (ML API limit) */
const SEARCH_PAGE_LIMIT = 50;

export interface OrderSyncOptions {
  incremental?: boolean;
}

export interface OrderSyncResult {
  syncLogId: string;
  itemsSynced: number;
  status: "completed" | "error";
  errorMessage?: string;
}

/**
 * Sync orders for a Mercado Livre account.
 *
 * When `options.incremental` is true, only fetches orders created since
 * the last completed sync (uses `date_created.from` ML API filter).
 *
 * 1. Creates a sync_log entry with status "running"
 * 2. Fetches orders via /orders/search with pagination
 * 3. Maps each order to the DB orders table
 * 4. Looks up cost_price from the products table
 * 5. Upserts into the orders table
 * 6. Updates the sync_log with the final status
 */
export async function syncOrders(
  accountId: string,
  mlUserId: number,
  options?: OrderSyncOptions
): Promise<OrderSyncResult> {
  const incremental = options?.incremental ?? false;
  const supabase = createAdminClient();

  // Create sync log entry
  const { data: syncLog, error: syncLogError } = await supabase
    .from("sync_logs")
    .insert({
      ml_account_id: accountId,
      sync_type: incremental ? "orders_incremental" : "orders",
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
    // For incremental sync, find the last completed orders sync timestamp
    let dateFromFilter = "";
    if (incremental) {
      const { data: lastSync } = await supabase
        .from("sync_logs")
        .select("completed_at")
        .eq("ml_account_id", accountId)
        .in("sync_type", ["orders", "orders_incremental"])
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .single();

      if (lastSync?.completed_at) {
        dateFromFilter = `&order.date_created.from=${lastSync.completed_at}`;
      }
    }

    // Fetch orders with pagination
    const allOrders: MlOrder[] = [];
    let offset = 0;
    let total = Infinity;

    while (offset < total) {
      const data = await mlGet<MlOrderSearchResponse>(
        accountId,
        `/orders/search?seller=${mlUserId}&sort=date_desc&offset=${offset}&limit=${SEARCH_PAGE_LIMIT}${dateFromFilter}`
      );

      total = data.paging.total;
      allOrders.push(...data.results);
      offset += SEARCH_PAGE_LIMIT;
    }

    // Fetch cost prices from products table for margin calculation
    const { data: products } = await supabase
      .from("products")
      .select("ml_item_id, cost_price")
      .eq("ml_account_id", accountId);

    const costPriceMap = new Map<string, number>();
    if (products) {
      for (const p of products) {
        if (p.cost_price != null) {
          costPriceMap.set(p.ml_item_id, p.cost_price);
        }
      }
    }

    // Map orders to DB rows
    const now = new Date().toISOString();
    const orderRows: OrderInsert[] = allOrders.map((order) => {
      const firstItem = order.order_items[0] ?? null;
      const firstPayment = order.payments[0] ?? null;

      const mlItemId = firstItem?.item.id ?? null;
      const mlFee = firstItem?.sale_fee ?? 0;
      const costPrice = mlItemId ? (costPriceMap.get(mlItemId) ?? null) : null;

      const netProfit =
        costPrice != null
          ? Math.round((order.paid_amount - mlFee - costPrice) * 100) / 100
          : null;

      return {
        ml_account_id: accountId,
        ml_order_id: order.id,
        status: order.status,
        date_created: order.date_created,
        date_closed: order.date_closed,
        total_amount: order.paid_amount,
        currency_id: order.currency_id,
        buyer_id: order.buyer.id,
        buyer_nickname: order.buyer.nickname,
        ml_item_id: mlItemId,
        item_title: firstItem?.item.title ?? null,
        quantity: firstItem?.quantity ?? null,
        unit_price: firstItem?.unit_price ?? null,
        sku: firstItem?.item.seller_sku ?? null,
        ml_fee: mlFee,
        payment_status: firstPayment?.status ?? null,
        payment_type: firstPayment?.payment_type ?? null,
        shipping_id: order.shipping?.id ?? null,
        cost_price: costPrice,
        net_profit: netProfit,
        last_synced_at: now,
      };
    });

    // Upsert in batches
    const UPSERT_BATCH_SIZE = 100;
    for (let i = 0; i < orderRows.length; i += UPSERT_BATCH_SIZE) {
      const batch = orderRows.slice(i, i + UPSERT_BATCH_SIZE);

      const { error: upsertError } = await supabase
        .from("orders")
        .upsert(batch, {
          onConflict: "ml_account_id,ml_order_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        throw new Error(
          `Erro ao salvar pedidos (batch ${i}): ${upsertError.message}`
        );
      }
    }

    // Mark sync as completed
    await supabase
      .from("sync_logs")
      .update({
        status: "completed",
        items_synced: allOrders.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLogId);

    return {
      syncLogId,
      itemsSynced: allOrders.length,
      status: "completed",
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Erro desconhecido durante o sync de pedidos";

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
