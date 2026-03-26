"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
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
import { Check, ImageOff, Loader2, X } from "lucide-react";

interface ProductEditSheetProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function formatBRL(value: number | null | undefined): string {
  if (value == null) return "R$ 0,00";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

type FeedbackState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function ProductEditSheet({
  product,
  open,
  onOpenChange,
  onSaved,
}: ProductEditSheetProps) {
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [status, setStatus] = useState<"active" | "paused" | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: "idle" });

  // Reset form when product changes
  const resetForm = useCallback((p: Product | null) => {
    if (p) {
      setPrice(p.price?.toString() ?? "");
      setStock(p.available_quantity?.toString() ?? "");
      setStatus((p.status as "active" | "paused") ?? null);
    }
    setFeedback({ type: "idle" });
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen && product) {
        resetForm(product);
      }
      onOpenChange(isOpen);
    },
    [product, resetForm, onOpenChange]
  );

  const handleSave = useCallback(async () => {
    if (!product) return;

    setSaving(true);
    setFeedback({ type: "idle" });

    try {
      const body: Record<string, unknown> = {};

      // Only send changed fields
      const newPrice = price ? parseFloat(price.replace(",", ".")) : null;
      if (newPrice !== null && newPrice !== product.price) {
        body.price = newPrice;
      }

      const newStock = stock ? parseInt(stock, 10) : null;
      if (
        newStock !== null &&
        newStock !== product.available_quantity
      ) {
        body.available_quantity = newStock;
      }

      if (status && status !== product.status) {
        body.status = status;
      }

      if (Object.keys(body).length === 0) {
        setFeedback({ type: "error", message: "Nenhuma alteração detectada" });
        return;
      }

      const response = await fetch(`/api/ml/products/${product.id}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Erro ao salvar alterações");
      }

      if (data.errors && data.errors.length > 0) {
        setFeedback({
          type: "error",
          message: `Parcialmente salvo. Erros: ${data.errors.join("; ")}`,
        });
        toast.warning("Alterações salvas parcialmente");
      } else {
        setFeedback({ type: "success", message: "Alterações salvas" });
        toast.success("Produto atualizado no Mercado Livre");
      }

      onSaved();

      // Close after brief success display
      setTimeout(() => {
        onOpenChange(false);
      }, 800);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao salvar alterações";
      setFeedback({ type: "error", message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [product, price, stock, status, onSaved, onOpenChange]);

  if (!product) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar produto</SheetTitle>
          <SheetDescription className="sr-only">
            Editar preço, estoque e status do produto
          </SheetDescription>
        </SheetHeader>

        {/* Product info */}
        <div className="flex items-center gap-3 px-4">
          {product.thumbnail ? (
            <Image
              src={product.thumbnail.replace("http://", "https://")}
              alt=""
              width={48}
              height={48}
              className="size-12 shrink-0 rounded-md bg-muted object-cover"
              unoptimized
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
              <ImageOff className="size-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {product.title ?? "Produto sem título"}
            </p>
            <p className="text-xs text-muted-foreground">
              {product.sku ? `SKU: ${product.sku}` : product.ml_item_id}
            </p>
          </div>
        </div>

        <Separator className="mx-4" />

        {/* Current values */}
        <div className="mx-4 rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Valores atuais
          </h4>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Preço</span>
            <span className="text-foreground">{formatBRL(product.price)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Estoque</span>
            <span className="text-foreground">
              {product.available_quantity ?? 0} unidades
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className="text-foreground">
              {product.status === "active"
                ? "Ativo"
                : product.status === "paused"
                  ? "Pausado"
                  : (product.status ?? "---")}
            </span>
          </div>
        </div>

        {/* Editable fields */}
        <div className="flex flex-1 flex-col gap-5 px-4">
          <div className="space-y-4">
            {/* Price */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-price">Preço</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id="edit-price"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Stock */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-stock">Estoque</Label>
              <Input
                id="edit-stock"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>

            {/* Status toggle */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={status === "active" ? "default" : "outline"}
                  size="sm"
                  className={
                    status === "active"
                      ? "bg-[#CDFF00] text-[#0D0D0F] hover:bg-[#CDFF00]/90"
                      : ""
                  }
                  onClick={() => setStatus("active")}
                >
                  Ativo
                </Button>
                <Button
                  type="button"
                  variant={status === "paused" ? "default" : "outline"}
                  size="sm"
                  className={
                    status === "paused"
                      ? "bg-[#FF9F0A] text-[#0D0D0F] hover:bg-[#FF9F0A]/90"
                      : ""
                  }
                  onClick={() => setStatus("paused")}
                >
                  Pausado
                </Button>
              </div>
            </div>
          </div>

          {/* Feedback */}
          {feedback.type === "success" && (
            <div className="flex items-center gap-2 rounded-lg bg-[#CDFF00]/15 p-3 text-sm text-[#CDFF00]">
              <Check className="size-4 shrink-0" />
              {feedback.message}
            </div>
          )}
          {feedback.type === "error" && (
            <div className="flex items-center gap-2 rounded-lg bg-[#FF453A]/15 p-3 text-sm text-[#FF453A]">
              <X className="size-4 shrink-0" />
              {feedback.message}
            </div>
          )}
        </div>

        <SheetFooter>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#CDFF00] text-[#0D0D0F] hover:bg-[#CDFF00]/90"
          >
            {saving && <Loader2 className="animate-spin" />}
            Salvar alterações
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
