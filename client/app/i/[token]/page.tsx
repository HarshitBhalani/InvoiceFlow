"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api, errMsg } from "@/lib/api";
import { useApi, usePageTitle } from "@/lib/hooks";
import { daysUntil, formatDate, money } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { Alert, Button, Skeleton, StatusBadge } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

type PublicInvoice = {
  invoice: {
    number: number;
    currency: string;
    items: { description: string; quantity: number; unitPrice: number }[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    status: string;
    dueDate: string;
    issuedAt: string;
    paidAt?: string;
  };
  client: { name: string; company?: string; email: string } | null;
  seller: { name: string; contactName: string; email: string; address: string; logo: string; accentColor: string; template: string };
  canPay: boolean;
  stripeMode?: "test" | "live" | null;
};

function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const justPaid = useSearchParams().get("paid") === "1";
  const { data, error, reload } = useApi<PublicInvoice>(`/public/invoices/${token}`);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  usePageTitle(data ? `Invoice #${data.invoice.number} from ${data.seller.name}` : "Invoice");

  // After returning from Stripe the webhook can take a few seconds: keep checking until it shows as paid
  const status = data?.invoice.status;
  const [confirmFailed, setConfirmFailed] = useState(false);
  useEffect(() => {
    if (!justPaid || status === "paid" || status === undefined) return;
    let cancelled = false;
    (async () => {
      // Ask the server to check with Stripe (works even if the webhook is late or not running)
      for (let i = 0; i < 8 && !cancelled; i++) {
        try {
          const r = await api<{ status: string }>(`/public/invoices/${token}/confirm`, { method: "POST" });
          if (r.status === "paid") {
            reload();
            return;
          }
        } catch {
          /* keep trying */
        }
        await new Promise((res) => setTimeout(res, 2500));
      }
      if (!cancelled) setConfirmFailed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [justPaid, status, token, reload]);

  async function pay() {
    setPaying(true);
    setPayError("");
    try {
      const { url } = await api<{ url: string }>(`/public/invoices/${token}/pay`, { method: "POST" });
      window.location.href = url;
    } catch (e) {
      setPayError(errMsg(e));
      setPaying(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto mt-24 max-w-md px-4 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <Icon name="alert" className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Invoice not available</h1>
        <p className="mt-2 text-sm text-muted">{/valid|not found/i.test(error) ? "This invoice link is not valid. Ask the sender for a new one." : error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 pt-16">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const { invoice: inv, client, seller } = data;
  const cur = inv.currency;
  const paid = inv.status === "paid";
  const late = !paid && daysUntil(inv.dueDate) < 0 ? -daysUntil(inv.dueDate) : 0;
  const modern = seller.template === "modern";

  return (
    // The seller's accent color is applied by overriding the primary color variables for this page only
    <div style={{ ["--primary" as string]: seller.accentColor, ["--primary-hover" as string]: seller.accentColor }} className="min-h-screen">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-6 print:hidden">
        <span className="text-xs text-muted">Secure invoice link</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => window.print()}><Icon name="printer" /> Print / PDF</Button>
          <ThemeToggle />
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="print:hidden">
          {justPaid && paid && <Alert tone="success">Payment received. Thank you!</Alert>}
          {justPaid && !paid && !confirmFailed && <Alert tone="info">Payment received. Confirming with Stripe...</Alert>}
          {justPaid && !paid && confirmFailed && (
            <Alert tone="warning">We could not confirm the payment yet. If you were charged, the invoice will show as paid shortly. You can refresh this page in a minute.</Alert>
          )}
          {late > 0 && <Alert tone="danger">This invoice is {late} day{late === 1 ? "" : "s"} past due.</Alert>}
          {payError && <Alert tone="danger">{payError}</Alert>}
        </div>

        <article className="invoice-paper overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          <header className={`flex flex-wrap items-start justify-between gap-4 p-6 md:p-10 ${modern ? "bg-primary text-primary-fg" : ""}`}>
            <div>
              {seller.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={seller.logo} alt={seller.name} className="max-h-14 max-w-48 object-contain" />
              ) : (
                <p className="text-lg font-bold">{seller.name}</p>
              )}
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-bold tracking-tight">Invoice</h1>
              <p className={modern ? "opacity-80" : "text-muted"}>#{inv.number}</p>
            </div>
          </header>

          <div className="p-6 pt-0 md:p-10 md:pt-0">
            <div className={`flex flex-wrap items-center justify-between gap-3 ${modern ? "pt-6" : ""}`}>
              <StatusBadge status={inv.status} />
              <div className="text-sm text-muted">
                Issued {formatDate(inv.issuedAt)} · {paid && inv.paidAt ? `Paid ${formatDate(inv.paidAt)}` : `Due ${formatDate(inv.dueDate)}`}
              </div>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">From</p>
                <p className="mt-1 font-medium">{seller.name}</p>
                {seller.contactName && <p className="text-sm">{seller.contactName}</p>}
                <p className="text-sm text-muted">{seller.email}</p>
                {seller.address && <p className="mt-1 whitespace-pre-line text-sm text-muted">{seller.address}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bill to</p>
                {client ? (
                  <>
                    <p className="mt-1 font-medium">{client.name}</p>
                    {client.company && <p className="text-sm">{client.company}</p>}
                    <p className="text-sm text-muted">{client.email}</p>
                  </>
                ) : (
                  <p className="mt-1 text-muted">-</p>
                )}
              </div>
            </div>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={`text-xs uppercase tracking-wide ${modern ? "bg-primary text-primary-fg" : "border-b border-line text-muted"}`}>
                  <tr>
                    <th className="px-2 py-2 font-medium">Description</th>
                    <th className="px-2 py-2 text-right font-medium">Qty</th>
                    <th className="px-2 py-2 text-right font-medium">Price</th>
                    <th className="px-2 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {inv.items.map((it, i) => (
                    <tr key={i}>
                      <td className="break-words px-2 py-3">{it.description}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{it.quantity}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{money(it.unitPrice, cur)}</td>
                      <td className="px-2 py-3 text-right font-medium tabular-nums">{money(it.quantity * it.unitPrice, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end border-t border-line pt-4">
              <div className="min-w-56 space-y-1 text-right text-sm tabular-nums">
                {inv.taxRate > 0 && (
                  <>
                    <p className="flex justify-between gap-6 text-muted"><span>Subtotal</span><span>{money(inv.subtotal, cur)}</span></p>
                    <p className="flex justify-between gap-6 text-muted"><span>Tax ({inv.taxRate}%)</span><span>{money(inv.taxAmount, cur)}</span></p>
                  </>
                )}
                <p className="pt-1 text-sm text-muted">{paid ? "Total paid" : "Total due"}</p>
                <p className="text-3xl font-bold">{money(inv.total, cur)}</p>
              </div>
            </div>
          </div>
        </article>

        {!paid && data.canPay && (
          <div className="mt-6 text-center print:hidden">
            <Button onClick={pay} loading={paying} className="px-8 py-3 text-base">
              <Icon name="creditCard" /> Pay {money(inv.total, cur)} now
            </Button>
            <p className="mt-2 text-xs text-muted">Secure card payment by Stripe.</p>
            {data.stripeMode === "test" && (
              <p className="mx-auto mt-2 max-w-sm rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
                Test mode: no real money is charged. Pay with card 4242 4242 4242 4242, any future date and any CVC.
              </p>
            )}
          </div>
        )}
        {!paid && !data.canPay && (
          <p className="mt-6 text-center text-sm text-muted print:hidden">
            Online payment is not available for this invoice. Please contact {seller.name} at {seller.email}.
          </p>
        )}
        <p className="mt-10 text-center text-xs text-muted print:hidden">Invoice sent with InvoiceFlow</p>
      </main>
    </div>
  );
}

export default function PublicInvoicePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl p-4 pt-16"><Skeleton className="h-96" /></div>}>
      <PublicInvoice />
    </Suspense>
  );
}
