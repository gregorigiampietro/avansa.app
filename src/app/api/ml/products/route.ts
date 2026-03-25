import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
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

    // Parse query params
    const { searchParams } = request.nextUrl;
    const accountId = searchParams.get("accountId");
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const sort = searchParams.get("sort") ?? "title";
    const order = searchParams.get("order") ?? "asc";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10))
    );

    // Get all account IDs belonging to this user
    const { data: accounts, error: accountsError } = await supabase
      .from("ml_accounts")
      .select("id")
      .eq("user_id", user.id);

    if (accountsError) {
      return NextResponse.json(
        { error: "Erro ao buscar contas do usuário" },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
      });
    }

    const userAccountIds = accounts.map((a) => a.id);

    // If an accountId filter is provided, validate it belongs to the user
    if (accountId && !userAccountIds.includes(accountId)) {
      return NextResponse.json(
        { error: "Conta não pertence ao usuário" },
        { status: 403 }
      );
    }

    const filterAccountIds = accountId ? [accountId] : userAccountIds;

    // Build query
    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .in("ml_account_id", filterAccountIds);

    // Text search on title or SKU
    if (search) {
      query = query.or(`title.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    // Status filter
    if (status) {
      query = query.eq("status", status);
    }

    // Sorting
    const validSortColumns: Record<string, string> = {
      title: "title",
      price: "price",
      margin: "margin_percent",
      stock: "available_quantity",
      sold: "sold_quantity",
    };

    const sortColumn = validSortColumns[sort] ?? "title";
    const ascending = order !== "desc";
    query = query.order(sortColumn, { ascending, nullsFirst: false });

    // Pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: products, error: productsError, count } = await query;

    if (productsError) {
      return NextResponse.json(
        { error: `Erro ao buscar produtos: ${productsError.message}` },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    return NextResponse.json({
      data: products,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro interno do servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
