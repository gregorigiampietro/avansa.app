"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AccountCard } from "@/components/accounts/account-card";
import type { MlAccount } from "@/types/database";

interface AccountsListProps {
  initialAccounts: MlAccount[];
}

export function AccountsList({ initialAccounts }: AccountsListProps) {
  const [accounts, setAccounts] = useState<MlAccount[]>(initialAccounts);

  async function handleDisconnect(id: string) {
    try {
      const response = await fetch(`/api/ml/accounts/${id}/disconnect`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Erro ao desconectar conta");
      }

      setAccounts((prev) => prev.filter((account) => account.id !== id));
      toast.success("Conta desconectada com sucesso");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao desconectar conta"
      );
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma conta conectada. Clique no botão acima para conectar sua
          primeira conta do Mercado Livre.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          onDisconnect={handleDisconnect}
        />
      ))}
    </div>
  );
}
