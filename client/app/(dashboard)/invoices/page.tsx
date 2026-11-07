"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "@/lib/api";
import { formatDate, money, useDebounce } from "@/lib/hooks";
import { Modal, Pagination, StatusBadge, btnGhost, btnPrimary, inputCls } from "@/components/ui";

type Item = { description: string; quantity: number; unitPrice: number };
type Client = { _id: string; name: string };
type Invoice = {
  _id: string;
  number: number;
  clientId: { _id: string; name: string } | null;
  items: Item[];
  total: number;
  status: string;
  dueDate: string;
};
type ListRes = { invoices: Invoice[]; total: number; page: number; pages: number };

const STATUSES = ["draft", "sent", "paid", "overdue"];
const blankItem = (): Item => ({ description: "", quantity: 1, unitPrice: 0 });
const blankForm = () => ({
  clientId: "",
  status: "draft",
  dueDate: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
  items: [blankItem()],
});

export default function InvoicesPage() {
  const [data, setData] = useState<ListRes | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Invoice | "new" | null>(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const q = useDebounce(search);

  const load = useCallback(async () => {
    try {
      const qs = `page=${page}&search=${encodeURIComponent(q)}&status=${status}`;
      setData(await api<ListRes>(`/invoices?${qs}`));
    } catch (e) {
      setError(errMsg(e));
    }
  }, [page, q, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, status]);
  useEffect(() => {
    api<{ clients: Client[] }>("/clients?limit=50").then((d) => setClients(d.clients)).catch(() => {});
  }, []);

  function open(inv: Invoice | "new") {
    setError("");
    if (inv === "new") setForm(blankForm());
    else
      setForm({
        clientId: inv.clientId?._id || "",
        status: inv.status,
        dueDate: inv.dueDate.slice(0, 10),
        items: inv.items.map((i) => ({ ...i })),
      });
    setEditing(inv);
  }

  const setItem = (idx: number, patch: Partial<Item>) =>
    setForm({ ...form, items: form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  const formTotal = form.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const isNew = editing === "new";
      await api(isNew ? "/invoices" : `/invoices/${(editing as Invoice)._id}`, {
        method: isNew ? "POST" : "PUT",
        body: JSON.stringify(form),
      });
      setEditing(null);
      load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(inv: Invoice, s: string) {
    try {
      await api(`/invoices/${inv._id}/status`, { method: "PATCH", body: JSON.stringify({ status: s }) });
      load();
    } catch (e) {
      alert(errMsg(e));
    }
  }

  async function remove(inv: Invoice) {
    if (!confirm(`Delete invoice #${inv.number}?`)) return;
    try {
      await api(`/invoices/${inv._id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert(errMsg(e));
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <button className={btnPrimary} onClick={() => open("new")} disabled={clients.length === 0}
          title={clients.length === 0 ? "Add a client first" : ""}>
          + New invoice
        </button>
      </div>
      {clients.length === 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Add a client first to create invoices.</p>
      )}
      <div className="mb-4 flex flex-wrap gap-3">
        <input className={`${inputCls} max-w-xs`} placeholder="Search client or invoice #"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={`${inputCls} max-w-[10rem]`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>
      {error && !editing && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-gray-500">
            <tr>
              <th className="p-3">#</th><th className="p-3">Client</th><th className="p-3">Total</th>
              <th className="p-3">Due</th><th className="p-3">Status</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {!data && <tr><td className="p-4 text-gray-500" colSpan={6}>Loading...</td></tr>}
            {data?.invoices.length === 0 && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={6}>No invoices found.</td></tr>
            )}
            {data?.invoices.map((inv) => (
              <tr key={inv._id} className="border-b last:border-0">
                <td className="p-3 font-medium">#{inv.number}</td>
                <td className="p-3">{inv.clientId?.name || "Deleted client"}</td>
                <td className="p-3">{money(inv.total)}</td>
                <td className="p-3">{formatDate(inv.dueDate)}</td>
                <td className="p-3">
                  <select value={inv.status} onChange={(e) => changeStatus(inv, e.target.value)}
                    className="rounded border-0 bg-transparent text-xs" aria-label="Change status">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <StatusBadge status={inv.status} />
                </td>
                <td className="space-x-3 p-3 text-right">
                  <button className="text-indigo-600 hover:underline" onClick={() => open(inv)}>Edit</button>
                  <button className="text-red-600 hover:underline" onClick={() => remove(inv)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}

      {editing && (
        <Modal title={editing === "new" ? "New invoice" : `Edit invoice #${(editing as Invoice).number}`}
          onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-3">
            <select className={inputCls} value={form.clientId} required
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <div className="flex gap-3">
              <input className={inputCls} type="date" value={form.dueDate} required
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              <select className={inputCls} value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <p className="pt-2 text-sm font-medium text-gray-700">Line items</p>
            {form.items.map((it, idx) => (
              <div key={idx} className="flex gap-2">
                <input className={inputCls} placeholder="Description" value={it.description} required
                  onChange={(e) => setItem(idx, { description: e.target.value })} />
                <input className={`${inputCls} w-16`} type="number" min={1} value={it.quantity} required
                  onChange={(e) => setItem(idx, { quantity: Number(e.target.value) })} aria-label="Quantity" />
                <input className={`${inputCls} w-24`} type="number" min={0} step="0.01" value={it.unitPrice} required
                  onChange={(e) => setItem(idx, { unitPrice: Number(e.target.value) })} aria-label="Unit price" />
                {form.items.length > 1 && (
                  <button type="button" className="text-red-500"
                    onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                    aria-label="Remove item">✕</button>
                )}
              </div>
            ))}
            <button type="button" className="text-sm text-indigo-600 hover:underline"
              onClick={() => setForm({ ...form, items: [...form.items, blankItem()] })}>+ Add item</button>

            <p className="text-right text-sm font-semibold">Total: {money(formTotal)}</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancel</button>
              <button className={btnPrimary} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
