import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { OrdersView } from "@/components/orders/orders-view";
import type { Order, MlAccount } from "@/types/database";

export default async function OrdersPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Fetch user's ML accounts
  const { data: accounts, error: accountsError } = await supabase
    .from("ml_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("connected_at", { ascending: false });

  if (accountsError) {
    console.error("Error fetching ML accounts:", accountsError);
  }

  const mlAccounts: MlAccount[] = accounts ?? [];
  const accountIds = mlAccounts.map((a) => a.id);

  // Fetch orders for all user accounts
  let orders: Order[] = [];

  if (accountIds.length > 0) {
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .in("ml_account_id", accountIds)
      .order("date_created", { ascending: false })
      .limit(100);

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
    }

    orders = ordersData ?? [];
  }

  const hasAccounts = mlAccounts.length > 0;
  const hasOrders = orders.length > 0;

  return (
    <>
      <Header title="Vendas" />

      {!hasAccounts ? (
        <div className="p-6">
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
            <p className="mb-2 text-sm font-medium text-foreground">
              Nenhuma conta conectada
            </p>
            <p className="text-sm text-muted-foreground">
              Conecte sua conta do Mercado Livre para sincronizar suas vendas.
            </p>
          </div>
        </div>
      ) : !hasOrders ? (
        <div className="p-6">
          <div className="flex flex-col gap-5">
            <OrdersView initialOrders={[]} accounts={mlAccounts} />
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
              <p className="mb-2 text-sm font-medium text-foreground">
                Nenhuma venda sincronizada
              </p>
              <p className="text-sm text-muted-foreground">
                Clique em &ldquo;Sincronizar vendas&rdquo; para importar seus
                pedidos do Mercado Livre.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <OrdersView initialOrders={orders} accounts={mlAccounts} />
      )}
    </>
  );
}
