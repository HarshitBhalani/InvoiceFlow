"use client";
import { useEffect } from "react";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted">An unexpected error occurred. Your data is safe. Try again, or reload the page.</p>
      <div className="flex gap-2">
        <button onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover">
          Try again
        </button>
        <a href="/dashboard" className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2">
          Dashboard
        </a>
      </div>
    </main>
  );
}
