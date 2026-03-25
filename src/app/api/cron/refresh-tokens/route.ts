import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "@/lib/mercadolivre/oauth";

interface RefreshResult {
  refreshed: number;
  failed: number;
  errors: string[];
}

/**
 * GET /api/cron/refresh-tokens
 *
 * Vercel Cron job that refreshes ML access tokens before they expire.
 * Runs every hour. Tokens expire in ~6h, so hourly refresh is safe.
 *
 * Protected by CRON_SECRET via Authorization header.
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Validate CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    console.error("[cron/refresh-tokens] CRON_SECRET não configurado");
    return NextResponse.json(
      { error: "Configuração do servidor inválida" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const result: RefreshResult = { refreshed: 0, failed: 0, errors: [] };

  try {
    // Find accounts with tokens expiring in the next hour
    const oneHourFromNow = new Date(
      Date.now() + 60 * 60 * 1000
    ).toISOString();

    const { data: accounts, error: queryError } = await supabase
      .from("ml_accounts")
      .select("*")
      .eq("status", "active")
      .lt("token_expires_at", oneHourFromNow);

    if (queryError) {
      console.error(
        "[cron/refresh-tokens] Erro ao buscar contas:",
        queryError.message
      );
      return NextResponse.json(
        { error: `Erro ao buscar contas: ${queryError.message}` },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      console.info("[cron/refresh-tokens] Nenhum token para renovar.");
      return NextResponse.json(result);
    }

    console.info(
      `[cron/refresh-tokens] ${accounts.length} conta(s) com token(s) a vencer.`
    );

    // Process each account
    for (const account of accounts) {
      try {
        if (!account.refresh_token) {
          const msg = `Conta ${account.id} (${account.nickname}) sem refresh_token`;
          console.warn(`[cron/refresh-tokens] ${msg}`);
          result.errors.push(msg);
          result.failed++;
          continue;
        }

        const tokenData = await refreshAccessToken(account.refresh_token);

        const newExpiresAt = new Date(
          Date.now() + tokenData.expires_in * 1000
        ).toISOString();

        const { error: updateError } = await supabase
          .from("ml_accounts")
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: newExpiresAt,
            status: "active",
          })
          .eq("id", account.id);

        if (updateError) {
          throw new Error(
            `Erro ao atualizar banco: ${updateError.message}`
          );
        }

        result.refreshed++;
        console.info(
          `[cron/refresh-tokens] Token renovado para conta ${account.id} (${account.nickname}).`
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Erro desconhecido";

        const msg = `Conta ${account.id} (${account.nickname}): ${errorMessage}`;
        console.error(`[cron/refresh-tokens] Falha: ${msg}`);
        result.errors.push(msg);
        result.failed++;

        // Mark account as expired so the user knows to reconnect
        try {
          await supabase
            .from("ml_accounts")
            .update({ status: "expired" })
            .eq("id", account.id);
        } catch {
          console.error(
            `[cron/refresh-tokens] Erro ao marcar conta ${account.id} como expired.`
          );
        }
      }
    }

    console.info(
      `[cron/refresh-tokens] Resultado: ${result.refreshed} renovado(s), ${result.failed} falha(s).`
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error(
      "[cron/refresh-tokens] Erro inesperado:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
