"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

const PRESETS = [
  { label: "7 dias", value: "7" },
  { label: "15 dias", value: "15" },
  { label: "30 dias", value: "30" },
  { label: "90 dias", value: "90" },
] as const;

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DateRangePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentFrom = searchParams.get("from");
  const currentTo = searchParams.get("to");
  const currentPreset = searchParams.get("days");

  const [showCustom, setShowCustom] = useState(
    !!(currentFrom && currentTo && !currentPreset)
  );
  const [fromDate, setFromDate] = useState(currentFrom ?? daysAgoISO(30));
  const [toDate, setToDate] = useState(currentTo ?? todayISO());

  const navigate = useCallback(
    (params: Record<string, string>) => {
      const sp = new URLSearchParams(params);
      router.push(`/dashboard?${sp.toString()}`);
    },
    [router]
  );

  const handlePreset = useCallback(
    (days: string) => {
      setShowCustom(false);
      navigate({ days });
    },
    [navigate]
  );

  const handleCustomApply = useCallback(() => {
    if (fromDate && toDate) {
      navigate({ from: fromDate, to: toDate });
    }
  }, [fromDate, toDate, navigate]);

  const activePreset = currentPreset ?? (!currentFrom ? "30" : null);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
      {/* Presets */}
      <div className="flex items-center gap-1.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset.value}
            variant={activePreset === preset.value ? "default" : "outline"}
            size="sm"
            className={
              activePreset === preset.value
                ? "bg-[#CDFF00] text-[#0D0D0F] hover:bg-[#CDFF00]/90 h-8 text-xs"
                : "h-8 text-xs"
            }
            onClick={() => handlePreset(preset.value)}
          >
            {preset.label}
          </Button>
        ))}

        <Button
          variant={showCustom && !activePreset ? "default" : "outline"}
          size="sm"
          className={
            showCustom && !activePreset
              ? "bg-[#CDFF00] text-[#0D0D0F] hover:bg-[#CDFF00]/90 h-8 text-xs"
              : "h-8 text-xs"
          }
          onClick={() => setShowCustom((prev) => !prev)}
        >
          <CalendarDays className="size-3.5" />
          Personalizado
        </Button>
      </div>

      {/* Custom date inputs */}
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            max={todayISO()}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <Button
            size="sm"
            className="h-8 bg-[#CDFF00] text-[#0D0D0F] hover:bg-[#CDFF00]/90 text-xs"
            onClick={handleCustomApply}
          >
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}
