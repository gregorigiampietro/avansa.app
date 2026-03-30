"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { OrderTable } from "./order-table";
import { OrderStatsCards } from "./order-stats-cards";
import { OrderDatePicker } from "./order-date-picker";
import {
  SavedFilters,
  loadLastFilter,
  saveLastFilter,
  type SavedFilterValues,
} from "./saved-filters";
import type { Order, MlAccount } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OrdersViewProps {
  initialOrders: Order[];
  accounts: MlAccount[];
}

type OrderFilters = {
  accountId: string | null;
  status: string | null;
  period: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  search: string | null;
  page: number;
  pageSize: number;
  sortField: string | null;
  sortDirection: "asc" | "desc";
  groupBy: string | null;
};

type PaginationInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "payment_required", label: "Pagamento pendente" },
  { value: "payment_in_process", label: "Em processamento" },
  { value: "partially_paid", label: "Parcialmente pago" },
  { value: "paid", label: "Pago" },
  { value: "cancelled", label: "Cancelado" },
  { value: "invalid", label: "Invalido" },
] as const;

const PERIOD_PRESETS = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
] as const;

export function OrdersView({ initialOrders, accounts }: OrdersViewProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filters, setFilters] = useState<OrderFilters>({
    accountId: null,
    status: null,
    period: null,
    dateFrom: null,
    dateTo: null,
    search: null,
    page: 1,
    pageSize: 50,
    sortField: null,
    sortDirection: "desc",
    groupBy: null,
  });
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 50,
    total: initialOrders.length,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOrders = useCallback(async (f: OrderFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.accountId) params.set("accountId", f.accountId);
      if (f.status) params.set("status", f.status);
      if (f.dateFrom || f.dateTo) {
        if (f.dateFrom) params.set("dateFrom", f.dateFrom);
        if (f.dateTo) params.set("dateTo", f.dateTo);
      } else if (f.period) {
        params.set("period", f.period);
      }
      if (f.search) params.set("search", f.search);
      if (f.sortField) {
        params.set("sortField", f.sortField);
        params.set("sortDirection", f.sortDirection);
      }
      params.set("page", String(f.page));
      params.set("pageSize", String(f.pageSize));

      const response = await fetch(`/api/ml/orders?${params.toString()}`);
      if (response.ok) {
        const json = await response.json();
        setOrders(json.data ?? []);
        if (json.pagination) {
          setPagination(json.pagination);
        }
      }
    } catch {
      toast.error("Erro ao buscar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore last filter from localStorage on mount
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    const last = loadLastFilter();
    if (!last) return;
    const restored: OrderFilters = {
      accountId: last.accountId ?? null,
      status: last.status ?? null,
      period: last.period ?? null,
      dateFrom: last.dateFrom ?? null,
      dateTo: last.dateTo ?? null,
      search: last.search ?? null,
      page: 1,
      pageSize: 50,
      sortField: last.sortField ?? null,
      sortDirection: last.sortDirection ?? "desc",
      groupBy: last.groupBy ?? null,
    };
    if (last.search) setSearchInput(last.search);
    setFilters(restored);
    fetchOrders(restored);
  }, [fetchOrders]);

  const updateFilter = useCallback(
    (patch: Partial<OrderFilters>) => {
      const next = { ...filters, ...patch, page: patch.page ?? 1 };
      setFilters(next);
      fetchOrders(next);
      saveLastFilter({
        accountId: next.accountId,
        period: next.period,
        dateFrom: next.dateFrom,
        dateTo: next.dateTo,
        status: next.status,
        search: next.search,
        groupBy: next.groupBy,
        sortField: next.sortField,
        sortDirection: next.sortDirection,
      });
    },
    [filters, fetchOrders]
  );

  // Date range picker state
  const dateRange: DateRange | undefined = useMemo(() => {
    if (!filters.dateFrom && !filters.dateTo) return undefined;
    return {
      from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      to: filters.dateTo ? new Date(filters.dateTo) : undefined,
    };
  }, [filters.dateFrom, filters.dateTo]);

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      if (!range?.from) {
        updateFilter({ dateFrom: null, dateTo: null, period: null });
        return;
      }
      const dateFrom = range.from.toISOString();
      // Set dateTo to end of day if present
      const dateTo = range.to
        ? new Date(
            range.to.getFullYear(),
            range.to.getMonth(),
            range.to.getDate(),
            23,
            59,
            59,
            999
          ).toISOString()
        : null;
      updateFilter({ dateFrom, dateTo, period: null });
    },
    [updateFilter]
  );

  const handlePeriodPreset = useCallback(
    (period: string) => {
      updateFilter({ period, dateFrom: null, dateTo: null });
    },
    [updateFilter]
  );

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        updateFilter({ search: value || null });
      }, 400);
    },
    [updateFilter]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleSort = useCallback(
    (field: string) => {
      const isSameField = filters.sortField === field;
      const nextDirection = isSameField
        ? filters.sortDirection === "asc"
          ? "desc"
          : "asc"
        : "asc";
      updateFilter({ sortField: field, sortDirection: nextDirection });
    },
    [filters.sortField, filters.sortDirection, updateFilter]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      const next = { ...filters, page };
      setFilters(next);
      fetchOrders(next);
    },
    [filters, fetchOrders]
  );

  const handleApplySavedFilter = useCallback(
    (saved: SavedFilterValues) => {
      const next: OrderFilters = {
        accountId: saved.accountId ?? null,
        status: saved.status ?? null,
        period: saved.period ?? null,
        dateFrom: saved.dateFrom ?? null,
        dateTo: saved.dateTo ?? null,
        search: saved.search ?? null,
        page: 1,
        pageSize: 50,
        sortField: saved.sortField ?? null,
        sortDirection: saved.sortDirection ?? "desc",
        groupBy: saved.groupBy ?? null,
      };
      setSearchInput(saved.search ?? "");
      setFilters(next);
      fetchOrders(next);
      saveLastFilter(saved);
    },
    [fetchOrders]
  );

  const selectStyles =
    "h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Saved Filters */}
      <SavedFilters
        currentFilters={{
          accountId: filters.accountId,
          period: filters.period,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          status: filters.status,
          search: filters.search,
          groupBy: filters.groupBy,
          sortField: filters.sortField,
          sortDirection: filters.sortDirection,
        }}
        onApplyFilter={handleApplySavedFilter}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Row 1: Account + Status + Search */}
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

          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por produto ou comprador..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Row 2: Period presets + Date range picker + GroupBy */}
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              variant="outline"
              size="sm"
              className={`h-8 text-xs ${
                filters.period === preset.value && !filters.dateFrom
                  ? "border-[#CDFF00]/50 bg-[#CDFF00]/10 text-[#CDFF00]"
                  : ""
              }`}
              onClick={() => handlePeriodPreset(preset.value)}
            >
              {preset.label}
            </Button>
          ))}

          <OrderDatePicker
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
          />

          {(filters.period || filters.dateFrom || filters.dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() =>
                updateFilter({ period: null, dateFrom: null, dateTo: null })
              }
            >
              Limpar periodo
            </Button>
          )}

          <div className="ml-auto">
            <Select
              value={filters.groupBy ?? "none"}
              onValueChange={(val) =>
                updateFilter({ groupBy: val === "none" ? null : val })
              }
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="Agrupar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem agrupamento</SelectItem>
                <SelectItem value="day">Por dia</SelectItem>
                <SelectItem value="product">Por produto</SelectItem>
                <SelectItem value="account">Por conta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <OrderStatsCards orders={orders} />

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          {pagination.total} {pagination.total === 1 ? "venda" : "vendas"} no
          total
        </span>
        {loading && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Table */}
      <OrderTable
        orders={orders}
        sortField={filters.sortField}
        sortDirection={filters.sortDirection}
        onSort={handleSort}
        pagination={pagination}
        onPageChange={handlePageChange}
        groupBy={filters.groupBy}
        accounts={accounts}
      />
    </div>
  );
}
