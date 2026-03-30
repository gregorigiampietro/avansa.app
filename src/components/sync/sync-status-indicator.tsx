"use client";

import { RefreshCw } from "lucide-react";
import { useSyncStatus, type AccountSyncStatus } from "@/hooks/use-sync-status";

/**
 * Formats a relative time string in Portuguese.
 * E.g. "agora", "ha 2 min", "ha 1 h", "ha 3 dias"
 */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return "agora";
  if (diffSeconds < 3600) {
    const mins = Math.floor(diffSeconds / 60);
    return `ha ${mins} min`;
  }
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `ha ${hours} h`;
  }
  const days = Math.floor(diffSeconds / 86400);
  return `ha ${days} ${days === 1 ? "dia" : "dias"}`;
}

/**
 * Formats a date to DD/MM/YYYY HH:mm in Sao Paulo timezone.
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Gets the most recent sync timestamp across all accounts and sync types.
 */
function getMostRecentSync(accounts: AccountSyncStatus[]): string | null {
  let latest: string | null = null;

  for (const account of accounts) {
    const prodDate = account.lastSync.products?.completedAt;
    const ordersDate = account.lastSync.orders?.completedAt;

    if (prodDate && (!latest || prodDate > latest)) latest = prodDate;
    if (ordersDate && (!latest || ordersDate > latest)) latest = ordersDate;
  }

  return latest;
}

/**
 * Gets the aggregate dot color across all accounts.
 * If any account has errors -> red. If any is automatic -> green. Otherwise yellow.
 */
function getAggregateDotColor(accounts: AccountSyncStatus[]): string {
  let hasErrors = false;
  let hasAutomatic = false;

  for (const account of accounts) {
    if (account.webhookHealth.errorsLast24h > 0) hasErrors = true;
    if (account.webhookHealth.mode === "automatic") hasAutomatic = true;
  }

  if (hasErrors) return "bg-red-500";
  if (hasAutomatic) return "bg-emerald-500";
  return "bg-yellow-500";
}

// ─── Compact variant (header) ──────────────────────────────────

interface CompactSyncStatusProps {
  className?: string;
}

export function SyncStatusIndicator({ className }: CompactSyncStatusProps) {
  const { data, isLoading } = useSyncStatus();

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className ?? ""}`}>
        <div className="size-2 rounded-full bg-muted animate-pulse" />
        <span className="text-xs text-muted-foreground animate-pulse">
          Carregando...
        </span>
      </div>
    );
  }

  if (!data || data.accounts.length === 0) {
    return null;
  }

  const anySyncing = data.accounts.some((a) => a.syncInProgress);
  const latestSync = getMostRecentSync(data.accounts);
  const dotColor = getAggregateDotColor(data.accounts);

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {anySyncing ? (
        <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
      ) : (
        <span className={`inline-block size-2 rounded-full ${dotColor}`} />
      )}
      <span className="text-xs text-muted-foreground">
        {anySyncing
          ? "Sincronizando..."
          : latestSync
            ? `Atualizado ${formatRelativeTime(latestSync)}`
            : "Nunca sincronizado"}
      </span>
    </div>
  );
}

// ─── Expanded variant (products/orders pages) ──────────────────

interface ExpandedSyncStatusProps {
  syncType: "products" | "orders";
  accountId?: string;
  className?: string;
}

export function SyncStatusExpanded({
  syncType,
  accountId,
  className,
}: ExpandedSyncStatusProps) {
  const { data, isLoading } = useSyncStatus(accountId);

  if (isLoading) {
    return (
      <div
        className={`flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 ${className ?? ""}`}
      >
        <div className="h-4 w-48 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (!data || data.accounts.length === 0) {
    return null;
  }

  // Aggregate across all accounts (or single account if filtered)
  const syncLabel = syncType === "products" ? "Produtos" : "Vendas";

  // Get the most relevant sync info
  let latestSync: { completedAt: string; itemsSynced: number } | null = null;
  let aggregateMode: "automatic" | "manual" = "manual";
  let hasErrors = false;
  let anySyncing = false;

  for (const account of data.accounts) {
    const syncInfo =
      syncType === "products"
        ? account.lastSync.products
        : account.lastSync.orders;

    if (
      syncInfo?.completedAt &&
      (!latestSync || syncInfo.completedAt > latestSync.completedAt)
    ) {
      latestSync = {
        completedAt: syncInfo.completedAt,
        itemsSynced: syncInfo.itemsSynced,
      };
    }

    if (account.webhookHealth.mode === "automatic") aggregateMode = "automatic";
    if (account.webhookHealth.errorsLast24h > 0) hasErrors = true;
    if (account.syncInProgress) anySyncing = true;
  }

  const dotColor = hasErrors
    ? "bg-red-500"
    : aggregateMode === "automatic"
      ? "bg-emerald-500"
      : "bg-yellow-500";

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 text-sm ${className ?? ""}`}
    >
      {anySyncing ? (
        <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
      ) : (
        <span className={`inline-block size-2 rounded-full ${dotColor}`} />
      )}

      <span className="text-muted-foreground">
        {anySyncing ? (
          `Sincronizando ${syncLabel.toLowerCase()}...`
        ) : latestSync ? (
          <>
            Ultima sincronizacao de {syncLabel.toLowerCase()}:{" "}
            <span className="font-medium text-foreground">
              {formatDateTime(latestSync.completedAt)}
            </span>
            {" — "}
            <span className="text-foreground">
              {latestSync.itemsSynced}{" "}
              {latestSync.itemsSynced === 1 ? "item" : "itens"}
            </span>
          </>
        ) : (
          `Nenhuma sincronizacao de ${syncLabel.toLowerCase()} registrada`
        )}
      </span>

      {!anySyncing && (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            aggregateMode === "automatic"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-yellow-500/10 text-yellow-500"
          }`}
        >
          {aggregateMode === "automatic" ? "Automatico" : "Manual"}
        </span>
      )}
    </div>
  );
}
