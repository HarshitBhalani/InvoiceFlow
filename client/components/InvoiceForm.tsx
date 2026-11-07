"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { api, ApiError, errMsg } from "@/lib/api";
import { money } from "@/lib/format";
import {
  Alert, Button, FieldShell, IconButton, Modal, SelectField, TextField, fieldCls, focusFirstInvalid,
} from "@/components/ui";
import { Icon } from "@/components/Icon";

export type Item = { description: string; quantity: number; unitPrice: number };
export type ClientOption = { _id: string; name: string };
export type InvoiceData = {
  _id: string;
  number: number;
  clientId: { _id: string; name: string; email?: string; company?: string } | null;
  items: Item[];
  currency?: string;
  taxRate?: number;
  subtotal?: number;
  taxAmount?: number;
  total: number;
  status: string;
  isOverdue?: boolean;
  dueDate: string;
  createdAt: string;
  paidAt?: string;
  sentAt?: string;
  recurring?: { active: boolean; frequency?: string; nextRun?: string; autoSend?: boolean };
};

export const STATUSES = ["draft", "sent", "paid", "overdue"] as const;

const blankItem = (): Item => ({ description: "", quantity: 1, unitPrice: 0 });
const toInputDate = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const in14Days = () => toInputDate(new Date(Date.now() + 14 * 864e5));

type FormState = { clientId: string; status: string; dueDate: string; taxRate: number; items: Item[] };

function initial(invoice: InvoiceData | null, copyFrom: InvoiceData | null | undefined, defaultTaxRate: number): FormState {
  if (invoice) {
    return {
      clientId: invoice.clientId?._id || "",
      status: invoice.status,
      dueDate: toInputDate(new Date(invoice.dueDate)),
      taxRate: invoice.taxRate || 0,
      items: invoice.items.map((i) => ({ ...i })),
    };
  }
  if (copyFrom) {
    // Duplicate: same client and items, but a fresh draft with a new due date
    return {
      clientId: copyFrom.clientId?._id || "",
      status: "draft",
      dueDate: in14Days(),
      taxRate: copyFrom.taxRate || 0,
      items: copyFrom.items.map((i) => ({ ...i })),
    };
  }
  return { clientId: "", status: "draft", dueDate: in14Days(), taxRate: defaultTaxRate, items: [blankItem()] };
}

type ItemErrors = { description?: string; quantity?: string; unitPrice?: string };
type Errors = { clientId?: string; dueDate?: string; taxRate?: string; items?: ItemErrors[] };

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.clientId) e.clientId = "Select a client";
  if (!f.dueDate || Number.isNaN(Date.parse(f.dueDate))) e.dueDate = "Pick a due date";
  if (!(f.taxRate >= 0 && f.taxRate <= 100)) e.taxRate = "Enter a rate between 0 and 100";
  const items = f.items.map<ItemErrors>((i) => {
    const r: ItemErrors = {};
    if (!i.description.trim()) r.description = "Add a description";
    if (!Number.isInteger(i.quantity) || i.quantity < 1) r.quantity = "Whole number, 1 or more";
    else if (i.quantity > 100000) r.quantity = "Too large";
    if (!(i.unitPrice >= 0)) r.unitPrice = "Cannot be negative";
    else if (i.unitPrice > 10000000) r.unitPrice = "Too large";
    return r;
  });
  if (items.some((r) => Object.keys(r).length)) e.items = items;
  return e;
}

