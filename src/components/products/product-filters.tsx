"use client";

import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import type { MlAccount } from "@/types/database";
import { Search, SlidersHorizontal } from "lucide-react";

export type ProductFilters = {
  search: string;
  accountId: string | null;
  status: string | null;
  sort: string;
};

interface ProductFiltersProps {
  accounts: MlAccount[];
  onFilterChange: (filters: ProductFilters) => void;
}

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "active", label: "Ativo" },
  { value: "paused", label: "Pausado" },
] as const;

const SORT_OPTIONS = [
  { value: "title", label: "Título" },
  { value: "price", label: "Preço" },
  { value: "margin", label: "Margem" },
  { value: "stock", label: "Estoque" },
] as const;

export function ProductFilters({ accounts, onFilterChange }: ProductFiltersProps) {
  const [filters, setFilters] = useState<ProductFilters>({
    search: "",
    accountId: null,
    status: null,
    sort: "title",
  });

  const updateFilter = useCallback(
    (patch: Partial<ProductFilters>) => {
      setFilters((prev) => {
        const next = { ...prev, ...patch };
        onFilterChange(next);
        return next;
      });
    },
    [onFilterChange]
  );

  const selectStyles =
    "h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou SKU..."
          value={filters.search}
          onChange={(e) => updateFilter({ search: e.target.value })}
          className="pl-9"
        />
      </div>

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

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => updateFilter({ sort: e.target.value })}
          className={selectStyles}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
