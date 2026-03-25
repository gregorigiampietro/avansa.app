"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { Product } from "@/types/database";
import { Loader2 } from "lucide-react";

export type CostData = {
  cost_price: number | null;
  packaging_cost: number | null;
  other_costs: number | null;
};

interface CostEditorProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (costs: CostData) => Promise<void>;
}

function formatBRL(value: number | null | undefined): string {
  if (value == null) return "R$ 0,00";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseMoneyInput(value: string): number | null {
  const cleaned = value.replace(/[^\d,.]/g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export function CostEditor({
  product,
  open,
  onOpenChange,
  onSave,
}: CostEditorProps) {
  const [costPrice, setCostPrice] = useState(
    product.cost_price?.toString() ?? ""
  );
  const [packagingCost, setPackagingCost] = useState(
    product.packaging_cost?.toString() ?? ""
  );
  const [otherCosts, setOtherCosts] = useState(
    product.other_costs?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);

  const margin = useMemo(() => {
    const price = product.price ?? 0;
    const cost = parseMoneyInput(costPrice) ?? 0;
    const packaging = parseMoneyInput(packagingCost) ?? 0;
    const other = parseMoneyInput(otherCosts) ?? 0;
    const mlFee = product.ml_fee ?? 0;
    const shipping = product.shipping_cost ?? 0;

    const netMargin = price - cost - packaging - other - mlFee - shipping;
    const marginPercent = price > 0 ? (netMargin / price) * 100 : 0;

    return { netMargin, marginPercent };
  }, [costPrice, packagingCost, otherCosts, product.price, product.ml_fee, product.shipping_cost]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({
        cost_price: parseMoneyInput(costPrice),
        packaging_cost: parseMoneyInput(packagingCost),
        other_costs: parseMoneyInput(otherCosts),
      });
      onOpenChange(false);
    } catch {
      // Error is handled by parent
    } finally {
      setSaving(false);
    }
  }, [costPrice, packagingCost, otherCosts, onSave, onOpenChange]);

  const marginColor =
    margin.netMargin > 0
      ? "text-[#CDFF00]"
      : margin.netMargin < 0
        ? "text-[#FF453A]"
        : "text-muted-foreground";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar custos</SheetTitle>
          <SheetDescription className="line-clamp-2">
            {product.title ?? "Produto sem título"}
          </SheetDescription>
          <p className="text-sm font-medium text-foreground">
            Preço atual: {formatBRL(product.price)}
          </p>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 px-4">
          {/* Cost inputs */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cost-price">Custo de aquisição</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id="cost-price"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="packaging-cost">Custo de embalagem</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id="packaging-cost"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={packagingCost}
                  onChange={(e) => setPackagingCost(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="other-costs">Outros custos</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id="other-costs"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={otherCosts}
                  onChange={(e) => setOtherCosts(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Margin preview */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2.5">
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Prévia da margem
            </h4>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Comissão ML</span>
              <span className="text-foreground">
                {formatBRL(product.ml_fee)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Frete</span>
              <span className="text-foreground">
                {formatBRL(product.shipping_cost)}
              </span>
            </div>

            <Separator />

            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-muted-foreground">Margem líquida</span>
              <span className={marginColor}>{formatBRL(margin.netMargin)}</span>
            </div>

            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-muted-foreground">Margem %</span>
              <span className={marginColor}>
                {margin.marginPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
