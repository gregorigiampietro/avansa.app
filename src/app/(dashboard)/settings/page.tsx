import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { SettingsView } from "@/components/settings/settings-view";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Count connected accounts
  const { count: accountCount } = await supabase
    .from("ml_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  // Get last sync time
  const { data: lastSync } = await supabase
    .from("sync_logs")
    .select("completed_at")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <>
      <Header title="Configurações" />

      <SettingsView
        userEmail={user.email ?? ""}
        accountCount={accountCount ?? 0}
        lastSyncAt={lastSync?.completed_at ?? null}
      />
    </>
  );
}
