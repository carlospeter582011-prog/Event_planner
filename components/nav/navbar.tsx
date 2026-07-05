"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ui/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import toast from "react-hot-toast";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types";

interface NavbarProps {
  user: User;
  profile: Profile | null;
}

export default function Navbar({ user, profile }: NavbarProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/");
    router.refresh();
  }

  return (
    <header
      className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80"
      data-testid="navbar"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo + nav links */}
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"
            data-testid="navbar-logo"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-brand-600 to-emerald-500 text-white">
              <svg
                width="16"
                height="16"
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
            Synchrona
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              data-testid="nav-dashboard"
            >
              Dashboard
            </Link>
          </nav>
        </div>

        {/* Right: theme toggle, user menu */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-2">
            <Avatar
              name={profile?.name || user.email || ""}
              avatarUrl={profile?.avatar_url}
              size="sm"
            />
            <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 md:inline-block">
              {profile?.name || user.email}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="btn-ghost text-sm"
            data-testid="nav-signout"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
