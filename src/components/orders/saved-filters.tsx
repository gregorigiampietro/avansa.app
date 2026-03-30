"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY_SAVED = "avansa:orders:savedFilters";
const STORAGE_KEY_LAST = "avansa:orders:lastFilter";
const MAX_SAVED_FILTERS = 10;

export interface SavedFilterValues {
  accountId?: string | null;
  period?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: string | null;
  search?: string | null;
  groupBy?: string | null;
  sortField?: string | null;
  sortDirection?: "asc" | "desc";
}

export interface SavedFilter {
  name: string;
  filters: SavedFilterValues;
}

interface SavedFiltersProps {
  currentFilters: SavedFilterValues;
  onApplyFilter: (filters: SavedFilterValues) => void;
}

export function loadLastFilter(): SavedFilterValues | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST);
    if (!raw) return null;
    return JSON.parse(raw) as SavedFilterValues;
  } catch {
    return null;
  }
}

export function saveLastFilter(filters: SavedFilterValues): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_LAST, JSON.stringify(filters));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function loadSavedFilters(): SavedFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED);
    if (!raw) return [];
    return JSON.parse(raw) as SavedFilter[];
  } catch {
    return [];
  }
}

function persistSavedFilters(filters: SavedFilter[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(filters));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export function SavedFilters({
  currentFilters,
  onApplyFilter,
}: SavedFiltersProps) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showNameInput, setShowNameInput] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");

  // Load saved filters from localStorage on mount
  useEffect(() => {
    setSavedFilters(loadSavedFilters());
  }, []);

  const handleSave = useCallback(() => {
    const trimmed = newFilterName.trim();
    if (!trimmed) return;

    const updated = [
      ...savedFilters.filter((f) => f.name !== trimmed),
      { name: trimmed, filters: { ...currentFilters } },
    ].slice(-MAX_SAVED_FILTERS);

    setSavedFilters(updated);
    persistSavedFilters(updated);
    setNewFilterName("");
    setShowNameInput(false);
  }, [newFilterName, savedFilters, currentFilters]);

  const handleDelete = useCallback(
    (name: string) => {
      const updated = savedFilters.filter((f) => f.name !== name);
      setSavedFilters(updated);
      persistSavedFilters(updated);
    },
    [savedFilters]
  );

  const handleApply = useCallback(
    (filter: SavedFilter) => {
      onApplyFilter(filter.filters);
    },
    [onApplyFilter]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Bookmark className="size-4 text-muted-foreground" />

      {savedFilters.map((filter) => (
        <div key={filter.name} className="group flex items-center gap-0.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleApply(filter)}
          >
            {filter.name}
          </Button>
          <button
            type="button"
            onClick={() => handleDelete(filter.name)}
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            aria-label={`Remover filtro ${filter.name}`}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}

      {showNameInput ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="text"
            placeholder="Nome do filtro..."
            value={newFilterName}
            onChange={(e) => setNewFilterName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setShowNameInput(false);
                setNewFilterName("");
              }
            }}
            className="h-7 w-36 text-xs"
            autoFocus
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={!newFilterName.trim()}
          >
            Salvar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setShowNameInput(false);
              setNewFilterName("");
            }}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => setShowNameInput(true)}
          disabled={savedFilters.length >= MAX_SAVED_FILTERS}
        >
          <Plus className="size-3" />
          Salvar filtro atual
        </Button>
      )}
    </div>
  );
}
