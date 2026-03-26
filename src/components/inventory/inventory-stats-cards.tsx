import { Package, CheckCircle, AlertTriangle, ShieldAlert } from "lucide-react";

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
  const cards = [
    {
      label: "Estoque Total",
      value: stats.totalStock.toLocaleString("pt-BR"),
      icon: Package,
      color: null,
    },
    {
      label: "Disponível",
      value: stats.available.toLocaleString("pt-BR"),
      icon: CheckCircle,
      color: "text-[#CDFF00]",
    },
    {
      label: "Indisponível",
      value: stats.unavailable.toLocaleString("pt-BR"),
      icon: AlertTriangle,
      color: stats.unavailable > 0 ? "text-[#FF9F0A]" : null,
    },
    {
      label: "Produtos em Risco",
      value: stats.atRiskCount.toLocaleString("pt-BR"),
      icon: ShieldAlert,
      color: stats.atRiskCount > 0 ? "text-[#FF453A]" : null,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </span>
            <card.icon className="size-4 text-muted-foreground" />
          </div>
          <p
            className={`mt-3 text-2xl font-light tracking-tight ${card.color ?? "text-foreground"}`}
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
