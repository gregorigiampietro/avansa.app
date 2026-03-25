import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Supabase admin client with service_role privileges.
 * Use ONLY in server-side code (API routes, webhooks, cron jobs).
 * NEVER import this in client components.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
