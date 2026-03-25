import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { StatsCards, type DashboardStats } from "@/components/dashboard/stats-cards";
import { RevenueChart, type ChartDataPoint } from "@/components/dashboard/revenue-chart";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has any ML accounts connected
  const { data: accounts } = await supabase
    .from("ml_accounts")
    .select("id")
    .eq("user_id", user.id);

  const hasAccounts = accounts && accounts.length > 0;
  const accountIds = accounts?.map((a) => a.id) ?? [];

  // Build 30-day date threshold (ISO string)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

  // Default stats
  const stats: DashboardStats = {
    activeListings: 0,
    sales30d: 0,
    revenue30d: 0,
    avgMargin: 0,
  };

  let recentOrders: Order[] = [];
  let chartData: ChartDataPoint[] = [];

  if (hasAccounts) {
    // Run all queries in parallel
    const [activeListingsRes, orders30dRes, marginRes, recentOrdersRes] =
      await Promise.all([
        // Count active products
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .in("ml_account_id", accountIds)
          .eq("status", "active"),

        // Get orders from last 30 days
        supabase
          .from("orders")
          .select("total_amount, net_profit, date_created")
          .in("ml_account_id", accountIds)
          .gte("date_created", thirtyDaysAgoISO),

        // Average margin from products
        supabase
          .from("products")
          .select("margin_percent")
          .in("ml_account_id", accountIds)
          .not("margin_percent", "is", null),

        // Last 5 orders
        supabase
          .from("orders")
          .select("*")
          .in("ml_account_id", accountIds)
          .order("date_created", { ascending: false })
          .limit(5),
      ]);

    // Active listings count
    stats.activeListings = activeListingsRes.count ?? 0;

    // Sales count and revenue from last 30 days
    const orders30d = orders30dRes.data ?? [];
    stats.sales30d = orders30d.length;
    stats.revenue30d = orders30d.reduce(
      (sum, o) => sum + (o.total_amount ?? 0),
      0
    );

    // Average margin
    const margins = marginRes.data ?? [];
    if (margins.length > 0) {
      const totalMargin = margins.reduce(
        (sum, p) => sum + (p.margin_percent ?? 0),
        0
      );
      stats.avgMargin = totalMargin / margins.length;
    }

    // Recent orders
    recentOrders = recentOrdersRes.data ?? [];

    // Build chart data: aggregate daily revenue/profit for last 30 days
    const dailyMap = new Map<string, { revenue: number; profit: number }>();

    for (const order of orders30d) {
      if (!order.date_created) continue;
      const date = new Date(order.date_created);
      const key = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

      const existing = dailyMap.get(key) ?? { revenue: 0, profit: 0 };
      existing.revenue += order.total_amount ?? 0;
      existing.profit += order.net_profit ?? 0;
      dailyMap.set(key, existing);
    }

    // Generate all 30 days in order
    chartData = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = dailyMap.get(key);
      chartData.push({
        date: key,
        revenue: entry?.revenue ?? 0,
        profit: entry?.profit ?? 0,
      });
    }
  }

  return (
    <>
      <Header title="Dashboard" />

      <div className="space-y-6 p-6">
        {!hasAccounts ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Conecte uma conta do Mercado Livre para ver suas metricas
            </p>
            <Link
              href="/accounts"
              className="mt-4 rounded-md bg-[#CDFF00] px-4 py-2 text-sm font-medium text-black hover:bg-[#CDFF00]/90 transition-colors"
            >
              Conectar conta
            </Link>
          </div>
        ) : (
          <>
            <StatsCards stats={stats} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <RevenueChart data={chartData} />
              </div>
              <div className="lg:col-span-1">
                <RecentOrders orders={recentOrders ?? []} />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
