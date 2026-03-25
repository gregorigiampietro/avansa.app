import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { StatsCards, type DashboardStats } from "@/components/dashboard/stats-cards";
import { RevenueChart, type ChartDataPoint } from "@/components/dashboard/revenue-chart";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/types/database";

interface DashboardPageProps {
  searchParams: Promise<{
    days?: string;
    from?: string;
    to?: string;
  }>;
}

function parseDateRange(params: { days?: string; from?: string; to?: string }) {
  const now = new Date();
  let from: Date;
  let to: Date = now;
  let label: string;

  if (params.from && params.to) {
    from = new Date(params.from + "T00:00:00");
    to = new Date(params.to + "T23:59:59.999");
    const diffDays = Math.round(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    );
    label = `${diffDays}d`;
  } else {
    const days = parseInt(params.days ?? "30", 10) || 30;
    from = new Date();
    from.setDate(from.getDate() - days);
    label = `${days}d`;
  }

  return { from, to, label };
}

function buildChartData(
  orders: { total_amount: number | null; net_profit: number | null; date_created: string | null }[],
  from: Date,
  to: Date
): ChartDataPoint[] {
  const dailyMap = new Map<string, { revenue: number; profit: number }>();

  for (const order of orders) {
    if (!order.date_created) continue;
    const date = new Date(order.date_created);
    const key = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

    const existing = dailyMap.get(key) ?? { revenue: 0, profit: 0 };
    existing.revenue += order.total_amount ?? 0;
    existing.profit += order.net_profit ?? 0;
    dailyMap.set(key, existing);
  }

  const totalDays = Math.max(
    1,
    Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  );

  const chartData: ChartDataPoint[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(to);
    d.setDate(d.getDate() - i);
    const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = dailyMap.get(key);
    chartData.push({
      date: key,
      revenue: entry?.revenue ?? 0,
      profit: entry?.profit ?? 0,
    });
  }

  return chartData;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const params = await searchParams;

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

  // Parse date range from searchParams
  const { from, to, label } = parseDateRange(params);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();

  // Default stats
  const stats: DashboardStats = {
    activeListings: 0,
    salesCount: 0,
    revenue: 0,
    avgMargin: 0,
  };

  let recentOrders: Order[] = [];
  let chartData: ChartDataPoint[] = [];

  if (hasAccounts) {
    // Run all queries in parallel
    const [activeListingsRes, ordersRes, marginRes, recentOrdersRes] =
      await Promise.all([
        // Count active products
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .in("ml_account_id", accountIds)
          .eq("status", "active"),

        // Get orders in date range
        supabase
          .from("orders")
          .select("total_amount, net_profit, date_created")
          .in("ml_account_id", accountIds)
          .gte("date_created", fromISO)
          .lte("date_created", toISO),

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

    // Sales count and revenue for period
    const ordersInRange = ordersRes.data ?? [];
    stats.salesCount = ordersInRange.length;
    stats.revenue = ordersInRange.reduce(
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

    // Build chart data
    chartData = buildChartData(ordersInRange, from, to);
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
            <DateRangePicker />
            <StatsCards stats={stats} periodLabel={label} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <RevenueChart data={chartData} periodLabel={label} />
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
