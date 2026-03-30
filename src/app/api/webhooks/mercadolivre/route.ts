import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWebhookEvent } from "@/lib/mercadolivre/webhook-processor";

/**
 * Webhook payload sent by Mercado Livre.
 */
interface MlWebhookPayload {
  _id?: string;
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
 *
 * Deduplicates events using ml_notification_id (payload._id).
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
    const mlNotificationId = payload._id ?? null;

    // If we have a notification ID, use upsert with dedup.
    // If duplicate (same ml_notification_id), skip insertion entirely.
    if (mlNotificationId) {
      const { data: event, error } = await supabase
        .from("webhook_events")
        .upsert(
          {
            topic: payload.topic,
            resource: payload.resource,
            ml_user_id: payload.user_id,
            ml_notification_id: mlNotificationId,
            status: "pending",
            payload: JSON.parse(JSON.stringify(payload)),
          },
          {
            onConflict: "ml_notification_id",
            ignoreDuplicates: true,
          }
        )
        .select("id")
        .single();

      if (error) {
        // ignoreDuplicates returns no rows on conflict — not a real error
        // Check if this is a duplicate by querying the existing event
        const { data: existing } = await supabase
          .from("webhook_events")
          .select("id, status")
          .eq("ml_notification_id", mlNotificationId)
          .single();

        if (existing) {
          // Duplicate event — skip processing
          console.info(
            `[webhook] Evento duplicado ignorado: ${mlNotificationId} (status: ${existing.status})`
          );
          return NextResponse.json({ received: true }, { status: 200 });
        }

        console.error("[webhook] Erro ao salvar evento:", error.message);
      } else if (event) {
        eventId = event.id;
      }
    } else {
      // No notification ID — normal insert (no dedup possible)
      const { data: event, error } = await supabase
        .from("webhook_events")
        .insert({
          topic: payload.topic,
          resource: payload.resource,
          ml_user_id: payload.user_id,
          ml_notification_id: null,
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
        `[webhook] Erro nao tratado ao processar evento ${eventId}:`,
        err instanceof Error ? err.message : err
      );
    });
  }

  // Always return 200 immediately
  return NextResponse.json({ received: true }, { status: 200 });
}
