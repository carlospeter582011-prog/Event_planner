import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig, missingSupabaseMessage } from "./config";

/**
 * Browser-side Supabase client.
 * Uses cookies managed by @supabase/ssr for session persistence.
 *
 * Note: We intentionally omit the Database generic here because the
 * @supabase/ssr type inference for complex schemas is unreliable.
 * All query results are typed at the call site instead.
 */
export function createClient() {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error(missingSupabaseMessage);
  }

  return createBrowserClient(config.url, config.anonKey);
}
