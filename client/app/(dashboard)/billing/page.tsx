"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, errMsg } from "@/lib/api";
import { formatDate } from "@/lib/hooks";
import { btnPrimary, btnGhost } from "@/components/ui";

type Status = {
  plan: "free" | "pro";
  usage: { invoices: number; limit: number | null };
  subscription: { status: string; currentPeriodEnd?: string; cancelAtPeriodEnd: boolean } | null;
};

function BillingContent() {
  const params = useSearchParams();
  const justPaid = params.get("success") === "1";
  const canceled = params.get("canceled") === "1";
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<Status>("/billing/status");
      setStatus(s);
      return s;
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // After Stripe redirects back, the webhook may take a moment: poll until the plan flips to pro
  useEffect(() => {
    if (!justPaid) return;
    let tries = 0;
    const t = setInterval(async () => {
      const s = await load();
      tries++;
      if (s?.plan === "pro") {
        clearInterval(t);
        window.location.replace("/billing"); // reload so the sidebar shows the new plan
      } else if (tries >= 10) clearInterval(t);
    }, 2000);
    return () => clearInterval(t);
  }, [justPaid, load]);

  async function go(path: "/billing/checkout" | "/billing/portal") {
    setBusy(true);
    setError("");
    try {
      const { url } = await api<{ url: string }>(path, { method: "POST" });
      window.location.href = url;
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  }

  if (!status) return <p className="text-gray-500">{error || "Loading..."}</p>;

  const pro = status.plan === "pro";
  const { invoices, limit } = status.usage;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Billing</h1>

      {justPaid && !pro && (
        <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Payment received. Activating your Pro plan...</p>
      )}
      {canceled && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Checkout canceled. No charge was made.</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Current plan</p>
            <p className="text-2xl font-bold capitalize">{status.plan}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pro ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
            {pro ? "Active" : "Free"}
          </span>
        </div>

        {!pro && limit !== null && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-sm">
              <span>Invoices used</span>
              <span>{invoices} / {limit}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${Math.min((invoices / limit) * 100, 100)}%` }} />
            </div>
          </div>
        )}

        {pro && status.subscription?.currentPeriodEnd && (
          <p className="mt-4 text-sm text-gray-600">
            {status.subscription.cancelAtPeriodEnd ? "Ends on " : "Renews on "}
            {formatDate(status.subscription.currentPeriodEnd)}
          </p>
        )}

        <div className="mt-6">
          {pro ? (
            <button className={btnGhost} onClick={() => go("/billing/portal")} disabled={busy}>Manage subscription</button>
          ) : (
            <button className={btnPrimary} onClick={() => go("/billing/checkout")} disabled={busy}>
              {busy ? "Redirecting..." : "Upgrade to Pro"}
            </button>
          )}
        </div>
      </div>

      {!pro && (
        <div className="mt-4 rounded-xl border bg-white p-6 text-sm">
          <p className="mb-2 font-semibold">Pro includes</p>
          <ul className="list-inside list-disc space-y-1 text-gray-600">
            <li>Unlimited invoices</li>
            <li>Priority support</li>
          </ul>
          <p className="mt-3 text-xs text-gray-400">Test mode: use card 4242 4242 4242 4242, any future date, any CVC.</p>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
      <BillingContent />
    </Suspense>
  );
}
