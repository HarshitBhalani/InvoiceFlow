"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, errMsg } from "@/lib/api";
import { useApi, usePageTitle } from "@/lib/hooks";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/providers";
import { Alert, Badge, Button, Card, ErrorState, PageHeader, Skeleton, cx } from "@/components/ui";
import type { Billing } from "../layout";

const freeFeatures = ["Up to 5 invoices", "Unlimited clients", "Dashboard and charts", "Print and PDF"];
const proFeatures = ["Unlimited invoices", "Everything in Free", "Manage billing any time", "Cancel whenever you like"];

function Features({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2 text-sm">
      {items.map((i) => (
        <li key={i} className="flex items-center gap-2">
          <Icon name="check" className="h-4 w-4 shrink-0 text-success" /> {i}
        </li>
      ))}
    </ul>
  );
}

// Asks the server to check Stripe directly (it does not depend on the webhook). True once the plan is Pro.
async function syncPlan(): Promise<boolean> {
  try {
    const { plan } = await api<{ plan: string }>("/billing/sync", { method: "POST" });
    return plan === "pro";
  } catch {
    return false;
  }
}

function BillingContent() {
  usePageTitle("Billing");
  const params = useSearchParams();
  const justPaid = params.get("success") === "1";
  const canceled = params.get("canceled") === "1";
  const { data: status, error, reload } = useApi<Billing>("/billing/status");
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [actionError, setActionError] = useState("");

  const toast = useToast();
  const [activation, setActivation] = useState<"checking" | "failed">("checking");
  const [syncing, setSyncing] = useState(false);

  // Back from Stripe: confirm with Stripe right away and retry for a while, instead of waiting for the webhook
  useEffect(() => {
    if (!justPaid) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 8 && !cancelled; i++) {
        if (await syncPlan()) {
          window.location.replace("/billing"); // full reload so the whole app shows the new plan
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setActivation("failed");
    })();
    return () => {
      cancelled = true;
    };
  }, [justPaid]);

  async function checkAgain() {
    setSyncing(true);
    setActivation("checking");
    if (await syncPlan()) {
      window.location.replace("/billing");
      return;
    }
    setActivation("failed");
    setSyncing(false);
    if (!justPaid) toast.info("No active subscription found for your account yet.");
  }

  async function go(kind: "checkout" | "portal") {
    setBusy(kind);
    setActionError("");
    try {
      const { url } = await api<{ url: string }>(`/billing/${kind}`, { method: "POST" });
      window.location.href = url;
    } catch (e) {
      setActionError(errMsg(e));
      setBusy(null);
    }
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!status) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const pro = status.plan === "pro";
  const { invoices, limit } = status.usage;
  const pct = limit ? Math.min((invoices / limit) * 100, 100) : 0;
  const sub = status.subscription;

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Your plan and subscription."
        actions={status.stripeMode === "test" ? <Badge tone="warning">Stripe test mode</Badge> : undefined}
      />

      {justPaid && !pro && activation === "checking" && <Alert tone="info">Payment received. Confirming your upgrade with Stripe...</Alert>}
      {justPaid && !pro && activation === "failed" && (
        <Alert
          tone="warning"
          action={<Button size="sm" variant="secondary" loading={syncing} onClick={checkAgain}>Check again</Button>}
        >
          We could not confirm your upgrade yet. If you were charged, click Check again. It can take a minute.
        </Alert>
      )}
      {justPaid && pro && <Alert tone="success">You are now on Pro. Thank you!</Alert>}
      {canceled && <Alert tone="warning">Checkout canceled. You were not charged.</Alert>}
      {sub?.status === "past_due" && <Alert tone="danger">Your last payment failed. Update your payment method to keep Pro.</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={cx("p-6", !pro && "ring-2 ring-primary")}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Free</h2>
            {!pro && <Badge tone="primary">Current plan</Badge>}
          </div>
          <p className="mt-2 text-4xl font-bold">$0</p>
          <Features items={freeFeatures} />
          {!pro && limit !== null && (
            <div className="mt-5">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted">Invoices used</span>
                <span className="font-medium">{invoices} / {limit}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-2" role="progressbar" aria-valuenow={invoices} aria-valuemax={limit} aria-label="Invoices used">
                <div className={cx("h-2 rounded-full", pct >= 100 ? "bg-danger" : "bg-primary")} style={{ width: `${pct}%` }} />
              </div>
              {pct >= 100 && <p className="mt-2 text-xs text-danger">You reached the free limit. Upgrade to add more invoices.</p>}
            </div>
          )}
        </Card>

        <Card className={cx("p-6", pro && "ring-2 ring-primary")}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Pro</h2>
            {pro ? <Badge tone="success">Active</Badge> : <Badge tone="primary">Recommended</Badge>}
          </div>
          <p className="mt-2 text-4xl font-bold">$19<span className="text-base font-normal text-muted">/month</span></p>
          <Features items={proFeatures} />

          {pro && sub?.currentPeriodEnd && (
            <p className="mt-5 text-sm text-muted">
              {sub.cancelAtPeriodEnd ? "Your plan ends on " : "Renews on "}
              <span className="font-medium text-fg">{formatDate(sub.currentPeriodEnd)}</span>
            </p>
          )}

          <div className="mt-6">
            {pro ? (
              <Button variant="secondary" className="w-full" onClick={() => go("portal")} loading={busy === "portal"}>
                Manage subscription
              </Button>
            ) : (
              <Button className="w-full" onClick={() => go("checkout")} loading={busy === "checkout"}>
                <Icon name="zap" /> Upgrade to Pro
              </Button>
            )}
          </div>
          {!pro && (
            <p className="mt-3 text-center text-xs text-muted">
              Secure payment by Stripe.
              {status.stripeMode === "test" && " Test mode: no real money is charged. Use card 4242 4242 4242 4242."}
            </p>
          )}
          {!pro && (
            <button type="button" onClick={checkAgain} disabled={syncing} className="mt-2 block w-full text-center text-xs font-medium text-primary hover:underline disabled:opacity-50">
              Already paid? Refresh plan status
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <BillingContent />
    </Suspense>
  );
}
