import { createAdminClient } from "@/lib/supabase/admin";
import { mlGet } from "./api";
import type { MlItem, MlOrder } from "./types";
import type { Database } from "@/types/database";

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];

/**
 * Process a single webhook event by its ID.
 *
 * 1. Fetches the event from webhook_events
 * 2. Finds the associated ml_account
 * 3. Based on topic, fetches the resource from ML API and updates the DB
 * 4. Marks the event as processed
 *
 * Never throws — all errors are caught and logged.
 */
export async function processWebhookEvent(eventId: string): Promise<void> {
  const supabase = createAdminClient();

  try {
    // Fetch the webhook event
    const { data: event, error: eventError } = await supabase
      .from("webhook_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      console.error(
        `[webhook-processor] Evento ${eventId} não encontrado:`,
        eventError?.message
      );
      return;
    }

    // Find the ML account by ml_user_id
    const { data: account, error: accountError } = await supabase
      .from("ml_accounts")
      .select("*")
      .eq("ml_user_id", event.ml_user_id)
      .eq("status", "active")
      .single();

    if (accountError || !account) {
      console.warn(
        `[webhook-processor] Conta ML não encontrada para user_id ${event.ml_user_id}. Ignorando evento ${eventId}.`
      );
      await markProcessed(supabase, eventId);
      return;
    }

    switch (event.topic) {
      case "orders_v2":
        await processOrderEvent(supabase, account.id, event.resource);
        break;

      case "items":
        await processItemEvent(supabase, account.id, event.resource);
        break;

      case "questions":
        console.info(
          `[webhook-processor] Evento de pergunta recebido (${event.resource}). Feature futura — ignorando.`
        );
        break;

      default:
        console.warn(
          `[webhook-processor] Tópico desconhecido: ${event.topic}. Ignorando evento ${eventId}.`
        );
        break;
    }

    await markProcessed(supabase, eventId);
  } catch (err) {
    console.error(
      `[webhook-processor] Erro ao processar evento ${eventId}:`,
      err instanceof Error ? err.message : err
    );

    // Still try to mark as processed to avoid infinite retry loops.
    // In production you might want a separate "error" flag instead.
    try {
      const supabaseRetry = createAdminClient();
      await supabaseRetry
        .from("webhook_events")
        .update({ processed: true })
        .eq("id", eventId);
    } catch {
      // Nothing more we can do
    }
  }
}

// ============================================================
// Topic-specific processors
// ============================================================

async function processOrderEvent(
  supabase: ReturnType<typeof createAdminClient>,
  accountId: string,
  resource: string
): Promise<void> {
  // resource format: "/orders/123456789"
  const order = await mlGet<MlOrder>(accountId, resource);

  const firstItem = order.order_items[0] ?? null;
  const firstPayment = order.payments[0] ?? null;
  const mlItemId = firstItem?.item.id ?? null;
  const mlFee = firstItem?.sale_fee ?? 0;

  // Look up cost_price from products table for margin calculation
  let costPrice: number | null = null;
  if (mlItemId) {
    const { data: product } = await supabase
      .from("products")
      .select("cost_price")
      .eq("ml_account_id", accountId)
      .eq("ml_item_id", mlItemId)
      .single();

    costPrice = product?.cost_price ?? null;
  }

  const netProfit =
    costPrice != null
      ? Math.round((order.paid_amount - mlFee - costPrice) * 100) / 100
      : null;

  const orderRow: OrderInsert = {
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
    last_synced_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("orders")
    .upsert(orderRow, {
      onConflict: "ml_account_id,ml_order_id",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Erro ao upsert pedido ${order.id}: ${error.message}`);
  }

  console.info(
    `[webhook-processor] Pedido ${order.id} processado para conta ${accountId}.`
  );
}

async function processItemEvent(
  supabase: ReturnType<typeof createAdminClient>,
  accountId: string,
  resource: string
): Promise<void> {
  // resource format: "/items/MLB123456"
  const item = await mlGet<MlItem>(accountId, resource);

  const productUpdate: ProductUpdate = {
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
    catalog_product_id: item.catalog_product_id ?? null,
    catalog_listing: item.catalog_listing ?? false,
    last_synced_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("products")
    .update(productUpdate)
    .eq("ml_account_id", accountId)
    .eq("ml_item_id", item.id);

  if (error) {
    throw new Error(`Erro ao atualizar produto ${item.id}: ${error.message}`);
  }

  console.info(
    `[webhook-processor] Produto ${item.id} atualizado para conta ${accountId}.`
  );
}

// ============================================================
// Helpers
// ============================================================

async function markProcessed(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string
): Promise<void> {
  const { error } = await supabase
    .from("webhook_events")
    .update({ processed: true })
    .eq("id", eventId);

  if (error) {
    console.error(
      `[webhook-processor] Erro ao marcar evento ${eventId} como processado:`,
      error.message
    );
  }
}
