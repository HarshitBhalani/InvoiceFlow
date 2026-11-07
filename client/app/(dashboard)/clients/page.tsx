"use client";
import { useEffect, useState } from "react";
import { api, errMsg } from "@/lib/api";
import { useApi, useDebounce, usePageTitle } from "@/lib/hooks";
import { Icon } from "@/components/Icon";
import { useConfirm, useToast } from "@/components/providers";
import {
  Avatar, Button, Card, EmptyState, ErrorState, IconButton, Modal, PageHeader, Pagination, SearchInput, Skeleton, TextField, Alert, focusFirstInvalid,
} from "@/components/ui";

type Client = { _id: string; name: string; email: string; company: string };
type ListRes = { clients: Client[]; total: number; page: number; pages: number };
const empty = { name: "", email: "", company: "" };

function ClientModal({ client, onClose, onSaved }: { client: Client | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(client ? { name: client.name, email: client.email, company: client.company } : empty);
  const [errors, setErrors] = useState<Partial<typeof empty>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const v: Partial<typeof empty> = {};
    if (form.name.trim().length < 2) v.name = "Enter a name (at least 2 characters)";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) v.email = "Enter a valid email address";
    setErrors(v);
    if (Object.keys(v).length) return focusFirstInvalid(e.currentTarget);

    setSaving(true);
    setFormError("");
    try {
      await api(client ? `/clients/${client._id}` : "/clients", {
        method: client ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      toast.success(client ? "Client updated" : "Client added");
      onSaved();
    } catch (err) {
      setFormError(errMsg(err));
      setSaving(false);
    }
  }

  return (
    <Modal title={client ? "Edit client" : "New client"} onClose={onClose}>
      <form onSubmit={save} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <TextField label="Name" value={form.name} error={errors.name} maxLength={100} autoComplete="off"
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField label="Email" type="email" help="Where you will send this client their invoices." value={form.email} error={errors.email} maxLength={254} autoComplete="off"
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <TextField label="Company" optional help="Shown on the invoice under the client name." value={form.company} maxLength={100} autoComplete="off"
          onChange={(e) => setForm({ ...form, company: e.target.value })} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{saving ? "Saving..." : "Save client"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ClientsPage() {
  usePageTitle("Clients");
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const q = useDebounce(search);

  useEffect(() => { setPage(1); }, [q]);

  const { data, error, loading, reload } = useApi<ListRes>(`/clients?page=${page}&limit=10&search=${encodeURIComponent(q)}`);

  async function remove(c: Client) {
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      message: "This cannot be undone. Clients with invoices cannot be deleted.",
      confirmText: "Delete client",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/clients/${c._id}`, { method: "DELETE" });
      toast.success("Client deleted");
      if (data && data.clients.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const isFiltering = q.trim() !== "";

  return (
    <div>
      <PageHeader
        title="Clients"
        description="People and companies you invoice."
        actions={<Button onClick={() => setEditing("new")}><Icon name="plus" /> New client</Button>}
      />

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search name, email or company" /></div>
      {error && <ErrorState message={error} onRetry={reload} />}

      <Card className="overflow-hidden">
        {!data && !error && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>}

        {data && data.clients.length === 0 && (
          <EmptyState
            icon="users"
            title={isFiltering ? "No clients match your search" : "No clients yet"}
            description={isFiltering ? "Try a different name, email or company." : "Add your first client to start creating invoices."}
            action={!isFiltering && <Button onClick={() => setEditing("new")}><Icon name="plus" /> Add client</Button>}
          />
        )}

        {data && data.clients.length > 0 && (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">Company</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.clients.map((c) => (
                  <tr key={c._id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{c.name}</p>
                          <a href={`mailto:${c.email}`} className="truncate text-xs text-muted hover:text-primary">{c.email}</a>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{c.company || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <IconButton icon="pencil" label={`Edit ${c.name}`} onClick={() => setEditing(c)} />
                        <IconButton icon="trash" tone="danger" label={`Delete ${c.name}`} onClick={() => remove(c)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {data.clients.map((c) => (
                <li key={c._id} className="flex items-center gap-3 p-4">
                  <Avatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted">{c.email}</p>
                    {c.company && <p className="truncate text-xs text-muted">{c.company}</p>}
                  </div>
                  <IconButton icon="pencil" label={`Edit ${c.name}`} onClick={() => setEditing(c)} />
                  <IconButton icon="trash" tone="danger" label={`Delete ${c.name}`} onClick={() => remove(c)} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
      </Card>

      {editing && (
        <ClientModal
          client={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}
