"use client";

import { useMemo } from "react";
import { ShoppingCart, DollarSign, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Order } from "@/types/database";

interface OrderStatsCardsProps {
  orders: Order[];
}

export function OrderStatsCards({ orders }: OrderStatsCardsProps) {
  const stats = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === "paid");
    const salesCount = paidOrders.length;
    const totalRevenue = paidOrders.reduce(
      (sum, o) => sum + (o.total_amount ?? 0),
      0
    );
    const totalProfit = paidOrders.reduce(
      (sum, o) => sum + (o.net_profit ?? 0),
      0
    );
    return { salesCount, totalRevenue, totalProfit };
  }, [orders]);

  const cards = [
    {
      label: "Total de vendas",
      value: stats.salesCount.toLocaleString("pt-BR"),
      icon: ShoppingCart,
      color: null,
    },
    {
      label: "Faturamento total",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: null,
    },
    {
      label: "Lucro liquido",
      value: formatCurrency(stats.totalProfit),
      icon: TrendingUp,
      color:
        stats.totalProfit > 0
          ? "text-[#CDFF00]"
          : stats.totalProfit < 0
            ? "text-[#FF453A]"
            : null,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
