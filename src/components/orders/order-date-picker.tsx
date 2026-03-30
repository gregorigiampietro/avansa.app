"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface OrderDatePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

export function OrderDatePicker({
  dateRange,
  onDateRangeChange,
}: OrderDatePickerProps) {
  const hasRange = dateRange?.from != null;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <CalendarIcon className="size-3.5" />
            {hasRange ? (
              <span>
                {dateRange.from
                  ? format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                  : ""}
                {dateRange.to
                  ? ` - ${format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                  : ""}
              </span>
            ) : (
              <span>Selecionar periodo</span>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={onDateRangeChange}
          numberOfMonths={2}
          locale={ptBR}
          disabled={{ after: new Date() }}
        />
      </PopoverContent>
    </Popover>
  );
}
