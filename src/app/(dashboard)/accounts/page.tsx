import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ConnectButton } from "@/components/accounts/connect-button";
import { AccountsList } from "@/components/accounts/accounts-list";
import { createClient } from "@/lib/supabase/server";

const ERROR_MESSAGES: Record<string, string> = {
  no_code: "Nenhum codigo de autorizacao recebido do Mercado Livre.",
  token_exchange: "Erro ao trocar o codigo por token. Tente novamente.",
  missing_verifier: "Sessao expirada. Tente conectar novamente.",
  unknown: "Ocorreu um erro inesperado. Tente novamente.",
};

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: accounts } = await supabase
    .from("ml_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("connected_at", { ascending: false });

  const params = await searchParams;
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <>
      <Header title="Contas do Mercado Livre" />

      <div className="p-6">
        {success === "connected" && (
          <div className="mb-6 rounded-lg border border-lime-500/30 bg-lime-500/10 px-4 py-3">
            <p className="text-sm text-lime-400">
              Conta conectada com sucesso!
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">
              {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown}
            </p>
          </div>
        )}

        <div className="mb-6">
          <ConnectButton />
        </div>

        <AccountsList initialAccounts={accounts ?? []} />
      </div>
    </>
  );
}