export default function InvoiceForm({
  invoice,
  copyFrom,
  clients,
  currency,
  defaultTaxRate,
  onClose,
  onSaved,
}: {
  invoice: InvoiceData | null;
  copyFrom?: InvoiceData | null;
  clients: ClientOption[];
  currency: string; // the invoice keeps the currency it was created in
  defaultTaxRate: number;
  onClose: () => void;
  onSaved: (inv: InvoiceData) => void;
}) {
  const baseId = useId();
  const [form, setForm] = useState<FormState>(() => initial(invoice, copyFrom, defaultTaxRate));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<{ message: string; limit: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const cur = invoice?.currency || currency;
  const subtotal = form.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const taxAmount = (subtotal * (Number(form.taxRate) || 0)) / 100;
  const total = subtotal + taxAmount;
  const setItem = (idx: number, patch: Partial<Item>) => {
    setForm({ ...form, items: form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
    // clear the error of the field being edited
    const keys = Object.keys(patch) as (keyof ItemErrors)[];
    if (errors.items?.[idx] && keys.some((k) => errors.items![idx][k])) {
      const items = errors.items.map((r, i) => (i === idx ? { ...r, ...Object.fromEntries(keys.map((k) => [k, undefined])) } : r));
      setErrors({ ...errors, items });
    }
  };

  // A deleted client can still be referenced by an old invoice: keep it selectable so editing does not silently change it
  const options =
    invoice?.clientId && !clients.some((c) => c._id === invoice.clientId!._id)
      ? [...clients, { _id: invoice.clientId._id, name: invoice.clientId.name }]
      : clients;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return focusFirstInvalid(e.currentTarget);

    setSaving(true);
    setFormError(null);
    try {
      const res = await api<{ invoice: InvoiceData }>(invoice ? `/invoices/${invoice._id}` : "/invoices", {
        method: invoice ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      onSaved(res.invoice);
    } catch (err) {
      setFormError({ message: errMsg(err), limit: err instanceof ApiError && err.code === "PLAN_LIMIT" });
      setSaving(false);
    }
  }

  const title = invoice ? `Edit invoice #${invoice.number}` : copyFrom ? "Duplicate invoice" : "New invoice";

  return (
    <Modal title={title} onClose={onClose} size="lg">
      <form onSubmit={save} noValidate className="space-y-4">
        {formError && (
          <Alert
            tone="danger"
            action={formError.limit && <Link href="/billing" className="font-semibold underline">Upgrade</Link>}
          >
            {formError.message}
          </Alert>
        )}

        <SelectField
          label="Client"
          value={form.clientId}
          error={errors.clientId}
          onChange={(e) => {
            setForm({ ...form, clientId: e.target.value });
            if (errors.clientId) setErrors({ ...errors, clientId: undefined });
          }}
        >
          <option value="">Select a client...</option>
          {options.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </SelectField>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Due date"
            type="date"
            value={form.dueDate}
            error={errors.dueDate}
            help="The invoice counts as overdue the day after this date if it is still unpaid."
            onChange={(e) => {
              setForm({ ...form, dueDate: e.target.value });
              if (errors.dueDate) setErrors({ ...errors, dueDate: undefined });
            }}
          />
          <SelectField
            label="Status"
            value={form.status}
            help="Draft: not sent yet. Sent: waiting for payment. Paid: money received."
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </SelectField>
        </div>

        <TextField
          label="Tax rate (%)"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={form.taxRate === 0 ? "" : form.taxRate}
          placeholder="0"
          error={errors.taxRate}
          help="VAT / GST / sales tax added on top of the subtotal. Leave empty for no tax."
          onChange={(e) => {
            setForm({ ...form, taxRate: e.target.value === "" ? 0 : Number(e.target.value) });
            if (errors.taxRate) setErrors({ ...errors, taxRate: undefined });
          }}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Line items</legend>
          <div className="hidden gap-2 px-1 pb-1 text-xs text-muted sm:grid sm:grid-cols-[1fr_5rem_7rem_6rem_2rem]">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          <div className="space-y-3">
            {form.items.map((it, idx) => {
              const er = errors.items?.[idx] ?? {};
              const rid = `${baseId}-${idx}`;
              return (
                <div key={idx} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_5rem_7rem_6rem_2rem] sm:items-center">
                  <div className="col-span-2 sm:col-span-1">
                    <FieldShell id={`${rid}-d`} error={er.description}>
                      <input
                        aria-label={`Item ${idx + 1} description`}
                        aria-invalid={!!er.description}
                        aria-describedby={er.description ? `${rid}-d-err` : undefined}
                        placeholder="e.g. Website design"
                        maxLength={200}
                        value={it.description}
                        onChange={(e) => setItem(idx, { description: e.target.value })}
                        className={fieldCls(er.description)}
                      />
                    </FieldShell>
                  </div>
                  <FieldShell id={`${rid}-q`} error={er.quantity} icon={false}>
                    <input
                      aria-label={`Item ${idx + 1} quantity`}
                      aria-invalid={!!er.quantity}
                      aria-describedby={er.quantity ? `${rid}-q-err` : undefined}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={it.quantity || ""}
                      onChange={(e) => setItem(idx, { quantity: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className={fieldCls(er.quantity, "!pr-3")}
                    />
                  </FieldShell>
                  <FieldShell id={`${rid}-p`} error={er.unitPrice} icon={false}>
                    <input
                      aria-label={`Item ${idx + 1} unit price`}
                      aria-invalid={!!er.unitPrice}
                      aria-describedby={er.unitPrice ? `${rid}-p-err` : undefined}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={it.unitPrice === 0 ? "" : it.unitPrice}
                      placeholder="0.00"
                      onChange={(e) => setItem(idx, { unitPrice: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className={fieldCls(er.unitPrice, "!pr-3")}
                    />
                  </FieldShell>
                  <span className="text-right text-sm tabular-nums">
                    {money((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), cur)}
                  </span>
                  <div className="flex justify-end">
                    {form.items.length > 1 && (
                      <IconButton
                        type="button"
                        icon="trash"
                        label={`Remove item ${idx + 1}`}
                        tone="danger"
                        onClick={() => {
                          setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
                          if (errors.items) setErrors({ ...errors, items: errors.items.filter((_, i) => i !== idx) });
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3"
            disabled={form.items.length >= 50}
            onClick={() => setForm({ ...form, items: [...form.items, blankItem()] })}
          >
            <Icon name="plus" className="h-3.5 w-3.5" /> Add item
          </Button>
        </fieldset>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
          <div className="text-sm tabular-nums">
            {form.taxRate > 0 && (
              <p className="text-muted">
                Subtotal {money(subtotal, cur)} + tax ({form.taxRate}%) {money(taxAmount, cur)}
              </p>
            )}
            <p>
              <span className="text-muted">Total </span>
              <span className="text-lg font-bold">{money(total, cur)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? "Saving..." : invoice ? "Save changes" : "Create invoice"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
