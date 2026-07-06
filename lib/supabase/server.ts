import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig, missingSupabaseMessage } from "./config";
import { supabaseCookieOptions } from "./cookies";

/**
 * Server-side Supabase client for use in Server Components,
 * Server Actions, and Route Handlers. Reads/writes auth cookies
 * through Next.js cookies() API.
 *
 * In Next.js 16, `cookies()` is async and must be awaited.
 * Database generic is omitted for reliable type inference.
 */
export async function createClient() {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error(missingSupabaseMessage);
  }

  const cookieStore = await cookies();

  return createServerClient(
    config.url,
    config.anonKey,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — proxy will refresh.
          }
        },
      },
    },
  );
}
