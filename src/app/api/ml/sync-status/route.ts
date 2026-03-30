import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface SyncInfo {
  completedAt: string | null;
  itemsSynced: number;
  status: string;
}

interface WebhookHealth {
  eventsLast24h: number;
  errorsLast24h: number;
  mode: "automatic" | "manual";
}

interface AccountSyncStatus {
  accountId: string;
  nickname: string;
  lastSync: {
    products: SyncInfo | null;
    orders: SyncInfo | null;
  };
  webhookHealth: WebhookHealth;
  syncInProgress: boolean;
}

interface SyncStatusResponse {
  accounts: AccountSyncStatus[];
}

/**
 * GET /api/ml/sync-status
 *
 * Returns sync status, webhook health, and running sync info per ML account.
 * Optional query param: ?accountId={id} to filter to a specific account.
 */
export async function GET(request: Request): Promise<NextResponse<SyncStatusResponse | { error: string }>> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Usuario nao autenticado" },
        { status: 401 }
      );
    }

    // Parse optional accountId filter
    const { searchParams } = new URL(request.url);
    const accountIdFilter = searchParams.get("accountId");

    // Fetch user's ML accounts
    let accountsQuery = supabase
      .from("ml_accounts")
      .select("id, ml_user_id, nickname")
      .eq("user_id", user.id);

    if (accountIdFilter) {
      accountsQuery = accountsQuery.eq("id", accountIdFilter);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;

    if (accountsError) {
      return NextResponse.json(
        { error: `Erro ao buscar contas: ${accountsError.message}` },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ accounts: [] });
    }

    const admin = createAdminClient();

    // Build status for each account in parallel
    const accountStatuses = await Promise.all(
      accounts.map(async (account): Promise<AccountSyncStatus> => {
        // Run all queries for this account in parallel
        const [
          productsSync,
          ordersSync,
          webhookTotal,
          webhookErrors,
          runningSync,
        ] = await Promise.all([
          // Latest completed products sync
          admin
            .from("sync_logs")
            .select("status, items_synced, completed_at")
            .eq("ml_account_id", account.id)
            .in("sync_type", ["products", "products_incremental"])
            .eq("status", "completed")
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          // Latest completed orders sync
          admin
            .from("sync_logs")
            .select("status, items_synced, completed_at")
            .eq("ml_account_id", account.id)
            .in("sync_type", ["orders", "orders_incremental"])
            .eq("status", "completed")
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          // Webhook events in last 24h (total)
          admin
            .from("webhook_events")
            .select("id", { count: "exact", head: true })
            .eq("ml_user_id", account.ml_user_id)
            .gte("received_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

          // Webhook errors in last 24h
          admin
            .from("webhook_events")
            .select("id", { count: "exact", head: true })
            .eq("ml_user_id", account.ml_user_id)
            .eq("status", "error")
            .gte("received_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

          // Any running sync for this account
          admin
            .from("sync_logs")
            .select("id", { count: "exact", head: true })
            .eq("ml_account_id", account.id)
            .eq("status", "running"),
        ]);

        const productsSyncData = productsSync.data;
        const ordersSyncData = ordersSync.data;

        const eventsLast24h = webhookTotal.count ?? 0;
        const errorsLast24h = webhookErrors.count ?? 0;

        return {
          accountId: account.id,
          nickname: account.nickname ?? "",
          lastSync: {
            products: productsSyncData
              ? {
                  completedAt: productsSyncData.completed_at,
                  itemsSynced: productsSyncData.items_synced,
                  status: productsSyncData.status,
                }
              : null,
            orders: ordersSyncData
              ? {
                  completedAt: ordersSyncData.completed_at,
                  itemsSynced: ordersSyncData.items_synced,
                  status: ordersSyncData.status,
                }
              : null,
          },
          webhookHealth: {
            eventsLast24h,
            errorsLast24h,
            mode: eventsLast24h > 0 ? "automatic" : "manual",
          },
          syncInProgress: (runningSync.count ?? 0) > 0,
        };
      })
    );

    return NextResponse.json({ accounts: accountStatuses });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro interno do servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
