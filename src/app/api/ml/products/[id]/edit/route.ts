import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  updateItemPrice,
  updateItemStock,
  pauseItem,
  activateItem,
} from "@/lib/mercadolivre/api";

interface EditBody {
  price?: number;
  available_quantity?: number;
  status?: "active" | "paused";
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }

    // Parse body
    const body = (await request.json()) as EditBody;

    if (
      body.price === undefined &&
      body.available_quantity === undefined &&
      body.status === undefined
    ) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar" },
        { status: 400 }
      );
    }

    if (body.price !== undefined && (typeof body.price !== "number" || body.price < 0)) {
      return NextResponse.json(
        { error: "Preço inválido" },
        { status: 400 }
      );
    }

    if (
      body.available_quantity !== undefined &&
      (typeof body.available_quantity !== "number" ||
        body.available_quantity < 0 ||
        !Number.isInteger(body.available_quantity))
    ) {
      return NextResponse.json(
        { error: "Estoque inválido" },
        { status: 400 }
      );
    }

    if (
      body.status !== undefined &&
      body.status !== "active" &&
      body.status !== "paused"
    ) {
      return NextResponse.json(
        { error: "Status inválido. Use 'active' ou 'paused'" },
        { status: 400 }
      );
    }

    // Verify product belongs to user (join with ml_accounts)
    const adminClient = createAdminClient();
    const { data: product, error: productError } = await adminClient
      .from("products")
      .select("*, ml_accounts!inner(user_id)")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    // Type assertion for the joined data
    const mlAccount = product.ml_accounts as unknown as { user_id: string };
    if (mlAccount.user_id !== user.id) {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 403 }
      );
    }

    const accountId = product.ml_account_id;
    const mlItemId = product.ml_item_id;
    const errors: string[] = [];
    const dbUpdates: Record<string, unknown> = {};

    // Execute each requested change against ML API
    if (body.price !== undefined) {
      try {
        await updateItemPrice(accountId, mlItemId, body.price);
        dbUpdates.price = body.price;
      } catch (err) {
        errors.push(
          `Preço: ${err instanceof Error ? err.message : "Erro desconhecido"}`
        );
      }
    }

    if (body.available_quantity !== undefined) {
      try {
        await updateItemStock(accountId, mlItemId, body.available_quantity);
        dbUpdates.available_quantity = body.available_quantity;
      } catch (err) {
        errors.push(
          `Estoque: ${err instanceof Error ? err.message : "Erro desconhecido"}`
        );
      }
    }

    if (body.status !== undefined) {
      try {
        if (body.status === "paused") {
          await pauseItem(accountId, mlItemId);
        } else {
          await activateItem(accountId, mlItemId);
        }
        dbUpdates.status = body.status;
      } catch (err) {
        errors.push(
          `Status: ${err instanceof Error ? err.message : "Erro desconhecido"}`
        );
      }
    }

    // Update local DB with successful changes
    if (Object.keys(dbUpdates).length > 0) {
      dbUpdates.updated_at = new Date().toISOString();

      const { data: updatedProduct, error: updateError } = await adminClient
        .from("products")
        .update(dbUpdates)
        .eq("id", productId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          {
            error: "Erro ao atualizar banco de dados local",
            mlErrors: errors.length > 0 ? errors : undefined,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        data: updatedProduct,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // All changes failed
    return NextResponse.json(
      { error: "Nenhuma alteração foi aplicada", errors },
      { status: 422 }
    );
  } catch (err) {
    console.error("PUT /api/ml/products/[id]/edit error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro interno do servidor",
      },
      { status: 500 }
    );
  }
}
