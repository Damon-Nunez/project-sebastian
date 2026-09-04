import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "@/lib/env";

let cachedClient: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the service_role key.
 * Never import this from client components — service_role bypasses RLS.
 */
export function createServerSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } =
    requireSupabaseEnv();

  cachedClient = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}
