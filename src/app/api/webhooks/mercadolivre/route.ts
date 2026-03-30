import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWebhookEvent } from "@/lib/mercadolivre/webhook-processor";

/**
 * Webhook payload sent by Mercado Livre.
 */
interface MlWebhookPayload {
  resource: string;
  user_id: number;
  topic: string;
  application_id: number;
  attempts: number;
  sent: string;
  received: string;
}

/**
 * POST /api/webhooks/mercadolivre
 *
 * Receives webhook notifications from Mercado Livre.
 * Immediately responds with 200 (ML requirement), then processes async.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let payload: MlWebhookPayload;

  try {
    payload = (await request.json()) as MlWebhookPayload;
  } catch {
    // Even on parse errors, respond 200 to prevent ML from retrying bad payloads
    console.error("[webhook] Falha ao parsear payload do webhook");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Validate minimum required fields
  if (!payload.resource || !payload.user_id || !payload.topic) {
    console.error("[webhook] Payload incompleto:", payload);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Save the event to the database immediately
  let eventId: string | null = null;

  try {
    const supabase = createAdminClient();

    const { data: event, error } = await supabase
      .from("webhook_events")
      .insert({
        topic: payload.topic,
        resource: payload.resource,
        ml_user_id: payload.user_id,
        status: "pending",
        payload: JSON.parse(JSON.stringify(payload)),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[webhook] Erro ao salvar evento:", error.message);
    } else {
      eventId = event.id;
    }
  } catch (err) {
    console.error(
      "[webhook] Erro inesperado ao salvar evento:",
      err instanceof Error ? err.message : err
    );
  }

  // Process async — fire and forget (do NOT await)
  if (eventId) {
    processWebhookEvent(eventId).catch((err) => {
      console.error(
        `[webhook] Erro não tratado ao processar evento ${eventId}:`,
        err instanceof Error ? err.message : err
      );
    });
  }

  // Always return 200 immediately
  return NextResponse.json({ received: true }, { status: 200 });
}
