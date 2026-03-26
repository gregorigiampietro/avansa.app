import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncInventoryStatus } from "@/lib/mercadolivre/inventory";

export async function GET() {
  try {
    const supabase = await createClient();

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

    // Get user's ML accounts
    const { data: accounts } = await supabase
      .from("ml_accounts")
      .select("id")
      .eq("user_id", user.id);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ data: [], summary: {} });
    }

    const accountIds = accounts.map((a) => a.id);

    // Fetch inventory with product info
    const { data: inventory, error: inventoryError } = await supabase
      .from("inventory_status")
      .select(
        "*, products(id, ml_item_id, title, thumbnail, sku, status, price, permalink)"
      )
      .in("ml_account_id", accountIds)
      .order("available", { ascending: true });

    if (inventoryError) {
      return NextResponse.json(
        { error: `Erro ao buscar estoque: ${inventoryError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: inventory ?? [] });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro interno do servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

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

    const body = await request.json();
    const { accountId } = body as { accountId?: string };

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId é obrigatório" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
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

    const result = await syncInventoryStatus(accountId);

    if (result.status === "error") {
      return NextResponse.json(
        {
          error: "Erro durante sincronização de estoque",
          details: result.errorMessage,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Sincronização de estoque concluída",
      itemsSynced: result.itemsSynced,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro interno do servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
