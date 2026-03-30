import { createAdminClient } from "@/lib/supabase/admin";
import { mlGet, getListingPrices, getShippingOptions } from "./api";
import { calculateMargin } from "@/lib/utils/calculations";
import type { MlItem, MlOrder } from "./types";
import type { Database } from "@/types/database";

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];

/**
 * Process a single webhook event by its ID.
 *
 * 1. Fetches the event from webhook_events
 * 2. Sets status to 'processing'
 * 3. Finds the associated ml_account
 * 4. Based on topic, fetches the resource from ML API and updates the DB
 * 5. Marks the event as completed or error
 *
 * Never throws -- all errors are caught and logged.
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
        `[webhook-processor] Evento ${eventId} nao encontrado:`,
        eventError?.message
      );
      return;
    }

    // Mark as processing
    await markStatus(supabase, eventId, "processing");

    // Find the ML account by ml_user_id
    const { data: account, error: accountError } = await supabase
      .from("ml_accounts")
      .select("*")
      .eq("ml_user_id", event.ml_user_id)
      .eq("status", "active")
      .single();

    if (accountError || !account) {
      console.warn(
        `[webhook-processor] Conta ML nao encontrada para user_id ${event.ml_user_id}. Ignorando evento ${eventId}.`
      );
      await markStatus(supabase, eventId, "completed");
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
          `[webhook-processor] Evento de pergunta recebido (${event.resource}). Feature futura -- ignorando.`
        );
        break;

      default:
        console.warn(
          `[webhook-processor] Topico desconhecido: ${event.topic}. Ignorando evento ${eventId}.`
        );
        break;
    }

    await markStatus(supabase, eventId, "completed");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(
      `[webhook-processor] Erro ao processar evento ${eventId}:`,
      errorMessage
    );

    // Mark as error so the cron can retry later
    try {
      const supabaseRetry = createAdminClient();
      await markStatus(supabaseRetry, eventId, "error", errorMessage);
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

/**
 * Complete item processing that mirrors sync.ts behavior:
 * fetches fees, shipping, existing costs, and recalculates margin.
 */
async function processItemEvent(
  supabase: ReturnType<typeof createAdminClient>,
  accountId: string,
  resource: string
): Promise<void> {
  // resource format: "/items/MLB123456"
  const item = await mlGet<MlItem>(accountId, resource);

  // 1. Fetch ML fees
  let mlFee = 0;
  try {
    const priceData = await getListingPrices(
      accountId,
      item.price,
      item.listing_type_id,
      item.category_id
    );
    mlFee = priceData.sale_fee_amount ?? 0;
  } catch (err) {
    console.warn(
      `[webhook-processor] Erro ao buscar taxas ML para ${item.id}:`,
      err instanceof Error ? err.message : err
    );
  }

  // 2. Fetch shipping cost
  let shippingCost = 0;
  try {
    const shippingData = await getShippingOptions(accountId, item.id);
    if (shippingData.options?.length > 0) {
      const standardOption =
        shippingData.options.find(
          (o) => o.shipping_method_type === "standard"
        ) ?? shippingData.options[0];
      shippingCost = standardOption.list_cost;
    }
  } catch (err) {
    console.warn(
      `[webhook-processor] Erro ao buscar frete para ${item.id}:`,
      err instanceof Error ? err.message : err
    );
  }

  // 3. Fetch existing product costs from DB
  const { data: existingProduct } = await supabase
    .from("products")
    .select("cost_price, packaging_cost, other_costs, tax_percent")
    .eq("ml_account_id", accountId)
    .eq("ml_item_id", item.id)
    .single();

  const costPrice = existingProduct?.cost_price ?? 0;
  const packagingCost = existingProduct?.packaging_cost ?? 0;
  const otherCosts = existingProduct?.other_costs ?? 0;
  const taxPercent = existingProduct?.tax_percent ?? 0;

  // 4. Calculate margin
  const { net_margin, margin_percent } = calculateMargin({
    price: item.price,
    cost_price: costPrice,
    packaging_cost: packagingCost,
    other_costs: otherCosts,
    ml_fee: mlFee,
    shipping_cost: shippingCost,
    tax_percent: taxPercent,
  });

  // 5. Update product with ALL fields
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
    ml_fee: mlFee,
    shipping_cost: shippingCost,
    net_margin,
    margin_percent,
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
    `[webhook-processor] Produto ${item.id} atualizado com taxas/frete/margem para conta ${accountId}.`
  );
}

// ============================================================
// Helpers
// ============================================================

type WebhookStatus = "pending" | "processing" | "completed" | "error";

async function markStatus(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
  status: WebhookStatus,
  errorMessage?: string
): Promise<void> {
  const update: Database["public"]["Tables"]["webhook_events"]["Update"] = {
    status,
  };

  if (status === "completed" || status === "error") {
    update.processed_at = new Date().toISOString();
  }

  if (errorMessage) {
    update.error_message = errorMessage;
  }

  const { error } = await supabase
    .from("webhook_events")
    .update(update)
    .eq("id", eventId);

  if (error) {
    console.error(
      `[webhook-processor] Erro ao atualizar status do evento ${eventId} para ${status}:`,
      error.message
    );
  }
}
