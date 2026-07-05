import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Uses cookies managed by @supabase/ssr for session persistence.
 *
 * Note: We intentionally omit the Database generic here because the
 * @supabase/ssr type inference for complex schemas is unreliable.
 * All query results are typed at the call site instead.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
