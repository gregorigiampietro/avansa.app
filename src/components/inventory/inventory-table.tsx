"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { ExternalLink, ImageOff, ChevronRight, ChevronDown } from "lucide-react";
import type { InventoryRow, ConditionDetailEntry } from "./inventory-view";

interface InventoryTableProps {
  rows: InventoryRow[];
  activeCondition: string | null;
}

const CONDITION_LABELS: Record<string, string> = {
  available: "Disponível",
  damaged: "Danificado",
  expired: "Expirado",
  lost: "Extraviado",
  in_transfer: "Em Trânsito",
  not_apt_for_sale: "Não Apto p/ Venda",
  // ML detailed statuses
  not_supported: "Não Suportado",
  withdrawal: "Em Retirada",
  no_fiscal_coverage: "Sem Cobertura Fiscal",
  internal_process: "Processo Interno ML",
  transfer: "Em Transferência",
};

const SUBCONDITION_LABELS: Record<string, string> = {
  arrived_damaged: "Chegou danificado ao centro",
  damaged_in_full: "Danificado no centro Full",
  dimensions_exceeds: "Dimensões excedem o permitido",
  flammable: "Produto inflamável",
  multiple_identifier: "Problema de identificação",
};

const CONDITION_COLORS: Record<string, string> = {
  available: "bg-[#CDFF00]/15 text-[#CDFF00]",
  damaged: "bg-[#FF453A]/15 text-[#FF453A]",
  expired: "bg-[#636366]/15 text-[#636366]",
  lost: "bg-[#BF5AF2]/15 text-[#BF5AF2]",
  in_transfer: "bg-[#64D2FF]/15 text-[#64D2FF]",
  not_apt_for_sale: "bg-[#FF9F0A]/15 text-[#FF9F0A]",
  not_supported: "bg-[#FF9F0A]/15 text-[#FF9F0A]",
  withdrawal: "bg-[#FF9F0A]/15 text-[#FF9F0A]",
  no_fiscal_coverage: "bg-[#FF9F0A]/15 text-[#FF9F0A]",
  internal_process: "bg-[#FF9F0A]/15 text-[#FF9F0A]",
  transfer: "bg-[#64D2FF]/15 text-[#64D2FF]",
};

const CONDITION_BAR_COLORS: Record<string, string> = {
  available: "#CDFF00",
  damaged: "#FF453A",
  expired: "#636366",
  lost: "#BF5AF2",
  in_transfer: "#64D2FF",
  not_apt_for_sale: "#FF9F0A",
  not_supported: "#FF9F0A",
  withdrawal: "#FF9F0A",
  no_fiscal_coverage: "#FF9F0A",
  internal_process: "#FF9F0A",
  transfer: "#64D2FF",
};

