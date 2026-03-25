"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";

export function ConnectButton() {
  const [isLoading, setIsLoading] = useState(false);

  function handleConnect() {
    setIsLoading(true);
    window.location.href = "/api/auth/mercadolivre/authorize";
  }

  return (
    <Button onClick={handleConnect} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
      ) : (
        <Plus className="size-4" data-icon="inline-start" />
      )}
      {isLoading ? "Redirecionando..." : "Conectar conta do Mercado Livre"}
    </Button>
  );
}
