"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useSyncStatus,
  type AccountSyncStatus,
} from "@/hooks/use-sync-status";

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return "agora";
  if (diffSeconds < 3600) {
    const mins = Math.floor(diffSeconds / 60);
    return `há ${mins} min`;
  }
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `há ${hours} h`;
  }
  const days = Math.floor(diffSeconds / 86400);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

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

function getMostRecentSync(account: AccountSyncStatus): string | null {
  const prodDate = account.lastSync.products?.completedAt;
  const ordersDate = account.lastSync.orders?.completedAt;

  if (prodDate && ordersDate) return prodDate > ordersDate ? prodDate : ordersDate;
  return prodDate ?? ordersDate ?? null;
}

function getDotColor(account: AccountSyncStatus): string {
  if (account.webhookHealth.errorsLast24h > 0) return "bg-red-500";
  if (account.webhookHealth.mode === "automatic") return "bg-emerald-500";
  return "bg-yellow-500";
}

function getGlobalDotColor(accounts: AccountSyncStatus[]): string {
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

function getGlobalLatestSync(accounts: AccountSyncStatus[]): string | null {
  let latest: string | null = null;
  for (const account of accounts) {
    const accountLatest = getMostRecentSync(account);
    if (accountLatest && (!latest || accountLatest > latest)) latest = accountLatest;
  }
  return latest;
}

interface SyncAccountCardProps {
  account: AccountSyncStatus;
  syncingType: string | null;
  onSync: (accountId: string, type: "products" | "orders") => void;
}

function SyncAccountCard({ account, syncingType, onSync }: SyncAccountCardProps) {
  const dotColor = getDotColor(account);

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2.5">
      {/* Account header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block size-2 rounded-full ${dotColor}`} />
          <span className="text-sm font-medium text-foreground">
            {account.nickname}
          </span>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            account.webhookHealth.mode === "automatic"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-yellow-500/10 text-yellow-500"
          }`}
        >
          {account.webhookHealth.mode === "automatic" ? "Automático" : "Manual"}
        </span>
      </div>

      {/* Sync info */}
      <div className="space-y-1 text-xs text-muted-foreground">
        {account.lastSync.products && (
          <div className="flex items-center justify-between">
            <span>Produtos</span>
            <span>
              {formatDateTime(account.lastSync.products.completedAt!)} — {account.lastSync.products.itemsSynced} itens
            </span>
          </div>
        )}
        {account.lastSync.orders && (
          <div className="flex items-center justify-between">
            <span>Vendas</span>
            <span>
              {formatDateTime(account.lastSync.orders.completedAt!)} — {account.lastSync.orders.itemsSynced} itens
            </span>
          </div>
        )}
        {!account.lastSync.products && !account.lastSync.orders && (
          <span>Nenhuma sincronização registrada</span>
        )}
      </div>

      {/* Sync buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-xs"
          disabled={syncingType !== null || account.syncInProgress}
          onClick={() => onSync(account.accountId, "products")}
        >
          {syncingType === `${account.accountId}-products` ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Produtos
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-xs"
          disabled={syncingType !== null || account.syncInProgress}
          onClick={() => onSync(account.accountId, "orders")}
        >
          {syncingType === `${account.accountId}-orders` ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Vendas
        </Button>
      </div>
    </div>
  );
}

export function SyncPopover() {
  const { data, isLoading, refetch } = useSyncStatus();
  const [syncingType, setSyncingType] = useState<string | null>(null);

  const handleSync = useCallback(
    async (accountId: string, type: "products" | "orders") => {
      const key = `${accountId}-${type}`;
      setSyncingType(key);
      try {
        const endpoint = type === "products" ? "/api/ml/sync" : "/api/ml/orders";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });

        if (!response.ok) {
          const json = await response.json();
          throw new Error(json.error ?? "Erro ao sincronizar");
        }

        toast.success(
          type === "products"
            ? "Produtos sincronizados com sucesso"
            : "Vendas sincronizadas com sucesso"
        );
        await refetch();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Erro ao sincronizar"
        );
      } finally {
        setSyncingType(null);
      }
    },
    [refetch]
  );

  const anySyncing =
    syncingType !== null || (data?.accounts.some((a) => a.syncInProgress) ?? false);

  const globalDotColor = data?.accounts.length
    ? getGlobalDotColor(data.accounts)
    : "bg-muted";

  const latestSync = data?.accounts.length
    ? getGlobalLatestSync(data.accounts)
    : null;

  return (
    <Popover>
      <PopoverTrigger
        className="relative flex items-center justify-center rounded-lg p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        title="Sincronização"
      >
        {anySyncing ? (
          <RefreshCw className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {/* Status dot */}
        <span
          className={`absolute right-1.5 top-1.5 size-1.5 rounded-full ${globalDotColor}`}
        />
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        className="w-80 p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            Sincronização
          </span>
          <span className="text-xs text-muted-foreground">
            {anySyncing
              ? "Sincronizando..."
              : latestSync
                ? `Atualizado ${formatRelativeTime(latestSync)}`
                : "Nunca sincronizado"}
          </span>
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.accounts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma conta conectada
            </p>
          ) : (
            data.accounts.map((account) => (
              <SyncAccountCard
                key={account.accountId}
                account={account}
                syncingType={syncingType}
                onSync={handleSync}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
