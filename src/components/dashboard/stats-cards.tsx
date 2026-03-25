import { Package, ShoppingCart, DollarSign, TrendingUp } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";

export interface DashboardStats {
  activeListings: number;
  salesCount: number;
  revenue: number;
  avgMargin: number;
}

interface StatsCardsProps {
  stats: DashboardStats;
  periodLabel: string;
}

export function StatsCards({ stats, periodLabel }: StatsCardsProps) {
  const cards = [
    {
      label: "Anuncios Ativos",
      value: stats.activeListings.toLocaleString("pt-BR"),
      icon: Package,
      color: null,
    },
    {
      label: `Vendas (${periodLabel})`,
      value: stats.salesCount.toLocaleString("pt-BR"),
      icon: ShoppingCart,
      color: null,
    },
    {
      label: `Faturamento (${periodLabel})`,
      value: formatCurrency(stats.revenue),
      icon: DollarSign,
      color: null,
    },
    {
      label: "Margem Media",
      value: formatPercent(stats.avgMargin),
      icon: TrendingUp,
      color:
        stats.avgMargin > 0
          ? "text-[#CDFF00]"
          : stats.avgMargin < 0
            ? "text-[#FF453A]"
            : null,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </span>
            <card.icon className="size-4 text-muted-foreground" />
          </div>
          <p
            className={`mt-3 text-2xl font-light tracking-tight ${card.color ?? "text-foreground"}`}
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
