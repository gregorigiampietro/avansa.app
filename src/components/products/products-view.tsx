"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProductFilters, type ProductFilters as Filters } from "./product-filters";
import { ProductTable } from "./product-table";
import { ProductEditSheet } from "./product-edit-sheet";
import { BulkActions } from "./bulk-actions";
import type { CostData } from "./cost-editor";
import type { Product, MlAccount } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

interface ProductsViewProps {
  initialProducts: Product[];
  accounts: MlAccount[];
}

export function ProductsView({ initialProducts, accounts }: ProductsViewProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    accountId: null,
    status: null,
    sort: "title",
  });
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Edit sheet state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  // Client-side filtering and sorting
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query)
      );
    }

    // Account filter
    if (filters.accountId) {
      result = result.filter((p) => p.ml_account_id === filters.accountId);
    }

    // Status filter
    if (filters.status) {
      result = result.filter((p) => p.status === filters.status);
    }

    // Sort
    result.sort((a, b) => {
      switch (filters.sort) {
        case "price":
          return (b.price ?? 0) - (a.price ?? 0);
        case "margin":
          return (b.margin_percent ?? -Infinity) - (a.margin_percent ?? -Infinity);
        case "stock":
          return (a.available_quantity ?? 0) - (b.available_quantity ?? 0);
        default:
          return (a.title ?? "").localeCompare(b.title ?? "", "pt-BR");
      }
    });

    return result;
  }, [products, filters]);

  const refreshProducts = useCallback(async () => {
    try {
      const response = await fetch("/api/ml/products");
      if (response.ok) {
        const { data } = await response.json();
        setProducts(data ?? []);
      }
    } catch {
      toast.error("Erro ao recarregar produtos");
    }
  }, []);

  const handleUpdateCosts = useCallback(
    async (productId: string, costs: CostData) => {
      const response = await fetch(`/api/ml/products/${productId}/costs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(costs),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error ?? "Erro ao salvar custos");
        throw new Error(data.error ?? "Erro ao salvar custos");
      }

      const { data: updatedProduct } = await response.json();

      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, ...updatedProduct } : p))
      );

      toast.success("Custos salvos com sucesso");
    },
    []
  );

  const handleSync = useCallback(
    async (accountId: string) => {
      setSyncingAccountId(accountId);
      try {
        const response = await fetch("/api/ml/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Erro ao sincronizar");
        }

        await refreshProducts();
        toast.success("Produtos sincronizados com sucesso");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Erro ao sincronizar produtos"
        );
      } finally {
        setSyncingAccountId(null);
      }
    },
    [refreshProducts]
  );

  const handleEditProduct = useCallback((product: Product) => {
    setEditingProduct(product);
    setEditSheetOpen(true);
  }, []);

  const handleEditSaved = useCallback(() => {
    refreshProducts();
  }, [refreshProducts]);

  const handleEditSheetOpenChange = useCallback((open: boolean) => {
    setEditSheetOpen(open);
    if (!open) {
      setEditingProduct(null);
    }
  }, []);

  const handleBulkComplete = useCallback(() => {
    refreshProducts();
  }, [refreshProducts]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const activeAccounts = accounts.filter((a) => a.status === "active");

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
              Sincronizar{" "}
              {account.nickname ?? `Conta ${account.ml_user_id}`}
            </Button>
          ))}
        </div>
      )}

      {/* Filters */}
      <ProductFilters accounts={accounts} onFilterChange={setFilters} />

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          {filteredProducts.length}{" "}
          {filteredProducts.length === 1 ? "produto" : "produtos"}
        </span>
        {selectedIds.length > 0 && (
          <span className="text-[#CDFF00]">
            ({selectedIds.length} selecionado{selectedIds.length !== 1 ? "s" : ""})
          </span>
        )}
      </div>

      {/* Table */}
      <ProductTable
        products={filteredProducts}
        onUpdateCosts={handleUpdateCosts}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onEditProduct={handleEditProduct}
      />

      {/* Add bottom padding when bulk bar is visible */}
      {selectedIds.length > 0 && <div className="h-16" />}

      {/* Edit sheet */}
      <ProductEditSheet
        product={editingProduct}
        open={editSheetOpen}
        onOpenChange={handleEditSheetOpenChange}
        onSaved={handleEditSaved}
      />

      {/* Bulk actions bar */}
      <BulkActions
        selectedIds={selectedIds}
        onComplete={handleBulkComplete}
        onClear={handleClearSelection}
      />
    </div>
  );
}
