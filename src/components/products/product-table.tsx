"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CostEditor, type CostData } from "./cost-editor";
import type { Product, MlAccount } from "@/types/database";
import { AlertTriangle, ChevronDown, ChevronRight, ImageOff, Pencil } from "lucide-react";

interface ProductTableProps {
  products: Product[];
  accounts: MlAccount[];
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

function getInitials(nickname: string | null): string {
  if (!nickname) return "ML";
  return nickname.slice(0, 2).toUpperCase();
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

function ListingTypeBadge({ product }: { product: Product }) {
  if (product.catalog_listing) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#64D2FF]/15 px-2 py-0.5 text-xs font-medium text-[#64D2FF]">
        Catálogo
      </span>
    );
  }
  if (product.catalog_product_id) {
    // This is the traditional listing linked to a catalog item
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Clássico
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Clássico
    </span>
  );
}

function AccountAvatar({ account }: { account: MlAccount | undefined }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => setShowTooltip(true), 1000);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!account) return <span className="text-muted-foreground">—</span>;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Avatar>
        <AvatarFallback className="bg-[#CDFF00]/15 text-[#CDFF00] text-[10px] font-semibold">
          {getInitials(account.nickname)}
        </AvatarFallback>
      </Avatar>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-lg">
          <p className="text-xs font-medium text-foreground">
            {account.nickname ?? "Conta ML"}
          </p>
        </div>
      )}
    </div>
  );
}

/** Groups products: catalog items are primary, their traditional linked items become children */
function groupProducts(products: Product[]): {
  primary: Product;
  linked: Product | null;
}[] {
  // Index catalog products by catalog_product_id
  const catalogMap = new Map<string, { catalog: Product; traditional: Product | null }>();
  const standalone: Product[] = [];

  for (const product of products) {
    if (!product.catalog_product_id) {
      standalone.push(product);
      continue;
    }

    const existing = catalogMap.get(product.catalog_product_id);
    if (existing) {
      // Add as the other half of the pair
      if (product.catalog_listing) {
        existing.catalog = product;
      } else {
        existing.traditional = product;
      }
    } else {
      catalogMap.set(product.catalog_product_id, {
        catalog: product.catalog_listing ? product : product,
        traditional: product.catalog_listing ? null : product,
      });
    }
  }

  const grouped: { primary: Product; linked: Product | null }[] = [];

  // Add catalog groups — catalog listing is primary, traditional is linked
  for (const entry of Array.from(catalogMap.values())) {
    if (entry.catalog.catalog_listing) {
      grouped.push({ primary: entry.catalog, linked: entry.traditional });
    } else if (entry.traditional) {
      // Both are traditional (no catalog_listing=true found) — show the first as primary
      grouped.push({ primary: entry.traditional, linked: null });
    } else {
      grouped.push({ primary: entry.catalog, linked: null });
    }
  }

  // Add standalone products
  for (const product of standalone) {
    grouped.push({ primary: product, linked: null });
  }

  return grouped;
}

const TH_CLASS = "px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground";

