"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check,
  DollarSign,
  Loader2,
  Package,
  Pause,
  Percent,
  Play,
  X,
} from "lucide-react";

interface BulkActionsProps {
  selectedIds: string[];
  onComplete: () => void;
  onClear: () => void;
}

type ActiveInput =
  | null
  | "price"
  | "price_percent"
  | "stock";

interface BulkResult {
  total: number;
  succeeded: number;
  failed: number;
  errors?: { productId: string; error: string }[];
}

export function BulkActions({
  selectedIds,
  onComplete,
  onClear,
}: BulkActionsProps) {
  const [activeInput, setActiveInput] = useState<ActiveInput>(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [confirmAction, setConfirmAction] = useState<"pause" | "activate" | null>(null);

  const reset = useCallback(() => {
    setActiveInput(null);
    setInputValue("");
    setConfirmAction(null);
  }, []);

  const executeBulk = useCallback(
    async (action: string, value?: number) => {
      setLoading(true);
      setResult(null);

      try {
        const response = await fetch("/api/ml/products/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productIds: selectedIds,
            action,
            value,
          }),
        });

        const data = (await response.json()) as BulkResult;

        if (!response.ok) {
          setResult({
            total: selectedIds.length,
            succeeded: 0,
            failed: selectedIds.length,
          });
          return;
        }

        setResult(data);
        onComplete();
      } catch {
        setResult({
          total: selectedIds.length,
          succeeded: 0,
          failed: selectedIds.length,
        });
      } finally {
        setLoading(false);
        reset();
      }
    },
    [selectedIds, onComplete, reset]
  );

  const handleApplyInput = useCallback(() => {
    const parsed = parseFloat(inputValue.replace(",", "."));
    if (isNaN(parsed)) return;

    if (activeInput === "price") {
      executeBulk("update_price", parsed);
    } else if (activeInput === "price_percent") {
      executeBulk("update_price_percent", parsed);
    } else if (activeInput === "stock") {
      executeBulk("update_stock", Math.floor(parsed));
    }
  }, [activeInput, inputValue, executeBulk]);

  const handleConfirmAction = useCallback(() => {
    if (confirmAction === "pause") {
      executeBulk("pause");
    } else if (confirmAction === "activate") {
      executeBulk("activate");
    }
    setConfirmAction(null);
  }, [confirmAction, executeBulk]);

  const handleDismissResult = useCallback(() => {
    setResult(null);
    onClear();
  }, [onClear]);

  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-[#1A1A1F]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
        {/* Selection count */}
        <span className="shrink-0 text-sm font-medium text-foreground">
          {selectedIds.length}{" "}
          {selectedIds.length === 1 ? "produto selecionado" : "produtos selecionados"}
        </span>

        <div className="h-5 w-px bg-border" />

        {/* Loading state */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Processando {selectedIds.length} produtos...
          </div>
        )}

        {/* Result summary */}
        {result && !loading && (
          <div className="flex items-center gap-3">
            <span className="text-sm">
              <span className="text-[#CDFF00]">{result.succeeded} sucesso</span>
              {result.failed > 0 && (
                <span className="text-[#FF453A]">
                  , {result.failed} {result.failed === 1 ? "erro" : "erros"}
                </span>
              )}
            </span>
            <Button variant="ghost" size="sm" onClick={handleDismissResult}>
              Fechar
            </Button>
          </div>
        )}

        {/* Confirm pause/activate */}
        {confirmAction && !loading && !result && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {confirmAction === "pause"
                ? `Pausar ${selectedIds.length} produtos?`
                : `Ativar ${selectedIds.length} produtos?`}
            </span>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmAction}
            >
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmAction(null)}
            >
              Cancelar
            </Button>
          </div>
        )}

        {/* Inline input for price/stock */}
        {activeInput && !loading && !result && !confirmAction && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {activeInput === "price" && "Novo preço (R$):"}
              {activeInput === "price_percent" && "Ajuste (%):"}
              {activeInput === "stock" && "Novo estoque:"}
            </span>
            <Input
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                activeInput === "price_percent" ? "ex: 10 ou -5" : "0"
              }
              className="h-8 w-28"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplyInput();
                if (e.key === "Escape") reset();
              }}
            />
            <Button size="sm" onClick={handleApplyInput} disabled={!inputValue}>
              <Check className="size-3.5" />
              Aplicar
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Action buttons (shown when no input is active) */}
        {!activeInput && !loading && !result && !confirmAction && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveInput("price");
                setInputValue("");
              }}
            >
              <DollarSign className="size-3.5" />
              Alterar preço
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveInput("price_percent");
                setInputValue("");
              }}
            >
              <Percent className="size-3.5" />
              Ajustar %
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveInput("stock");
                setInputValue("");
              }}
            >
              <Package className="size-3.5" />
              Alterar estoque
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAction("pause")}
            >
              <Pause className="size-3.5" />
              Pausar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAction("activate")}
            >
              <Play className="size-3.5" />
              Ativar
            </Button>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear selection */}
        <Button variant="ghost" size="sm" onClick={onClear}>
          Limpar seleção
        </Button>
      </div>
    </div>
  );
}
