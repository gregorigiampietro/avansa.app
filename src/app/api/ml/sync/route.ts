import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncProducts } from "@/lib/mercadolivre/sync";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { accountId } = body as { accountId?: string };

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId é obrigatório" },
        { status: 400 }
      );
    }

    // Verify the account belongs to the authenticated user
    const { data: account, error: accountError } = await supabase
      .from("ml_accounts")
      .select("id, ml_user_id, status")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: "Conta ML não encontrada ou não pertence ao usuário" },
        { status: 404 }
      );
    }

    if (account.status !== "active") {
      return NextResponse.json(
        { error: "Conta ML não está ativa. Reconecte a conta." },
        { status: 400 }
      );
    }

    // Run sync
    const result = await syncProducts(accountId, account.ml_user_id);

    if (result.status === "error") {
      return NextResponse.json(
        {
          error: "Erro durante a sincronização",
          details: result.errorMessage,
          syncLogId: result.syncLogId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Sincronização concluída com sucesso",
      itemsSynced: result.itemsSynced,
      syncLogId: result.syncLogId,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro interno do servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