export function ProductTable({
  products,
  accounts,
  onUpdateCosts,
  selectedIds,
  onSelectionChange,
  onEditProduct,
}: ProductTableProps) {
  const [costEditingProduct, setCostEditingProduct] = useState<Product | null>(null);
  const [expandedCatalogIds, setExpandedCatalogIds] = useState<Set<string>>(new Set());

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const handleSaveCosts = useCallback(
    async (costs: CostData) => {
      if (!costEditingProduct) return;
      await onUpdateCosts(costEditingProduct.id, costs);
    },
    [costEditingProduct, onUpdateCosts]
  );

  const grouped = groupProducts(products);
  const primaryProducts = grouped.map((g) => g.primary);

  const allSelected =
    primaryProducts.length > 0 && primaryProducts.every((p) => selectedIds.includes(p.id));

  const someSelected =
    !allSelected && primaryProducts.some((p) => selectedIds.includes(p.id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onSelectionChange(
        selectedIds.filter((id) => !primaryProducts.some((p) => p.id === id))
      );
    } else {
      const visibleIds = primaryProducts.map((p) => p.id);
      const merged = Array.from(new Set([...selectedIds, ...visibleIds]));
      onSelectionChange(merged);
    }
  }, [allSelected, primaryProducts, selectedIds, onSelectionChange]);

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

  const toggleExpanded = useCallback((productId: string) => {
    setExpandedCatalogIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

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

  function renderProductRow(product: Product, isLinkedRow: boolean) {
    const isSelected = selectedIds.includes(product.id);
    const marginPositive = product.net_margin != null && product.net_margin > 0;
    const marginNegative = product.net_margin != null && product.net_margin < 0;
    const lowStock = product.available_quantity != null && product.available_quantity < 5;
    const linkedItem = !isLinkedRow
      ? grouped.find((g) => g.primary.id === product.id)?.linked
      : null;
    const hasLinked = linkedItem != null;
    const isExpanded = expandedCatalogIds.has(product.id);

    return (
      <tr
        key={product.id}
        className={`border-b border-border transition-colors hover:bg-[#242429] ${
          isSelected ? "bg-[#CDFF00]/5" : ""
        } ${isLinkedRow ? "bg-muted/20" : ""}`}
      >
        {/* Checkbox */}
        <td className="w-10 px-3 py-3 text-center">
          {!isLinkedRow && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleSelectRow(product.id)}
              className="size-4 cursor-pointer rounded border-border accent-[#CDFF00]"
              aria-label={`Selecionar ${product.title ?? product.ml_item_id}`}
            />
          )}
        </td>

        {/* Account avatar */}
        <td className="w-10 px-3 py-3 text-center">
          {!isLinkedRow && (
            <AccountAvatar account={accountMap.get(product.ml_account_id)} />
          )}
        </td>

        {/* Listing type */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            {hasLinked && !isLinkedRow && (
              <button
                onClick={() => toggleExpanded(product.id)}
                className="shrink-0 rounded p-0.5 hover:bg-muted"
                aria-label={isExpanded ? "Recolher" : "Expandir"}
              >
                {isExpanded ? (
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                )}
              </button>
            )}
            {isLinkedRow && <span className="ml-5 text-xs text-muted-foreground/50">└</span>}
            <ListingTypeBadge product={product} />
          </div>
        </td>

        {/* Product (thumbnail + title) */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {product.thumbnail ? (
              <Image
                src={product.thumbnail.replace("http://", "https://")}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-md bg-muted object-cover"
                unoptimized
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

        {/* ML Fee */}
        <td className="px-4 py-3 text-right text-muted-foreground">
          {formatBRL(product.ml_fee)}
        </td>

        {/* Shipping Cost */}
        <td className="px-4 py-3 text-right text-muted-foreground">
          {formatBRL(product.shipping_cost)}
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
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1200px] text-sm">
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
              <th className={`w-10 text-center ${TH_CLASS}`}>
                Conta
              </th>
              <th className={`text-left ${TH_CLASS}`}>
                Tipo
              </th>
              <th className={`text-left ${TH_CLASS}`}>
                Produto
              </th>
              <th className={`text-left ${TH_CLASS}`}>
                SKU
              </th>
              <th className={`text-right ${TH_CLASS}`}>
                Preço
              </th>
              <th className={`text-right ${TH_CLASS}`}>
                Taxa
              </th>
              <th className={`text-right ${TH_CLASS}`}>
                Frete
              </th>
              <th className={`text-right ${TH_CLASS}`}>
                Estoque
              </th>
              <th className={`text-right ${TH_CLASS}`}>
                Custo
              </th>
              <th className={`text-right ${TH_CLASS}`}>
                Margem
              </th>
              <th className={`text-center ${TH_CLASS}`}>
                Status
              </th>
              <th className={`text-center ${TH_CLASS}`}>
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ primary, linked }) => {
              const rows = [renderProductRow(primary, false)];
              if (linked && expandedCatalogIds.has(primary.id)) {
                rows.push(renderProductRow(linked, true));
              }
              return rows;
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
