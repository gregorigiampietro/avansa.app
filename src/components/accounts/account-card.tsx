"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Unlink } from "lucide-react";
import type { MlAccount } from "@/types/database";

interface AccountCardProps {
  account: MlAccount;
  onDisconnect: (id: string) => void;
}

function getInitials(nickname: string | null): string {
  if (!nickname) return "ML";
  return nickname.slice(0, 2).toUpperCase();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return (
        <Badge className="border-transparent bg-lime-500/15 text-lime-400">
          Ativa
        </Badge>
      );
    case "expired":
      return (
        <Badge className="border-transparent bg-orange-500/15 text-orange-400">
          Token expirado
        </Badge>
      );
    case "error":
      return (
        <Badge className="border-transparent bg-red-500/15 text-red-400">
          Erro
        </Badge>
      );
    case "disconnected":
      return (
        <Badge variant="secondary">
          Desconectada
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {status}
        </Badge>
      );
  }
}

export function AccountCard({ account, onDisconnect }: AccountCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback className="bg-[#CDFF00]/15 text-[#CDFF00] text-sm font-semibold">
                {getInitials(account.nickname)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <CardTitle>{account.nickname ?? "Conta ML"}</CardTitle>
              {account.email && (
                <p className="text-sm text-muted-foreground">{account.email}</p>
              )}
              <p className="text-xs text-muted-foreground/70">
                ID: {account.ml_user_id}
              </p>
            </div>
          </div>
          <StatusBadge status={account.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Conectada em {formatDate(account.connected_at)}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onDisconnect(account.id)}
          >
            <Unlink className="size-3.5" data-icon="inline-start" />
            Desconectar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
