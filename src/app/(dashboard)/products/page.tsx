import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ProductsView } from "@/components/products/products-view";
import type { Product, MlAccount } from "@/types/database";

export default async function ProductsPage() {
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

  // Fetch products for all user accounts
  let products: Product[] = [];

  if (accountIds.length > 0) {
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("*")
      .in("ml_account_id", accountIds)
      .order("title", { ascending: true });

    if (productsError) {
      console.error("Error fetching products:", productsError);
    }

    products = productsData ?? [];
  }

  const hasAccounts = mlAccounts.length > 0;
  const hasProducts = products.length > 0;

  return (
    <>
      <Header title="Produtos" />

      {!hasAccounts ? (
        <div className="p-6">
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
            <p className="mb-2 text-sm font-medium text-foreground">
              Nenhuma conta conectada
            </p>
            <p className="text-sm text-muted-foreground">
              Conecte sua conta do Mercado Livre para sincronizar seus produtos.
            </p>
          </div>
        </div>
      ) : !hasProducts ? (
        <div className="p-6">
          <div className="flex flex-col gap-5">
            <ProductsView initialProducts={[]} accounts={mlAccounts} />
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
              <p className="mb-2 text-sm font-medium text-foreground">
                Nenhum produto sincronizado
              </p>
              <p className="text-sm text-muted-foreground">
                Clique em &ldquo;Sincronizar&rdquo; para importar seus anúncios do
                Mercado Livre.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <ProductsView initialProducts={products} accounts={mlAccounts} />
      )}
    </>
  );
}
