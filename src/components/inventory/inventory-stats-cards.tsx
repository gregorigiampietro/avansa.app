"use client";

import { useState } from "react";
import { Package, CheckCircle, AlertTriangle, ShieldAlert, Info, X } from "lucide-react";

export interface InventoryStats {
  totalStock: number;
  available: number;
  unavailable: number;
  atRiskCount: number;
}

interface InventoryStatsCardsProps {
  stats: InventoryStats;
}

export function InventoryStatsCards({ stats }: InventoryStatsCardsProps) {
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  const cards = [
    {
      label: "Estoque Total",
      value: stats.totalStock.toLocaleString("pt-BR"),
      icon: Package,
      color: null,
      tooltip:
        "Soma de todas as unidades em todas as condições: disponíveis, em trânsito, danificados, perdidos, expirados e não aptos para venda.",
    },
    {
      label: "Disponível",
      value: stats.available.toLocaleString("pt-BR"),
      icon: CheckCircle,
      color: "text-[#CDFF00]",
      tooltip:
        "Unidades prontas para venda. Estão no estoque (seu ou do Full) e podem ser compradas imediatamente.",
    },
    {
      label: "Indisponível",
      value: stats.unavailable.toLocaleString("pt-BR"),
      icon: AlertTriangle,
      color: stats.unavailable > 0 ? "text-[#FF9F0A]" : null,
      tooltip:
        "Unidades que existem no estoque mas não podem ser vendidas. Inclui: danificados (dano físico no centro de distribuição), em trânsito (movendo entre centros), perdidos (extraviados), expirados (validade vencida) e não aptos para venda (problema de qualidade ou embalagem).",
    },
    {
      label: "Produtos com Baixo Estoque",
      value: stats.atRiskCount.toLocaleString("pt-BR"),
      icon: ShieldAlert,
      color: stats.atRiskCount > 0 ? "text-[#FF453A]" : null,
      tooltip:
        "Quantidade de produtos com menos de 5 unidades disponíveis. Estes podem esgotar em breve e precisam de reposição.",
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="relative rounded-lg border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {card.label}
              </span>
              <button
                onClick={() =>
                  setOpenTooltip(openTooltip === card.label ? null : card.label)
                }
                className="rounded-full p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                aria-label={`Info sobre ${card.label}`}
              >
                <Info className="size-3" />
              </button>
            </div>
            <card.icon className="size-4 text-muted-foreground" />
          </div>
          <p
            className={`mt-3 text-2xl font-light tracking-tight ${card.color ?? "text-foreground"}`}
          >
            {card.value}
          </p>

          {/* Tooltip */}
          {openTooltip === card.label && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border bg-popover p-3 shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {card.tooltip}
                </p>
                <button
                  onClick={() => setOpenTooltip(null)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
