"use client";

import { formatCurrency } from "@/lib/utils/formatters";

export interface ChartDataPoint {
  date: string; // DD/MM
  revenue: number;
  profit: number;
}

interface RevenueChartProps {
  data: ChartDataPoint[];
  periodLabel?: string;
}

export function RevenueChart({ data, periodLabel = "30d" }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Sem dados de vendas ainda
        </p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Faturamento e Lucro — Últimos {periodLabel}
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-[#CDFF00]" />
            <span className="text-xs text-muted-foreground">Faturamento</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-[#CDFF00]/40" />
            <span className="text-xs text-muted-foreground">Lucro</span>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex h-[220px] items-end gap-[2px]">
        {data.map((point, index) => {
          const revenueHeight = (point.revenue / maxValue) * 100;
          const profitHeight =
            point.profit > 0 ? (point.profit / maxValue) * 100 : 0;

          return (
            <div
              key={point.date}
              className="group relative flex flex-1 flex-col items-center"
              style={{ height: "100%" }}
            >
              {/* Bars container — aligned to bottom */}
              <div className="flex flex-1 items-end justify-center w-full gap-[1px]">
                {/* Revenue bar */}
                <div
                  className="w-full max-w-[14px] rounded-t-sm bg-[#CDFF00] transition-opacity group-hover:opacity-80"
                  style={{ height: `${Math.max(revenueHeight, 1)}%` }}
                  title={`${point.date} — Faturamento: ${formatCurrency(point.revenue)}`}
                />
                {/* Profit bar */}
                <div
                  className="w-full max-w-[14px] rounded-t-sm bg-[#CDFF00]/40 transition-opacity group-hover:opacity-80"
                  style={{ height: `${Math.max(profitHeight, 0.5)}%` }}
                  title={`${point.date} — Lucro: ${formatCurrency(point.profit)}`}
                />
              </div>

              {/* X-axis label: show every 5th day */}
              {index % 5 === 0 && (
                <span className="mt-2 text-[10px] text-muted-foreground">
                  {point.date}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
