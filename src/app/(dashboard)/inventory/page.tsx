import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
// Inventory page — stock control with interactive chart and expandable details
import { InventoryView, type InventoryRow } from "@/components/inventory/inventory-view";
import type { InventoryStats } from "@/components/inventory/inventory-stats-cards";
import type { ChartSlice } from "@/components/inventory/inventory-chart";
import { createClient } from "@/lib/supabase/server";

const CONDITION_CONFIG = [
  { key: "available", label: "Disponível", color: "#CDFF00" },
  { key: "in_transfer", label: "Em Trânsito", color: "#64D2FF" },
  { key: "damaged", label: "Danificado", color: "#FF453A" },
  { key: "not_apt_for_sale", label: "Não Apto p/ Venda", color: "#FF9F0A" },
  { key: "lost", label: "Extraviado", color: "#BF5AF2" },
  { key: "expired", label: "Expirado", color: "#636366" },
] as const;

function computeStats(data: InventoryRow[]): InventoryStats {
  let totalStock = 0;
  let available = 0;
  let unavailable = 0;
  let atRiskCount = 0;
  let totalValue = 0;

  for (const row of data) {
    totalStock += row.total_stock;
    available += row.available;
    unavailable +=
      row.damaged +
      row.expired +
      row.lost +
      row.in_transfer +
      row.not_apt_for_sale;

    if (row.available < 5) {
      atRiskCount++;
    }

    const price = row.products?.price ?? 0;
    totalValue += row.available * price;
  }

  return { totalStock, available, unavailable, atRiskCount, totalValue };
}

function computeChartData(data: InventoryRow[]): ChartSlice[] {
  return CONDITION_CONFIG.map(({ key, label, color }) => {
    const quantity = data.reduce(
      (sum, row) => sum + (row[key as keyof InventoryRow] as number),
      0
    );
    return { condition: key, label, quantity, color };
  });
}

export default async function InventoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has ML accounts
  const { data: accounts } = await supabase
    .from("ml_accounts")
    .select("id")
    .eq("user_id", user.id);

  const hasAccounts = accounts && accounts.length > 0;
  const accountIds = accounts?.map((a) => a.id) ?? [];

  let inventoryData: InventoryRow[] = [];
  let stats: InventoryStats = {
    totalStock: 0,
    available: 0,
    unavailable: 0,
    atRiskCount: 0,
    totalValue: 0,
  };
  let chartData: ChartSlice[] = [];

  if (hasAccounts) {
    const { data: inventory } = await supabase
      .from("inventory_status")
      .select(
        "id, product_id, ml_account_id, ml_item_id, available, damaged, expired, lost, in_transfer, reserved, not_apt_for_sale, total_stock, condition_details, products(id, ml_item_id, title, thumbnail, sku, status, price, permalink)"
      )
      .in("ml_account_id", accountIds)
      .order("available", { ascending: true });

    inventoryData = (inventory ?? []) as unknown as InventoryRow[];
    stats = computeStats(inventoryData);
    chartData = computeChartData(inventoryData);
  }

  return (
    <>
      <Header title="Estoque" />

      <div className="space-y-6 p-6">
        {!hasAccounts ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Conecte uma conta do Mercado Livre para ver seu estoque
            </p>
            <Link
              href="/accounts"
              className="mt-4 rounded-md bg-[#CDFF00] px-4 py-2 text-sm font-medium text-black hover:bg-[#CDFF00]/90 transition-colors"
            >
              Conectar conta
            </Link>
          </div>
        ) : inventoryData.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum dado de estoque encontrado. Sincronize seus produtos primeiro.
            </p>
            <Link
              href="/products"
              className="mt-4 rounded-md bg-[#CDFF00] px-4 py-2 text-sm font-medium text-black hover:bg-[#CDFF00]/90 transition-colors"
            >
              Ir para Produtos
            </Link>
          </div>
        ) : (
          <InventoryView
            data={inventoryData}
            stats={stats}
            chartData={chartData}
          />
        )}
      </div>
    </>
  );
}
