"use client";
import { useState } from "react";
import Link from "next/link";
import { api, ApiError, errMsg } from "@/lib/api";
import { formatDate, money } from "@/lib/format";
import { Alert, Badge, Button, Modal, SelectField, TextareaField } from "@/components/ui";
import { useToast } from "@/components/providers";
import type { InvoiceData } from "@/components/InvoiceForm";

/* ---------- Send by email ---------- */
export function SendInvoiceModal({
  invoice,
  onClose,
  onSent,
}: {
  invoice: InvoiceData;
  onClose: () => void;
  onSent: (inv: InvoiceData) => void;
}) {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<{ text: string; code?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const client = invoice.clientId;
  const cur = invoice.currency || "USD";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await api<{ invoice: InvoiceData; sentTo: string }>(`/invoices/${invoice._id}/send`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      toast.success(`Invoice #${invoice.number} sent to ${res.sentTo}`);
      onSent(res.invoice);
    } catch (err) {
      setError({ text: errMsg(err), code: err instanceof ApiError ? err.code : undefined });
      setSending(false);
    }
  }

  return (
    <Modal title={`Send invoice #${invoice.number}`} onClose={onClose}>
      {!client ? (
        <Alert tone="danger">This invoice&apos;s client was deleted, so there is nobody to send it to.</Alert>
      ) : (
        <form onSubmit={send} noValidate className="space-y-4">
          {error && (
            <Alert tone="danger">
              {error.text}
              {error.code === "EMAIL_UNVERIFIED" && <span className="block text-xs">Use the banner at the top of the page to resend the verification email.</span>}
            </Alert>
          )}
          <div className="rounded-lg bg-surface-2 p-3 text-sm">
            <p>
              <span className="text-muted">To: </span>
              <b>{client.name}</b> &lt;{client.email}&gt;
            </p>
            <p>
              <span className="text-muted">Amount: </span>
              <b>{money(invoice.total, cur)}</b> <span className="text-muted">due {formatDate(invoice.dueDate)}</span>
            </p>
          </div>
          <TextareaField
            label="Message"
            optional
            maxLength={1000}
            value={message}
            help="A short personal note shown above the invoice link in the email."
            placeholder="Hi, here is the invoice for last month's work. Thanks!"
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-xs text-muted">
            Your client gets an email with a link to view{invoice.status !== "paid" ? " and pay" : ""} this invoice online. Replies go to your email address.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={sending}>
              {sending ? "Sending..." : invoice.sentAt ? "Send again" : "Send invoice"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ---------- Recurring ---------- */
const FREQUENCIES = [
  { value: "none", label: "Do not repeat" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "yearly", label: "Every year" },
];

export function RecurringModal({
  invoice,
  plan,
  onClose,
  onSaved,
}: {
  invoice: InvoiceData;
  plan: string;
  onClose: () => void;
  onSaved: (inv: InvoiceData) => void;
}) {
  const toast = useToast();
  const active = !!invoice.recurring?.active;
  const [frequency, setFrequency] = useState(active ? invoice.recurring!.frequency || "monthly" : "monthly");
  const [autoSend, setAutoSend] = useState(!!invoice.recurring?.autoSend);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pro = plan === "pro";

  async function save(freq: string) {
    setSaving(true);
    setError("");
    try {
      const res = await api<{ invoice: InvoiceData }>(`/invoices/${invoice._id}/recurring`, {
        method: "PUT",
        body: JSON.stringify({ frequency: freq, autoSend }),
      });
      toast.success(freq === "none" ? "Recurring billing stopped" : "Recurring billing saved");
      onSaved(res.invoice);
    } catch (err) {
      setError(errMsg(err));
      setSaving(false);
    }
  }

  return (
    <Modal title="Recurring invoice" onClose={onClose}>
      <div className="space-y-4">
        {!pro && (
          <Alert tone="warning" action={<Link href="/billing" className="font-semibold underline">Upgrade</Link>}>
            Recurring invoices are a Pro feature.
          </Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <p className="text-sm text-muted">
          This invoice becomes a template. A copy with the same client, items and tax is created automatically on each repeat.
        </p>
        {active && invoice.recurring?.nextRun && (
          <p className="text-sm">
            <Badge tone="success">Active</Badge> Next invoice on <b>{formatDate(invoice.recurring.nextRun)}</b>
          </p>
        )}
        <SelectField label="Repeat" value={frequency} disabled={!pro} onChange={(e) => setFrequency(e.target.value)}>
          {FREQUENCIES.filter((f) => f.value !== "none").map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </SelectField>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={autoSend} disabled={!pro} onChange={(e) => setAutoSend(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
          <span>
            Email each new invoice to the client automatically
            <span className="block text-xs text-muted">If off, copies are created as drafts for you to review and send.</span>
          </span>
        </label>
        <div className="flex justify-between gap-2 pt-2">
          {active ? (
            <Button variant="ghost" className="hover:!text-danger" disabled={saving} onClick={() => save("none")}>
              Stop recurring
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={saving} disabled={!pro} onClick={() => save(frequency)}>
              {active ? "Update" : "Start recurring"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
