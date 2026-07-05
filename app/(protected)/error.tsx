"use client";

import { usePathname } from "next/navigation";

/**
 * Error boundary for the protected route group.
 */
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
        Error loading <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">{pathname}</code>.
        {error.message && ` ${error.message}`}
      </p>
      <button
        type="button"
        onClick={reset}
        className="btn-primary mt-4"
        data-testid="protected-error-retry"
      >
        Try again
      </button>
    </div>
  );
}
