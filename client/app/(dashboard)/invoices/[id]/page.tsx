"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, downloadFile, errMsg } from "@/lib/api";
import { useApi, usePageTitle } from "@/lib/hooks";
import { daysUntil, formatDate, money } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { useConfirm, useToast } from "@/components/providers";
import InvoiceForm, { type ClientOption, type InvoiceData } from "@/components/InvoiceForm";
import { RecurringModal, SendInvoiceModal } from "@/components/InvoiceActions";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Skeleton, StatusBadge } from "@/components/ui";
import { useShell } from "../../layout";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, refreshBilling } = useShell();
  const [modal, setModal] = useState<"edit" | "send" | "recurring" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, error, reload } = useApi<{ invoice: InvoiceData }>(`/invoices/${id}`);
  const clientsRes = useApi<{ clients: ClientOption[] }>("/clients/options");
  const inv = data?.invoice;
  usePageTitle(inv ? `Invoice #${inv.number}` : "Invoice");

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const markPaid = () =>
    run("paid", async () => {
      await api(`/invoices/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) });
      toast.success("Marked as paid");
      reload();
    });

  const downloadPdf = () => run("pdf", () => downloadFile(`/invoices/${id}/pdf`, `invoice-${inv?.number}.pdf`));

  const copyLink = () =>
    run("link", async () => {
      const { url } = await api<{ url: string }>(`/invoices/${id}/link`, { method: "POST" });
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied. Anyone with it can view and pay this invoice.");
      } catch {
        window.prompt("Copy this link:", url); // clipboard blocked (insecure context / permissions)
      }
    });

  async function remove() {
    if (!inv) return;
    const ok = await confirm({ title: `Delete invoice #${inv.number}?`, message: "This cannot be undone.", confirmText: "Delete invoice", danger: true });
    if (!ok) return;
    await run("delete", async () => {
      await api(`/invoices/${inv._id}`, { method: "DELETE" });
      toast.success("Invoice deleted");
      refreshBilling();
      router.replace("/invoices");
    });
  }

  if (error) {
    const missing = /not found/i.test(error);
    return missing ? (
      <Card>
        <EmptyState icon="fileText" title="Invoice not found" description="It may have been deleted, or the link is wrong."
          action={<Link href="/invoices" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg">Back to invoices</Link>} />
      </Card>
    ) : (
      <ErrorState message={error} onRetry={reload} />
    );
  }

  if (!inv) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const cur = inv.currency || user.currency;
  const status = inv.isOverdue ? "overdue" : inv.status;
  const late = inv.status !== "paid" && daysUntil(inv.dueDate) < 0 ? -daysUntil(inv.dueDate) : 0;
  const subtotal = inv.subtotal ?? inv.total;
  const recurring = inv.recurring?.active;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/invoices" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
          <Icon name="arrowLeft" /> All invoices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {inv.status !== "paid" && (
            <Button onClick={() => setModal("send")}><Icon name="send" /> {inv.sentAt ? "Resend" : "Send"}</Button>
          )}
          {inv.status !== "paid" && (
            <Button variant="secondary" onClick={markPaid} loading={busy === "paid"}><Icon name="checkCircle" /> Mark paid</Button>
          )}
          <Button variant="secondary" onClick={downloadPdf} loading={busy === "pdf"}><Icon name="download" /> PDF</Button>
          <Button variant="secondary" onClick={copyLink} loading={busy === "link"}><Icon name="link" /> Copy link</Button>
          <Button variant="secondary" onClick={() => setModal("recurring")}>
            <Icon name="repeat" /> Recurring{recurring && <Badge tone="success">on</Badge>}
          </Button>
          <Button variant="secondary" onClick={() => setModal("edit")}><Icon name="pencil" /> Edit</Button>
          <Button variant="ghost" onClick={remove} disabled={busy === "delete"} className="hover:!text-danger"><Icon name="trash" /> Delete</Button>
        </div>
      </div>

      <div className="print:hidden">
        {late > 0 && <Alert tone="danger">This invoice is {late} day{late === 1 ? "" : "s"} past its due date.</Alert>}
        {inv.sentAt && inv.status !== "paid" && <Alert tone="info">Emailed to the client on {formatDate(inv.sentAt)}.</Alert>}
      </div>

      <article className="invoice-paper mx-auto max-w-3xl rounded-xl border border-line bg-surface p-6 shadow-sm md:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoice</h1>
            <p className="mt-1 text-muted">#{inv.number}</p>
          </div>
          <StatusBadge status={status} />
        </header>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">From</p>
            <p className="mt-1 font-medium">{user.businessName || user.name}</p>
            {user.businessName && <p className="text-sm">{user.name}</p>}
            <p className="text-sm text-muted">{user.email}</p>
            {user.address && <p className="mt-1 whitespace-pre-line text-sm text-muted">{user.address}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bill to</p>
            {inv.clientId ? (
              <>
                <p className="mt-1 font-medium">{inv.clientId.name}</p>
                {inv.clientId.company && <p className="text-sm">{inv.clientId.company}</p>}
                <p className="text-sm text-muted">{inv.clientId.email}</p>
              </>
            ) : (
              <p className="mt-1 text-muted">Client was deleted</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Issued</p>
            <p className="mt-1">{formatDate(inv.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{inv.status === "paid" ? "Paid" : "Due"}</p>
            <p className="mt-1">{formatDate(inv.status === "paid" && inv.paidAt ? inv.paidAt : inv.dueDate)}</p>
          </div>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Price</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {inv.items.map((it, i) => (
                <tr key={i}>
                  <td className="break-words py-3 pr-4">{it.description}</td>
                  <td className="py-3 text-right tabular-nums">{it.quantity}</td>
                  <td className="py-3 text-right tabular-nums">{money(it.unitPrice, cur)}</td>
                  <td className="py-3 text-right font-medium tabular-nums">{money(it.quantity * it.unitPrice, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end border-t border-line pt-4">
          <div className="min-w-56 space-y-1 text-right text-sm tabular-nums">
            {(inv.taxRate ?? 0) > 0 && (
              <>
                <p className="flex justify-between gap-6 text-muted"><span>Subtotal</span><span>{money(subtotal, cur)}</span></p>
                <p className="flex justify-between gap-6 text-muted"><span>Tax ({inv.taxRate}%)</span><span>{money(inv.taxAmount || 0, cur)}</span></p>
              </>
            )}
            <p className="pt-1 text-sm text-muted">Total due</p>
            <p className="text-3xl font-bold">{money(inv.total, cur)}</p>
          </div>
        </div>
      </article>

      {modal === "edit" && (
        <InvoiceForm
          invoice={inv}
          clients={clientsRes.data?.clients ?? []}
          currency={user.currency}
          defaultTaxRate={user.defaultTaxRate}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            toast.success("Invoice updated");
            reload();
          }}
        />
      )}
      {modal === "send" && (
        <SendInvoiceModal
          invoice={inv}
          onClose={() => setModal(null)}
          onSent={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal === "recurring" && (
        <RecurringModal
          invoice={inv}
          plan={user.plan}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