function truncate(text: string | null, maxLen: number): string {
  if (!text) return "—";
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

function ConditionBadge({ condition, quantity }: { condition: string; quantity: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_COLORS[condition] ?? "bg-muted text-muted-foreground"}`}
    >
      {quantity.toLocaleString("pt-BR")}
      <span className="opacity-70">{CONDITION_LABELS[condition] ?? condition}</span>
    </span>
  );
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

function ConditionDetailPanel({
  row,
}: {
  row: InventoryRow;
}) {
  const details = (row.condition_details ?? []) as ConditionDetailEntry[];
  const conditions = getConditionsWithQty(row);
  const maxQty = Math.max(...conditions.map((c) => c.quantity), 1);

  // If we have detailed condition_details from the fulfillment API, use those
  // Otherwise fall back to the basic column-level data
  const hasDetailedData = details.length > 0;

  return (
    <div className="px-6 py-4">
      <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Detalhamento do Estoque
        </p>
        <div className="space-y-4">
          {hasDetailedData
            ? details.map((detail) => (
                <DetailBlock
                  key={detail.status}
                  status={detail.status}
                  quantity={detail.quantity}
                  maxQty={maxQty}
                  subconditions={detail.conditions}
                />
              ))
            : conditions
                .filter((c) => c.condition !== "available")
                .map((c) => (
                  <DetailBlock
                    key={c.condition}
                    status={c.condition}
                    quantity={c.quantity}
                    maxQty={maxQty}
                  />
                ))}
        </div>
      </div>
    </div>
  );
}

function DetailBlock({
  status,
  quantity,
  maxQty,
  subconditions,
}: {
  status: string;
  quantity: number;
  maxQty: number;
  subconditions?: Array<{ condition: string; quantity: number }>;
}) {
  const barWidth = Math.max((quantity / maxQty) * 100, 4);
  const barColor = CONDITION_BAR_COLORS[status] ?? "#636366";
  const label = CONDITION_LABELS[status] ?? status;

  return (
    <div>
      {/* Main condition */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {quantity.toLocaleString("pt-BR")} {quantity === 1 ? "unidade" : "unidades"}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/40">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${barWidth}%`, backgroundColor: barColor }}
        />
      </div>

      {/* Subconditions */}
      {subconditions && subconditions.length > 0 && (
        <div className="mt-2 ml-3 space-y-1.5 border-l border-border/50 pl-3">
          {subconditions.map((sub, idx) => {
            const isLast = idx === subconditions.length - 1;
            const subLabel = SUBCONDITION_LABELS[sub.condition] ?? sub.condition;

            return (
              <div key={sub.condition} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {isLast ? "└" : "├"} {subLabel}
                </span>
                <span className="text-xs font-medium text-foreground">
                  {sub.quantity.toLocaleString("pt-BR")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getConditionsWithQty(row: InventoryRow): { condition: string; quantity: number }[] {
  const conditions: { condition: string; quantity: number }[] = [];
  if (row.available > 0) conditions.push({ condition: "available", quantity: row.available });
  if (row.damaged > 0) conditions.push({ condition: "damaged", quantity: row.damaged });
  if (row.expired > 0) conditions.push({ condition: "expired", quantity: row.expired });
  if (row.lost > 0) conditions.push({ condition: "lost", quantity: row.lost });
  if (row.in_transfer > 0) conditions.push({ condition: "in_transfer", quantity: row.in_transfer });
  if (row.not_apt_for_sale > 0) conditions.push({ condition: "not_apt_for_sale", quantity: row.not_apt_for_sale });
  return conditions;
}

export function InventoryTable({ rows, activeCondition }: InventoryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  // Filter rows based on active condition
  const filteredRows = activeCondition
    ? rows.filter((row) => {
        const key = activeCondition as keyof typeof row;
        const value = row[key];
        return typeof value === "number" && value > 0;
      })
    : rows;

  if (filteredRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
        <ImageOff className="mb-3 size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          {activeCondition
            ? `Nenhum produto com condição "${CONDITION_LABELS[activeCondition] ?? activeCondition}"`
            : "Nenhum dado de estoque encontrado"}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="w-8 px-2 py-3" />
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Produto
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              SKU
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Disponível
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Condições
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th className="w-10 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => {
            const product = row.products;
            const conditions = getConditionsWithQty(row);
            const hasIssue = conditions.some((c) => c.condition !== "available");
            const isExpanded = expandedRows.has(row.id);

            return (
              <>
                <tr
                  key={row.id}
                  className={`border-b border-border transition-colors hover:bg-[#242429] ${
                    hasIssue ? "bg-[#FF453A]/[0.02]" : ""
                  } ${hasIssue ? "cursor-pointer" : ""}`}
                  onClick={hasIssue ? () => toggleRow(row.id) : undefined}
                >
                  {/* Expand chevron */}
                  <td className="w-8 px-2 py-3 text-center">
                    {hasIssue && (
                      <span className="inline-flex text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </span>
                    )}
                  </td>

                  {/* Product */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product?.thumbnail ? (
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
                        title={product?.title ?? undefined}
                      >
                        {truncate(product?.title ?? null, 35)}
                      </span>
                    </div>
                  </td>

                  {/* SKU */}
                  <td className="px-4 py-3 text-muted-foreground">
                    {product?.sku ?? "—"}
                  </td>

                  {/* Available */}
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {row.available.toLocaleString("pt-BR")}
                  </td>

                  {/* Total */}
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {row.total_stock.toLocaleString("pt-BR")}
                  </td>

                  {/* Conditions */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {conditions.map((c) => (
                        <ConditionBadge key={c.condition} condition={c.condition} quantity={c.quantity} />
                      ))}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={product?.status ?? null} />
                  </td>

                  {/* Link */}
                  <td className="px-4 py-3 text-center">
                    {product?.permalink && (
                      <a
                        href={product.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-muted-foreground hover:text-foreground"
                        title="Ver no Mercado Livre"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                  </td>
                </tr>

                {/* Expanded detail row */}
                {isExpanded && hasIssue && (
                  <tr key={`${row.id}-detail`} className="border-b border-border bg-[#1a1a1e]">
                    <td colSpan={8}>
                      <ConditionDetailPanel row={row} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
