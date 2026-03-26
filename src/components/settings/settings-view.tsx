"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, KeyRound, Loader2, Mail, User } from "lucide-react";

interface SettingsViewProps {
  userEmail: string;
  accountCount: number;
  lastSyncAt: string | null;
}

export function SettingsView({
  userEmail,
  accountCount,
  lastSyncAt,
}: SettingsViewProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success("Senha alterada com sucesso");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao alterar senha"
      );
    } finally {
      setSaving(false);
    }
  }

  function formatLastSync(dateStr: string | null) {
    if (!dateStr) return "Nenhuma sincronização realizada";
    const date = new Date(dateStr);
    return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      {/* Profile section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <User className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Perfil</h2>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">E-mail</Label>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Mail className="size-4 text-muted-foreground" />
              {userEmail}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Password section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
            Alterar senha
          </h2>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Senha atual</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha atual"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleChangePassword();
              }}
            />
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={saving || !newPassword || !confirmPassword}
            className="bg-[#CDFF00] text-[#0D0D0F] hover:bg-[#CDFF00]/90"
          >
            {saving && <Loader2 className="animate-spin" />}
            Salvar nova senha
          </Button>
        </div>
      </section>

      <Separator />

      {/* Sync info section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Sincronização
        </h2>

        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Contas ML conectadas</span>
            <span className="text-foreground">{accountCount}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Sincronização automática
            </span>
            <span className="text-[#CDFF00]">Ativa — a cada 6 horas</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Última sincronização
            </span>
            <span className="text-foreground">
              {formatLastSync(lastSyncAt)}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Seus produtos, pedidos e estoque são sincronizados automaticamente a
            cada 6 horas. Alterações no Mercado Livre também são recebidas em
            tempo real via webhooks.
          </p>
        </div>
      </section>
    </div>
  );
}
