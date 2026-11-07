"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

// Landing page header buttons: shows "Dashboard" when the visitor is already logged in
export function AuthCta({ className = "" }: { className?: string }) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    api("/auth/me")
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false));
  }, []);

  const primary = "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {loggedIn ? (
        <Link href="/dashboard" className={primary}>
          Open dashboard
        </Link>
      ) : (
        <>
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-fg">
            Log in
          </Link>
          <Link href="/signup" className={primary}>
            Get started free
          </Link>
        </>
      )}
    </div>
  );
}
