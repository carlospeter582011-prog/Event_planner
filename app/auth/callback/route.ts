import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Auth callback route handler.
 * Supabase Auth redirects here after email confirmation / OAuth login.
 * Exchanges the auth code for a session and redirects to the dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("Auth callback error:", error.message);
  }

  // Return to sign-in with an error message
  return NextResponse.redirect(
    `${origin}/auth/signin?error=${isSupabaseConfigured() ? "auth_callback_failed" : "supabase_config_missing"}`,
  );
}
