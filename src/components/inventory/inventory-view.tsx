"use client";

import { useMemo, useState } from "react";
import { InventoryStatsCards, type InventoryStats } from "./inventory-stats-cards";
import { InventoryChart, type ChartSlice } from "./inventory-chart";
import { InventoryTable } from "./inventory-table";
import type { MlAccount } from "@/types/database";

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
  accounts: MlAccount[];
}

function getInitials(nickname: string | null): string {
  if (!nickname) return "ML";
  return nickname.slice(0, 2).toUpperCase();
}

export function InventoryView({ data, stats, chartData, accounts }: InventoryViewProps) {
  const [activeCondition, setActiveCondition] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    if (!selectedAccountId) return data;
    return data.filter((row) => row.ml_account_id === selectedAccountId);
  }, [data, selectedAccountId]);

  return (
    <div className="space-y-6">
      <InventoryStatsCards stats={stats} />

      {/* Account filter */}
      {accounts.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Conta:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedAccountId(null)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selectedAccountId === null
                  ? "border-[#CDFF00]/50 bg-[#CDFF00]/10 text-[#CDFF00]"
                  : "border-border text-muted-foreground hover:border-border/80"
              }`}
            >
              Todas
            </button>
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() =>
                  setSelectedAccountId(
                    selectedAccountId === account.id ? null : account.id
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedAccountId === account.id
                    ? "border-[#CDFF00]/50 bg-[#CDFF00]/10 text-[#CDFF00]"
                    : "border-border text-muted-foreground hover:border-border/80"
                }`}
              >
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#CDFF00]/15 text-[8px] font-semibold text-[#CDFF00]">
                  {getInitials(account.nickname)}
                </span>
                {account.nickname ?? `Conta ${account.ml_user_id}`}
              </button>
            ))}
          </div>
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
          <InventoryTable
            rows={filteredData}
            accounts={accounts}
            activeCondition={activeCondition}
          />
        </div>
      </div>
    </div>
  );
}
