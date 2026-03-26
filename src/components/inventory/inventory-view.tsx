"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { InventoryStatsCards, type InventoryStats } from "./inventory-stats-cards";
import { InventoryChart, type ChartSlice } from "./inventory-chart";
import { InventoryTable } from "./inventory-table";
import { formatCurrency } from "@/lib/utils/formatters";

export interface ConditionDetailEntry {
  status: string;
  quantity: number;
  conditions?: Array<{
    condition: string;
    quantity: number;
  }>;
}

export interface InventoryRow {
  id: string;
  product_id: string;
  ml_account_id: string;
  ml_item_id: string;
  available: number;
  damaged: number;
  expired: number;
  lost: number;
  in_transfer: number;
  reserved: number;
  not_apt_for_sale: number;
  total_stock: number;
  condition_details: ConditionDetailEntry[] | null;
  products: {
    id: string;
    ml_item_id: string;
    title: string | null;
    thumbnail: string | null;
    sku: string | null;
    status: string | null;
    price: number | null;
    permalink: string | null;
  } | null;
}

interface InventoryViewProps {
  data: InventoryRow[];
  stats: InventoryStats;
  chartData: ChartSlice[];
}

const CONDITION_LABELS: Record<string, string> = {
  available: "Disponível",
  damaged: "Danificado",
  expired: "Expirado",
  lost: "Extraviado",
  in_transfer: "Em Trânsito",
  not_apt_for_sale: "Não Apto p/ Venda",
};

const CONDITION_COLORS: Record<string, string> = {
  available: "#CDFF00",
  damaged: "#FF453A",
  expired: "#636366",
  lost: "#BF5AF2",
  in_transfer: "#64D2FF",
  not_apt_for_sale: "#FF9F0A",
};

export function InventoryView({ data, stats, chartData }: InventoryViewProps) {
  const [activeCondition, setActiveCondition] = useState<string | null>(null);

  // Compute value and units per condition
  const conditionSummary = useMemo(() => {
    if (!activeCondition) return null;

    let units = 0;
    let value = 0;

    for (const row of data) {
      const qty = row[activeCondition as keyof InventoryRow];
      if (typeof qty === "number" && qty > 0) {
        units += qty;
        value += qty * (row.products?.price ?? 0);
      }
    }

    return { units, value };
  }, [activeCondition, data]);

  return (
    <div className="space-y-6">
      <InventoryStatsCards stats={stats} />

      {/* Contextual card — only visible when a condition is selected */}
      {activeCondition && conditionSummary && (
        <div
          className="flex items-center justify-between rounded-lg border px-5 py-4"
          style={{
            borderColor: `${CONDITION_COLORS[activeCondition] ?? "#636366"}40`,
            backgroundColor: `${CONDITION_COLORS[activeCondition] ?? "#636366"}08`,
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-block size-3 shrink-0 rounded-full"
              style={{ backgroundColor: CONDITION_COLORS[activeCondition] ?? "#636366" }}
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {CONDITION_LABELS[activeCondition] ?? activeCondition}
              </p>
              <p className="mt-1 text-lg font-light text-foreground">
                {conditionSummary.units.toLocaleString("pt-BR")} {conditionSummary.units === 1 ? "unidade" : "unidades"}
                <span className="mx-2 text-muted-foreground">—</span>
                <span style={{ color: CONDITION_COLORS[activeCondition] ?? "#636366" }}>
                  {formatCurrency(conditionSummary.value)}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveCondition(null)}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            aria-label="Limpar filtro"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <InventoryChart
            data={chartData}
            activeCondition={activeCondition}
            onSliceClick={setActiveCondition}
          />
        </div>
        <div className="lg:col-span-2">
          <InventoryTable rows={data} activeCondition={activeCondition} />
        </div>
      </div>
    </div>
  );
}
