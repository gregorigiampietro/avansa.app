"use client";

import { useCallback, useMemo, useState } from "react";
import { OrderTable } from "./order-table";
import type { Order, MlAccount } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, SlidersHorizontal } from "lucide-react";

interface OrdersViewProps {
  initialOrders: Order[];
  accounts: MlAccount[];
}

type OrderFilters = {
  accountId: string | null;
  status: string | null;
  period: string | null;
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "paid", label: "Pago" },
  { value: "confirmed", label: "Confirmado" },
  { value: "cancelled", label: "Cancelado" },
] as const;

const PERIOD_OPTIONS = [
  { value: "", label: "Todo o período" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
] as const;

export function OrdersView({ initialOrders, accounts }: OrdersViewProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filters, setFilters] = useState<OrderFilters>({
    accountId: null,
    status: null,
    period: null,
  });
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateFilter = useCallback(
    (patch: Partial<OrderFilters>) => {
      const next = { ...filters, ...patch };
      setFilters(next);
      fetchOrders(next);
    },
    [filters]
  );

  const fetchOrders = useCallback(async (f: OrderFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.accountId) params.set("accountId", f.accountId);
      if (f.status) params.set("status", f.status);
      if (f.period) params.set("period", f.period);
      params.set("pageSize", "100");

      const response = await fetch(`/api/ml/orders?${params.toString()}`);
      if (response.ok) {
        const { data } = await response.json();
        setOrders(data ?? []);
      }
    } catch (err) {
      console.error("Erro ao buscar pedidos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSync = useCallback(
    async (accountId: string) => {
      setSyncingAccountId(accountId);
      try {
        const response = await fetch("/api/ml/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Erro ao sincronizar pedidos");
        }

        // Reload orders after sync
        await fetchOrders(filters);
      } catch (err) {
        console.error("Erro no sync de pedidos:", err);
      } finally {
        setSyncingAccountId(null);
      }
    },
    [filters, fetchOrders]
  );

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.status === "active"),
    [accounts]
  );

  const selectStyles =
    "h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Sync buttons */}
      {activeAccounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeAccounts.map((account) => (
            <Button
              key={account.id}
              variant="outline"
              size="sm"
              disabled={syncingAccountId !== null}
              onClick={() => handleSync(account.id)}
            >
              {syncingAccountId === account.id ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Sincronizar vendas{" "}
              {account.nickname ?? `Conta ${account.ml_user_id}`}
            </Button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="size-4 text-muted-foreground sm:hidden" />

          {/* Account filter */}
          {accounts.length > 1 && (
            <select
              value={filters.accountId ?? ""}
              onChange={(e) =>
                updateFilter({ accountId: e.target.value || null })
              }
              className={selectStyles}
            >
              <option value="">Todas as contas</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.nickname ?? acc.email ?? `Conta ${acc.ml_user_id}`}
                </option>
              ))}
            </select>
          )}

          {/* Period filter */}
          <select
            value={filters.period ?? ""}
            onChange={(e) =>
              updateFilter({ period: e.target.value || null })
            }
            className={selectStyles}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filters.status ?? ""}
            onChange={(e) =>
              updateFilter({ status: e.target.value || null })
            }
            className={selectStyles}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          {orders.length} {orders.length === 1 ? "venda" : "vendas"}
        </span>
        {loading && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Table */}
      <OrderTable orders={orders} />
    </div>
  );
}
