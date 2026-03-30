"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SyncInfo {
  completedAt: string | null;
  itemsSynced: number;
  status: string;
}

interface WebhookHealth {
  eventsLast24h: number;
  errorsLast24h: number;
  mode: "automatic" | "manual";
}

export interface AccountSyncStatus {
  accountId: string;
  nickname: string;
  lastSync: {
    products: SyncInfo | null;
    orders: SyncInfo | null;
  };
  webhookHealth: WebhookHealth;
  syncInProgress: boolean;
}

interface SyncStatusResponse {
  accounts: AccountSyncStatus[];
}

interface UseSyncStatusReturn {
  data: SyncStatusResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const POLL_INTERVAL = 60_000; // 60 seconds

export function useSyncStatus(accountId?: string): UseSyncStatusReturn {
  const [data, setData] = useState<SyncStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (accountId) {
        params.set("accountId", accountId);
      }
      const url = `/api/ml/sync-status${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error ?? "Erro ao buscar status de sincronizacao");
      }

      const json: SyncStatusResponse = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao buscar status de sincronizacao"
      );
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchStatus();

    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStatus]);

  return { data, isLoading, error, refetch: fetchStatus };
}
