"use client";

import Image from "next/image";
import { ExternalLink, ImageOff } from "lucide-react";
import type { InventoryRow } from "./inventory-view";

interface InventoryTableProps {
  rows: InventoryRow[];
  activeCondition: string | null;
}

const CONDITION_LABELS: Record<string, string> = {
  available: "Disponível",
  damaged: "Danificado",
  expired: "Expirado",
  lost: "Perdido",
  in_transfer: "Em Trânsito",
  not_apt_for_sale: "Não Apto p/ Venda",
};

const CONDITION_COLORS: Record<string, string> = {
  available: "bg-[#CDFF00]/15 text-[#CDFF00]",
  damaged: "bg-[#FF453A]/15 text-[#FF453A]",
  expired: "bg-[#636366]/15 text-[#636366]",
  lost: "bg-[#BF5AF2]/15 text-[#BF5AF2]",
  in_transfer: "bg-[#64D2FF]/15 text-[#64D2FF]",
  not_apt_for_sale: "bg-[#FF9F0A]/15 text-[#FF9F0A]",
};

function truncate(text: string | null, maxLen: number): string {
  if (!text) return "—";
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

function ConditionBadge({ condition }: { condition: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_COLORS[condition] ?? "bg-muted text-muted-foreground"}`}
    >
      {CONDITION_LABELS[condition] ?? condition}
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

export function InventoryTable({ rows, activeCondition }: InventoryTableProps) {
  // Filter rows based on active condition
  const filteredRows = activeCondition
    ? rows.filter((row) => {
        const key = activeCondition as keyof typeof row;
        const value = row[key];
        return typeof value === "number" && value > 0;
      })
    : rows;

  // Determine which non-available conditions each row has
  function getConditions(row: InventoryRow): string[] {
    const conditions: string[] = [];
    if (row.available > 0) conditions.push("available");
    if (row.damaged > 0) conditions.push("damaged");
    if (row.expired > 0) conditions.push("expired");
    if (row.lost > 0) conditions.push("lost");
    if (row.in_transfer > 0) conditions.push("in_transfer");
    if (row.not_apt_for_sale > 0) conditions.push("not_apt_for_sale");
    return conditions;
  }

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
            const conditions = getConditions(row);
            const hasIssue = conditions.some((c) => c !== "available");

            return (
              <tr
                key={row.id}
                className={`border-b border-border transition-colors hover:bg-[#242429] ${
                  hasIssue ? "bg-[#FF453A]/[0.02]" : ""
                }`}
              >
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
                    {conditions.map((condition) => (
                      <ConditionBadge key={condition} condition={condition} />
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
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
