import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Nao autorizado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify account belongs to the authenticated user
    const { data: account, error: fetchError } = await supabase
      .from("ml_accounts")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !account) {
      return NextResponse.json(
        { error: "Conta nao encontrada" },
        { status: 404 }
      );
    }

    // Update status and clear tokens
    const { error: updateError } = await supabase
      .from("ml_accounts")
      .update({
        status: "disconnected",
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Erro ao desconectar conta" },
        { status: 500 }
      );
    }

    // Clean up products and inventory for this account
    // inventory_status is cascade-deleted via product_id FK,
    // but we also delete explicitly via ml_account_id for safety
    const admin = createAdminClient();
    await admin.from("inventory_status").delete().eq("ml_account_id", id);
    await admin.from("products").delete().eq("ml_account_id", id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
