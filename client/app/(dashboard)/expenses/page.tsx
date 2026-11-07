"use client";
import { useEffect, useState } from "react";
import { api, downloadFile, errMsg } from "@/lib/api";
import { useApi, useDebounce, usePageTitle } from "@/lib/hooks";
import { formatDate, money } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { useConfirm, useToast } from "@/components/providers";
import {
  Alert, Badge, Button, Card, EmptyState, ErrorState, IconButton, Modal, PageHeader, Pagination, SearchInput, SelectField, Skeleton, TextField, cx, focusFirstInvalid, inputCls,
} from "@/components/ui";
import { useShell } from "../layout";

type Expense = { _id: string; date: string; description: string; vendor: string; category: string; amount: number };
type ListRes = { expenses: Expense[]; total: number; page: number; pages: number; sum: number };

const CATEGORIES = ["software", "travel", "office", "marketing", "contractors", "taxes", "other"] as const;
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

type Form = { date: string; description: string; vendor: string; category: string; amount: string };
const blank = (): Form => ({ date: today(), description: "", vendor: "", category: "other", amount: "" });

function ExpenseModal({ expense, currency, onClose, onSaved }: { expense: Expense | null; currency: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(
    expense
      ? { date: expense.date.slice(0, 10), description: expense.description, vendor: expense.vendor, category: expense.category, amount: String(expense.amount) }
      : blank()
  );
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const v: Partial<Form> = {};
    if (!form.date || Number.isNaN(Date.parse(form.date))) v.date = "Pick a date";
    if (!form.description.trim()) v.description = "Add a description";
    const amt = Number(form.amount);
    if (form.amount === "" || !(amt > 0)) v.amount = "Enter an amount greater than 0";
    else if (amt > 100000000) v.amount = "Amount is too large";
    setErrors(v);
    if (Object.keys(v).length) return focusFirstInvalid(e.currentTarget);

    setSaving(true);
    setFormError("");
    try {
      await api(expense ? `/expenses/${expense._id}` : "/expenses", {
        method: expense ? "PUT" : "POST",
        body: JSON.stringify({ ...form, amount: amt }),
      });
      toast.success(expense ? "Expense updated" : "Expense added");
      onSaved();
    } catch (err) {
      setFormError(errMsg(err));
      setSaving(false);
    }
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  return (
    <Modal title={expense ? "Edit expense" : "New expense"} onClose={onClose}>
      <form onSubmit={save} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <TextField label="Description" value={form.description} error={errors.description} maxLength={200} placeholder="e.g. Figma subscription" onChange={set("description")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={`Amount (${currency})`} type="number" inputMode="decimal" min={0} step="0.01" value={form.amount} error={errors.amount} placeholder="0.00" onChange={set("amount")} />
          <TextField label="Date" type="date" value={form.date} error={errors.date} onChange={set("date")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Category" value={form.category} help="Used to group your spending in the reports." onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </SelectField>
          <TextField label="Vendor" optional value={form.vendor} maxLength={100} placeholder="Who you paid" onChange={set("vendor")} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{saving ? "Saving..." : "Save expense"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ExpensesPage() {
  usePageTitle("Expenses");
  const { user } = useShell();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [exporting, setExporting] = useState(false);
  const q = useDebounce(search);

  useEffect(() => { setPage(1); }, [q, category]);

  const { data, error, loading, reload } = useApi<ListRes>(
    `/expenses?page=${page}&limit=10&search=${encodeURIComponent(q)}&category=${category}`
  );
  const cur = user.currency;

  async function remove(x: Expense) {
    const ok = await confirm({ title: "Delete this expense?", message: `${x.description} (${money(x.amount, cur)}). This cannot be undone.`, confirmText: "Delete expense", danger: true });
    if (!ok) return;
    try {
      await api(`/expenses/${x._id}`, { method: "DELETE" });
      toast.success("Expense deleted");
      if (data && data.expenses.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadFile("/expenses/export", "expenses.csv");
      toast.success("Expenses exported");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setExporting(false);
    }
  }

  const isFiltering = q.trim() !== "" || category !== "";

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track what you spend, so reports show your real profit."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={!data || data.total === 0}><Icon name="download" /> Export CSV</Button>
            <Button onClick={() => setEditing("new")}><Icon name="plus" /> New expense</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search description or vendor" />
        <select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}
          className={cx(inputCls, "ui-select w-auto min-w-44")}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
        </select>
        {data && data.total > 0 && (
          <span className="ml-auto text-sm text-muted">
            {isFiltering ? "Filtered total" : "Total"}: <b className="tabular-nums text-fg">{money(data.sum, cur)}</b>
          </span>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}

      <Card className="overflow-hidden">
        {!data && !error && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>}

        {data && data.expenses.length === 0 && (
          <EmptyState
            icon="receipt"
            title={isFiltering ? "No expenses match" : "No expenses yet"}
            description={isFiltering ? "Try another search or category." : "Add your business costs (software, travel, contractors) to see your profit in Reports."}
            action={!isFiltering && <Button onClick={() => setEditing("new")}><Icon name="plus" /> Add expense</Button>}
          />
        )}

        {data && data.expenses.length > 0 && (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.expenses.map((x) => (
                  <tr key={x._id} className="hover:bg-surface-2/60">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(x.date)}</td>
                    <td className="max-w-72 px-4 py-3">
                      <p className="truncate font-medium">{x.description}</p>
                      {x.vendor && <p className="truncate text-xs text-muted">{x.vendor}</p>}
                    </td>
                    <td className="px-4 py-3"><Badge tone="neutral"><span className="capitalize">{x.category}</span></Badge></td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{money(x.amount, cur)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <IconButton icon="pencil" label={`Edit ${x.description}`} onClick={() => setEditing(x)} />
                        <IconButton icon="trash" tone="danger" label={`Delete ${x.description}`} onClick={() => remove(x)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {data.expenses.map((x) => (
                <li key={x._id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{x.description}</p>
                      <p className="text-xs text-muted">{formatDate(x.date)}{x.vendor ? ` · ${x.vendor}` : ""}</p>
                    </div>
                    <p className="font-semibold tabular-nums">{money(x.amount, cur)}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge tone="neutral"><span className="capitalize">{x.category}</span></Badge>
                    <div className="flex">
                      <IconButton icon="pencil" label={`Edit ${x.description}`} onClick={() => setEditing(x)} />
                      <IconButton icon="trash" tone="danger" label={`Delete ${x.description}`} onClick={() => remove(x)} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
      </Card>

      {editing && (
        <ExpenseModal
          expense={editing === "new" ? null : editing}
          currency={cur}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}
