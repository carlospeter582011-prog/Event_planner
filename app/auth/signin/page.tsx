"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, missingSupabaseMessage } from "@/lib/supabase/config";
import toast from "react-hot-toast";
import { Spinner } from "@/components/ui/spinner";

/**
 * Sign in / Sign up page.
 * Supports both modes via ?mode=signup query param.
 * Uses Supabase Auth (email + password).
 */
export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === "signup";
  const supabaseConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (!supabaseConfigured) return;

    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace(redirectPath);
        router.refresh();
      }
    });
  }, [redirectPath, router, supabaseConfigured]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured) {
      toast.error(missingSupabaseMessage);
      return;
    }
    setLoading(true);

    const supabase = createClient();

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });

        if (error) throw error;

        toast.success("Account created! Redirecting to your dashboard.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast.success("Welcome back!");
      }

      await waitForReadableSession(supabase);
      window.location.assign(redirectPath);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      {/* Background */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-brand-950"
        aria-hidden="true"
      />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-500 text-white">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Synchrona
          </h1>
        </div>

        {/* Card */}
        <div className="card p-6" data-testid="auth-card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isSignUp
              ? "Start planning events with your team"
              : "Sign in to continue to Synchrona"}
          </p>
          {!supabaseConfigured && (
            <div
              className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              role="alert"
              data-testid="auth-config-warning"
            >
              {missingSupabaseMessage}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-4"
            data-testid="auth-form"
          >
            {/* Name (signup only) */}
            {isSignUp && (
              <div>
                <label htmlFor="name" className="label">
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  data-testid="auth-name-input"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                data-testid="auth-email-input"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                data-testid="auth-password-input"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !supabaseConfigured}
              className="btn-primary w-full"
              data-testid="auth-submit"
            >
              {loading ? (
                <>
                  <Spinner className="h-4 w-4" />
                  {isSignUp ? "Creating account…" : "Signing in…"}
                </>
              ) : isSignUp ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() =>
                setMode(isSignUp ? "signin" : "signup")
              }
              className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              data-testid="auth-toggle-mode"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>

        {/* Back */}
        <div className="mt-4 text-center">
          <a
            href="/"
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400"
            data-testid="auth-back"
          >
            ← Back to home
          </a>
        </div>
      </div>
    </main>
  );
}

async function waitForReadableSession(supabase: ReturnType<typeof createClient>) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) return;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
}
