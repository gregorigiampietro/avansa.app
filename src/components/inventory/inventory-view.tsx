"use client";

import { useState } from "react";
import { InventoryStatsCards, type InventoryStats } from "./inventory-stats-cards";
import { InventoryChart, type ChartSlice } from "./inventory-chart";
import { InventoryTable } from "./inventory-table";

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

export function InventoryView({ data, stats, chartData }: InventoryViewProps) {
  const [activeCondition, setActiveCondition] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <InventoryStatsCards stats={stats} />

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
