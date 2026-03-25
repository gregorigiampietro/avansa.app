"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CostEditor, type CostData } from "./cost-editor";
import type { Product } from "@/types/database";
import { AlertTriangle, ImageOff, Pencil } from "lucide-react";

interface ProductTableProps {
  products: Product[];
  onUpdateCosts: (id: string, costs: CostData) => Promise<void>;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEditProduct: (product: Product) => void;
}

function formatBRL(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function truncate(text: string | null, maxLen: number): string {
  if (!text) return "—";
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

function StatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center rounded-full bg-[#CDFF00]/15 px-2 py-0.5 text-xs font-medium text-[#CDFF00]">
          Ativo
        </span>
      );
    case "paused":
      return (
        <span className="inline-flex items-center rounded-full bg-[#FF9F0A]/15 px-2 py-0.5 text-xs font-medium text-[#FF9F0A]">
          Pausado
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {status === "closed" ? "Encerrado" : (status ?? "—")}
        </span>
      );
  }
}

export function ProductTable({
  products,
  onUpdateCosts,
  selectedIds,
  onSelectionChange,
  onEditProduct,
}: ProductTableProps) {
  const [costEditingProduct, setCostEditingProduct] = useState<Product | null>(null);

  const handleSaveCosts = useCallback(
    async (costs: CostData) => {
      if (!costEditingProduct) return;
      await onUpdateCosts(costEditingProduct.id, costs);
    },
    [costEditingProduct, onUpdateCosts]
  );

  const allSelected =
    products.length > 0 && products.every((p) => selectedIds.includes(p.id));

  const someSelected =
    !allSelected && products.some((p) => selectedIds.includes(p.id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      // Deselect all currently visible products
      onSelectionChange(
        selectedIds.filter((id) => !products.some((p) => p.id === id))
      );
    } else {
      // Select all visible products (keeping existing selections from other pages/filters)
      const visibleIds = products.map((p) => p.id);
      const merged = Array.from(new Set([...selectedIds, ...visibleIds]));
      onSelectionChange(merged);
    }
  }, [allSelected, products, selectedIds, onSelectionChange]);

  const handleSelectRow = useCallback(
    (productId: string) => {
      if (selectedIds.includes(productId)) {
        onSelectionChange(selectedIds.filter((id) => id !== productId));
      } else {
        onSelectionChange([...selectedIds, productId]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
        <ImageOff className="mb-3 size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Nenhum produto encontrado com os filtros aplicados.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {/* Checkbox header */}
              <th className="w-10 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={handleSelectAll}
                  className="size-4 cursor-pointer rounded border-border accent-[#CDFF00]"
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Produto
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                SKU
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Preço
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Estoque
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Custo
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Margem
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const isSelected = selectedIds.includes(product.id);
              const marginPositive =
                product.net_margin != null && product.net_margin > 0;
              const marginNegative =
                product.net_margin != null && product.net_margin < 0;
              const lowStock =
                product.available_quantity != null &&
                product.available_quantity < 5;

              return (
                <tr
                  key={product.id}
                  className={`border-b border-border transition-colors hover:bg-[#242429] ${
                    isSelected ? "bg-[#CDFF00]/5" : ""
                  }`}
                >
                  {/* Checkbox */}
                  <td className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectRow(product.id)}
                      className="size-4 cursor-pointer rounded border-border accent-[#CDFF00]"
                      aria-label={`Selecionar ${product.title ?? product.ml_item_id}`}
                    />
                  </td>

                  {/* Product (thumbnail + title) */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.thumbnail ? (
                        <img
                          src={product.thumbnail.replace("http://", "https://")}
                          alt=""
                          className="size-10 shrink-0 rounded-md bg-muted object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                          <ImageOff className="size-4 text-muted-foreground" />
                        </div>
                      )}
                      <span
                        className="font-medium text-foreground"
                        title={product.title ?? undefined}
                      >
                        {truncate(product.title, 40)}
                      </span>
                    </div>
                  </td>

                  {/* SKU */}
                  <td className="px-4 py-3 text-muted-foreground">
                    {product.sku ?? "—"}
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {formatBRL(product.price)}
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-foreground">
                        {product.available_quantity ?? "—"}
                      </span>
                      {lowStock && (
                        <AlertTriangle className="size-3.5 text-[#FF9F0A]" />
                      )}
                    </div>
                  </td>

                  {/* Cost */}
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {product.cost_price != null
                      ? formatBRL(product.cost_price)
                      : (
                        <button
                          onClick={() => setCostEditingProduct(product)}
                          className="text-xs text-[#CDFF00]/70 underline-offset-2 hover:underline"
                        >
                          Definir
                        </button>
                      )}
                  </td>

                  {/* Margin */}
                  <td className="px-4 py-3 text-right">
                    {product.net_margin != null ? (
                      <div className="flex items-center justify-end gap-2">
                        <span
                          className={
                            marginPositive
                              ? "text-[#CDFF00]"
                              : marginNegative
                                ? "text-[#FF453A]"
                                : "text-muted-foreground"
                          }
                        >
                          {formatBRL(product.net_margin)}
                        </span>
                        {product.margin_percent != null && (
                          <Badge
                            variant="secondary"
                            className={
                              marginPositive
                                ? "bg-[#CDFF00]/15 text-[#CDFF00]"
                                : marginNegative
                                  ? "bg-[#FF453A]/15 text-[#FF453A]"
                                  : ""
                            }
                          >
                            {product.margin_percent.toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={product.status} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEditProduct(product)}
                        title="Editar produto"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {product.cost_price != null && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setCostEditingProduct(product)}
                          title="Editar custos"
                          className="text-muted-foreground"
                        >
                          <span className="text-xs">R$</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cost editor sheet */}
      {costEditingProduct && (
        <CostEditor
          product={costEditingProduct}
          open={!!costEditingProduct}
          onOpenChange={(open) => {
            if (!open) setCostEditingProduct(null);
          }}
          onSave={handleSaveCosts}
        />
      )}
    </>
  );
}
