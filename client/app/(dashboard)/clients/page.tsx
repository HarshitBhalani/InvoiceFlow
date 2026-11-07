"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "@/lib/api";
import { useDebounce } from "@/lib/hooks";
import { Modal, Pagination, btnGhost, btnPrimary, inputCls } from "@/components/ui";

type Client = { _id: string; name: string; email: string; company: string };
type ListRes = { clients: Client[]; total: number; page: number; pages: number };
const empty = { name: "", email: "", company: "" };

export default function ClientsPage() {
  const [data, setData] = useState<ListRes | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const q = useDebounce(search);

  const load = useCallback(async () => {
    try {
      setData(await api<ListRes>(`/clients?page=${page}&search=${encodeURIComponent(q)}`));
    } catch (e) {
      setError(errMsg(e));
    }
  }, [page, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q]);

  function open(c: Client | "new") {
    setForm(c === "new" ? empty : { name: c.name, email: c.email, company: c.company });
    setError("");
    setEditing(c);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const isNew = editing === "new";
      await api(isNew ? "/clients" : `/clients/${(editing as Client)._id}`, {
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

  async function remove(c: Client) {
    if (!confirm(`Delete ${c.name}?`)) return;
    try {
      await api(`/clients/${c._id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert(errMsg(e));
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Clients</h1>
        <button className={btnPrimary} onClick={() => open("new")}>+ New client</button>
      </div>
      <input className={`${inputCls} mb-4 max-w-sm`} placeholder="Search name, email, company..."
        value={search} onChange={(e) => setSearch(e.target.value)} />
      {error && !editing && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-gray-500">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Company</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {!data && <tr><td className="p-4 text-gray-500" colSpan={4}>Loading...</td></tr>}
            {data?.clients.length === 0 && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={4}>No clients yet. Add your first one.</td></tr>
            )}
            {data?.clients.map((c) => (
              <tr key={c._id} className="border-b last:border-0">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.email}</td>
                <td className="p-3">{c.company || "-"}</td>
                <td className="space-x-3 p-3 text-right">
                  <button className="text-indigo-600 hover:underline" onClick={() => open(c)}>Edit</button>
                  <button className="text-red-600 hover:underline" onClick={() => remove(c)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}

      {editing && (
        <Modal title={editing === "new" ? "New client" : "Edit client"} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-3">
            <input className={inputCls} placeholder="Name" value={form.name} required
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={inputCls} type="email" placeholder="Email" value={form.email} required
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className={inputCls} placeholder="Company (optional)" value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })} />
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
