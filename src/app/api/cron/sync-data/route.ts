import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncProducts } from "@/lib/mercadolivre/sync";
import { syncOrders } from "@/lib/mercadolivre/sync-orders";
import { syncInventoryStatus } from "@/lib/mercadolivre/inventory";

interface AccountSyncResult {
  accountId: string;
  nickname: string | null;
  products: { status: string; itemsSynced: number };
  orders: { status: string; itemsSynced: number };
  inventory: { status: string; itemsSynced: number };
}

interface CronResult {
  accounts: AccountSyncResult[];
  totalAccounts: number;
  succeeded: number;
  failed: number;
}

/**
 * GET /api/cron/sync-data
 *
 * Vercel Cron job that syncs products, orders, and inventory
 * for all active ML accounts. Runs every 6 hours as a fallback
 * to webhooks, ensuring data stays up-to-date.
 *
 * Protected by CRON_SECRET via Authorization header.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    console.error("[cron/sync-data] CRON_SECRET não configurado");
    return NextResponse.json(
      { error: "Configuração do servidor inválida" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { data: accounts, error: queryError } = await supabase
      .from("ml_accounts")
      .select("id, ml_user_id, nickname, status")
      .eq("status", "active");

    if (queryError) {
      console.error(
        "[cron/sync-data] Erro ao buscar contas:",
        queryError.message
      );
      return NextResponse.json(
        { error: `Erro ao buscar contas: ${queryError.message}` },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      console.info("[cron/sync-data] Nenhuma conta ativa para sincronizar.");
      return NextResponse.json({
        accounts: [],
        totalAccounts: 0,
        succeeded: 0,
        failed: 0,
      } satisfies CronResult);
    }

    console.info(
      `[cron/sync-data] Sincronizando ${accounts.length} conta(s) ativa(s).`
    );

    const result: CronResult = {
      accounts: [],
      totalAccounts: accounts.length,
      succeeded: 0,
      failed: 0,
    };

    for (const account of accounts) {
      const accountResult: AccountSyncResult = {
        accountId: account.id,
        nickname: account.nickname,
        products: { status: "skipped", itemsSynced: 0 },
        orders: { status: "skipped", itemsSynced: 0 },
        inventory: { status: "skipped", itemsSynced: 0 },
      };

      let hasError = false;

      try {
        // 1. Sync products
        const productsResult = await syncProducts(
          account.id,
          account.ml_user_id
        );
        accountResult.products = {
          status: productsResult.status,
          itemsSynced: productsResult.itemsSynced,
        };

        if (productsResult.status === "error") {
          console.error(
            `[cron/sync-data] Erro no sync de produtos da conta ${account.nickname}: ${productsResult.errorMessage}`
          );
          hasError = true;
        }
      } catch (err) {
        accountResult.products = { status: "error", itemsSynced: 0 };
        hasError = true;
        console.error(
          `[cron/sync-data] Erro inesperado no sync de produtos (${account.nickname}):`,
          err instanceof Error ? err.message : err
        );
      }

      try {
        // 2. Sync orders
        const ordersResult = await syncOrders(
          account.id,
          account.ml_user_id
        );
        accountResult.orders = {
          status: ordersResult.status,
          itemsSynced: ordersResult.itemsSynced,
        };

        if (ordersResult.status === "error") {
          console.error(
            `[cron/sync-data] Erro no sync de pedidos da conta ${account.nickname}: ${ordersResult.errorMessage}`
          );
          hasError = true;
        }
      } catch (err) {
        accountResult.orders = { status: "error", itemsSynced: 0 };
        hasError = true;
        console.error(
          `[cron/sync-data] Erro inesperado no sync de pedidos (${account.nickname}):`,
          err instanceof Error ? err.message : err
        );
      }

      try {
        // 3. Sync inventory status
        const inventoryResult = await syncInventoryStatus(account.id);
        accountResult.inventory = {
          status: inventoryResult.status,
          itemsSynced: inventoryResult.itemsSynced,
        };

        if (inventoryResult.status === "error") {
          console.error(
            `[cron/sync-data] Erro no sync de inventário da conta ${account.nickname}: ${inventoryResult.errorMessage}`
          );
          hasError = true;
        }
      } catch (err) {
        accountResult.inventory = { status: "error", itemsSynced: 0 };
        hasError = true;
        console.error(
          `[cron/sync-data] Erro inesperado no sync de inventário (${account.nickname}):`,
          err instanceof Error ? err.message : err
        );
      }

      if (hasError) {
        result.failed++;
      } else {
        result.succeeded++;
      }

      result.accounts.push(accountResult);

      console.info(
        `[cron/sync-data] Conta ${account.nickname}: produtos=${accountResult.products.itemsSynced}, pedidos=${accountResult.orders.itemsSynced}, inventário=${accountResult.inventory.itemsSynced}`
      );
    }

    console.info(
      `[cron/sync-data] Concluído: ${result.succeeded} sucesso(s), ${result.failed} falha(s).`
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error(
      "[cron/sync-data] Erro inesperado:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
