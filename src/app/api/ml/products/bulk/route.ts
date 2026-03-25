import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  updateItemPrice,
  updateItemStock,
  pauseItem,
  activateItem,
} from "@/lib/mercadolivre/api";

type BulkAction =
  | "update_price"
  | "update_stock"
  | "pause"
  | "activate"
  | "update_price_percent";

interface BulkBody {
  productIds: string[];
  action: BulkAction;
  value?: number;
}

interface BulkError {
  productId: string;
  error: string;
}

export async function POST(request: NextRequest) {
  try {
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
    const body = (await request.json()) as BulkBody;

    if (!Array.isArray(body.productIds) || body.productIds.length === 0) {
      return NextResponse.json(
        { error: "Nenhum produto selecionado" },
        { status: 400 }
      );
    }

    const validActions: BulkAction[] = [
      "update_price",
      "update_stock",
      "pause",
      "activate",
      "update_price_percent",
    ];

    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        { error: "Ação inválida" },
        { status: 400 }
      );
    }

    // Actions that require a value
    if (
      ["update_price", "update_stock", "update_price_percent"].includes(
        body.action
      ) &&
      (body.value === undefined || typeof body.value !== "number")
    ) {
      return NextResponse.json(
        { error: "Valor é obrigatório para esta ação" },
        { status: 400 }
      );
    }

    // Verify ALL products belong to user
    const adminClient = createAdminClient();
    const { data: products, error: productsError } = await adminClient
      .from("products")
      .select("*, ml_accounts!inner(user_id)")
      .in("id", body.productIds);

    if (productsError) {
      return NextResponse.json(
        { error: "Erro ao buscar produtos" },
        { status: 500 }
      );
    }

    if (!products || products.length === 0) {
      return NextResponse.json(
        { error: "Nenhum produto encontrado" },
        { status: 404 }
      );
    }

    // Ensure all products belong to the authenticated user
    const unauthorizedProducts = products.filter((p) => {
      const mlAccount = p.ml_accounts as unknown as { user_id: string };
      return mlAccount.user_id !== user.id;
    });

    if (unauthorizedProducts.length > 0) {
      return NextResponse.json(
        { error: "Acesso negado a um ou mais produtos" },
        { status: 403 }
      );
    }

    // Process each product sequentially to avoid ML rate limits
    let succeeded = 0;
    const errors: BulkError[] = [];

    for (const product of products) {
      const accountId = product.ml_account_id;
      const mlItemId = product.ml_item_id;

      try {
        let dbUpdate: Record<string, unknown> = {};

        switch (body.action) {
          case "update_price": {
            await updateItemPrice(accountId, mlItemId, body.value!);
            dbUpdate = { price: body.value };
            break;
          }
          case "update_price_percent": {
            const currentPrice = product.price ?? 0;
            if (currentPrice <= 0) {
              throw new Error("Produto sem preço definido");
            }
            const newPrice = Math.round(
              currentPrice * (1 + body.value! / 100) * 100
            ) / 100;
            if (newPrice <= 0) {
              throw new Error("Novo preço seria negativo ou zero");
            }
            await updateItemPrice(accountId, mlItemId, newPrice);
            dbUpdate = { price: newPrice };
            break;
          }
          case "update_stock": {
            await updateItemStock(accountId, mlItemId, body.value!);
            dbUpdate = { available_quantity: body.value };
            break;
          }
          case "pause": {
            await pauseItem(accountId, mlItemId);
            dbUpdate = { status: "paused" };
            break;
          }
          case "activate": {
            await activateItem(accountId, mlItemId);
            dbUpdate = { status: "active" };
            break;
          }
        }

        // Update local DB
        if (Object.keys(dbUpdate).length > 0) {
          dbUpdate.updated_at = new Date().toISOString();
          await adminClient
            .from("products")
            .update(dbUpdate)
            .eq("id", product.id);
        }

        succeeded++;
      } catch (err) {
        errors.push({
          productId: product.id,
          error:
            err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    }

    return NextResponse.json({
      total: products.length,
      succeeded,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("POST /api/ml/products/bulk error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro interno do servidor",
      },
      { status: 500 }
    );
  }
}
