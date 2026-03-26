import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface CostsBody {
  cost_price?: number;
  packaging_cost?: number;
  other_costs?: number;
  tax_percent?: number;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
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
    const body = (await request.json()) as CostsBody;
    const { cost_price, packaging_cost, other_costs, tax_percent } = body;

    // Validate at least one field is provided
    if (
      cost_price === undefined &&
      packaging_cost === undefined &&
      other_costs === undefined &&
      tax_percent === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Informe pelo menos um campo: cost_price, packaging_cost, other_costs ou tax_percent",
        },
        { status: 400 }
      );
    }

    // Verify the product belongs to one of the user's accounts
    // Use RLS-enabled client to enforce ownership
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, ml_account_id, price, ml_fee, shipping_cost, cost_price, packaging_cost, other_costs, tax_percent")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    // Verify ownership via ml_accounts
    const { data: account, error: accountError } = await supabase
      .from("ml_accounts")
      .select("id")
      .eq("id", product.ml_account_id)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: "Produto não pertence ao usuário" },
        { status: 403 }
      );
    }

    // Merge new values with existing ones
    const updatedCostPrice = cost_price ?? product.cost_price ?? 0;
    const updatedPackagingCost = packaging_cost ?? product.packaging_cost ?? 0;
    const updatedOtherCosts = other_costs ?? product.other_costs ?? 0;
    const updatedTaxPercent = tax_percent ?? product.tax_percent ?? 0;
    const currentPrice = product.price ?? 0;
    const currentMlFee = product.ml_fee ?? 0;
    const currentShippingCost = product.shipping_cost ?? 0;

    // Recalculate margin
    const taxAmount = currentPrice * (updatedTaxPercent / 100);
    const netMargin =
      currentPrice -
      updatedCostPrice -
      updatedPackagingCost -
      updatedOtherCosts -
      currentMlFee -
      currentShippingCost -
      taxAmount;

    const marginPercent =
      currentPrice > 0
        ? parseFloat(((netMargin / currentPrice) * 100).toFixed(2))
        : 0;

    // Update with admin client to bypass RLS (ownership already verified)
    const admin = createAdminClient();

    const { data: updated, error: updateError } = await admin
      .from("products")
      .update({
        cost_price: updatedCostPrice,
        packaging_cost: updatedPackagingCost,
        other_costs: updatedOtherCosts,
        tax_percent: updatedTaxPercent,
        net_margin: parseFloat(netMargin.toFixed(2)),
        margin_percent: marginPercent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Erro ao atualizar custos: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro interno do servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
