import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncOrders } from "@/lib/mercadolivre/sync-orders";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * GET /api/ml/orders — List orders with filters and pagination.
 * Query params: accountId, status, period (7d/30d/90d), page, pageSize
 */
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
    const status = searchParams.get("status");
    const period = searchParams.get("period");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");
    const sortField = searchParams.get("sortField");
    const sortDirection = searchParams.get("sortDirection");
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

    // Validate accountId filter
    if (accountId && !userAccountIds.includes(accountId)) {
      return NextResponse.json(
        { error: "Conta não pertence ao usuário" },
        { status: 403 }
      );
    }

    const filterAccountIds = accountId ? [accountId] : userAccountIds;

    // Build query
    let query = supabase
      .from("orders")
      .select("*", { count: "exact" })
      .in("ml_account_id", filterAccountIds);

    // Status filter
    if (status) {
      query = query.eq("status", status);
    }

    // Date range filter (takes precedence over period shortcut)
    if (dateFrom || dateTo) {
      if (dateFrom) {
        query = query.gte("date_created", dateFrom);
      }
      if (dateTo) {
        query = query.lte("date_created", dateTo);
      }
    } else if (period) {
      const daysMap: Record<string, number> = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
      };
      const days = daysMap[period];
      if (days) {
        const since = new Date(
          Date.now() - days * 24 * 60 * 60 * 1000
        ).toISOString();
        query = query.gte("date_created", since);
      }
    }

    // Search filter (product title or buyer nickname)
    if (search) {
      query = query.or(
        `item_title.ilike.%${search}%,buyer_nickname.ilike.%${search}%`
      );
    }

    // Sort
    const allowedSortFields = ["date_created", "total_amount", "net_profit", "quantity"];
    const resolvedSortField = sortField && allowedSortFields.includes(sortField)
      ? sortField
      : "date_created";
    const resolvedAscending = sortDirection === "asc";
    query = query.order(resolvedSortField, { ascending: resolvedAscending, nullsFirst: false });

    // Pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: orders, error: ordersError, count } = await query;

    if (ordersError) {
      return NextResponse.json(
        { error: `Erro ao buscar pedidos: ${ordersError.message}` },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    return NextResponse.json({
      data: orders,
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

/**
 * POST /api/ml/orders — Trigger order sync for an account.
 * Body: { accountId: string }
 */
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
    const result = await syncOrders(accountId, account.ml_user_id);

    if (result.status === "error") {
      return NextResponse.json(
        {
          error: "Erro durante a sincronização de pedidos",
          details: result.errorMessage,
          syncLogId: result.syncLogId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Sincronização de pedidos concluída com sucesso",
      itemsSynced: result.itemsSynced,
      syncLogId: result.syncLogId,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro interno do servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
