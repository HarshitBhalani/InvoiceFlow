"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, errMsg } from "@/lib/api";
import { usePageTitle } from "@/lib/hooks";
import { Spinner } from "@/components/ui";
import { Icon } from "@/components/Icon";

function Verify() {
  usePageTitle("Verify email");
  const token = useSearchParams().get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "This verification link is incomplete.");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return; // the token is single-use, so never call twice (React strict mode runs effects twice in dev)
    started.current = true;
    api("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => setState("ok"))
      .catch((e) => {
        setMessage(errMsg(e));
        setState("error");
      });
  }, [token]);

  if (state === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Spinner className="h-8 w-8 text-primary" />
        <p className="text-sm text-muted">Verifying your email...</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${state === "ok" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
        <Icon name={state === "ok" ? "checkCircle" : "alert"} className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{state === "ok" ? "Email verified" : "Could not verify"}</h1>
      <p className="mt-2 text-sm text-muted">
        {state === "ok" ? "Thanks! You can now send invoices to your clients." : message}
      </p>
      <Link href="/dashboard" className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg hover:bg-primary-hover">
        Go to dashboard
      </Link>
      {state === "error" && <p className="mt-4 text-xs text-muted">Log in and use the banner on the dashboard to get a new link.</p>}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
