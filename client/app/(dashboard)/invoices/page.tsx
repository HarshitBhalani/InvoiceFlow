"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, downloadFile, errMsg } from "@/lib/api";
import { useApi, useDebounce, usePageTitle } from "@/lib/hooks";
import { daysUntil, formatDate, money } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { useConfirm, useToast } from "@/components/providers";
import InvoiceForm, { type ClientOption, type InvoiceData } from "@/components/InvoiceForm";
import { SendInvoiceModal } from "@/components/InvoiceActions";
import {
  Alert, Button, Card, EmptyState, ErrorState, IconButton, PageHeader, Pagination, SearchInput, SegmentedControl, Skeleton, StatusBadge,
} from "@/components/ui";
import { useShell } from "../layout";

type ListRes = { invoices: InvoiceData[]; total: number; page: number; pages: number };
const FILTERS = ["all", "draft", "sent", "paid", "overdue"] as const;
type Filter = (typeof FILTERS)[number];

const shownStatus = (inv: InvoiceData) => (inv.isOverdue ? "overdue" : inv.status);

function DueText({ inv }: { inv: InvoiceData }) {
  if (inv.status === "paid") return <span className="text-muted">{formatDate(inv.dueDate)}</span>;
  const d = daysUntil(inv.dueDate);
  return (
    <span>
      {formatDate(inv.dueDate)}
      {d < 0 && <span className="block text-xs text-danger">{-d} day{d === -1 ? "" : "s"} late</span>}
      {d >= 0 && d <= 3 && inv.status !== "draft" && (
        <span className="block text-xs text-warning">{d === 0 ? "Due today" : `Due in ${d} day${d === 1 ? "" : "s"}`}</span>
      )}
    </span>
  );
}

function InvoicesContent() {
  usePageTitle("Invoices");
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, billing, refreshBilling } = useShell();

  const initialFilter = FILTERS.includes(params.get("status") as Filter) ? (params.get("status") as Filter) : "all";
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  type Editing = InvoiceData | "new" | { copy: InvoiceData } | null;
  const [editing, setEditing] = useState<Editing>(null);
  const [exporting, setExporting] = useState(false);
  const [sending, setSending] = useState<InvoiceData | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const q = useDebounce(search);
  const openedFromUrl = useRef(false);

  useEffect(() => { setPage(1); }, [q, filter]);

  const path = `/invoices?page=${page}&limit=10&search=${encodeURIComponent(q)}&status=${filter === "all" ? "" : filter}`;
  const { data, error, loading, reload } = useApi<ListRes>(path);
  const clientsRes = useApi<{ clients: ClientOption[] }>("/clients/options");
  const clients = clientsRes.data?.clients ?? [];

  const atLimit = !!billing && billing.plan === "free" && billing.usage.limit !== null && billing.usage.invoices >= billing.usage.limit;

  // "New invoice" shortcut from the dashboard (/invoices?new=1)
  useEffect(() => {
    if (params.get("new") === "1" && clientsRes.data && !openedFromUrl.current) {
      openedFromUrl.current = true;
      router.replace("/invoices");
      if (clientsRes.data.clients.length > 0 && !atLimit) setEditing("new");
    }
  }, [params, clientsRes.data, atLimit, router]);

  function startNew() {
    if (atLimit) return;
    if (clients.length === 0) {
      toast.info("Add a client first, then you can create invoices.");
      router.push("/clients");
      return;
    }
    setEditing("new");
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadFile("/invoices/export", "invoices.csv");
      toast.success("Invoices exported");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setExporting(false);
    }
  }

  async function markPaid(inv: InvoiceData) {
    setBusyId(inv._id);
    try {
      await api(`/invoices/${inv._id}/status`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) });
      toast.success(`Invoice #${inv.number} marked as paid`);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(inv: InvoiceData) {
    const ok = await confirm({
      title: `Delete invoice #${inv.number}?`,
      message: "This cannot be undone.",
      confirmText: "Delete invoice",
      danger: true,
    });
    if (!ok) return;
    setBusyId(inv._id);
    try {
      await api(`/invoices/${inv._id}`, { method: "DELETE" });
      toast.success("Invoice deleted");
      refreshBilling();
      if (data && data.invoices.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  const isFiltering = q.trim() !== "" || filter !== "all";
  const rowActions = (inv: InvoiceData) => (
    <div className="flex items-center justify-end">
      {inv.status !== "paid" && (
        <IconButton icon="send" label={`Email invoice ${inv.number} to the client`} onClick={() => setSending(inv)} />
      )}
      {inv.status !== "paid" && (
        <IconButton icon="checkCircle" label={`Mark invoice ${inv.number} as paid`} disabled={busyId === inv._id} onClick={() => markPaid(inv)} />
      )}
      <IconButton
        icon="copy"
        label={atLimit ? "Upgrade to duplicate" : `Duplicate invoice ${inv.number}`}
        disabled={atLimit}
        onClick={() => setEditing({ copy: inv })}
      />
      <IconButton icon="pencil" label={`Edit invoice ${inv.number}`} onClick={() => setEditing(inv)} />
      <IconButton icon="trash" tone="danger" label={`Delete invoice ${inv.number}`} disabled={busyId === inv._id} onClick={() => remove(inv)} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Invoices"
        description={
          billing?.plan === "free" && billing.usage.limit !== null
            ? `${billing.usage.invoices} of ${billing.usage.limit} free invoices used`
            : "Create, send and track your invoices."
        }
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={!data || data.total === 0}>
              <Icon name="download" /> Export CSV
            </Button>
            {atLimit ? (
            <Link href="/billing" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover">
              <Icon name="zap" /> Upgrade for more
            </Link>
          ) : (
            <Button onClick={startNew}><Icon name="plus" /> New invoice</Button>
            )}
          </>
        }
      />

      {atLimit && (
        <Alert tone="warning" action={<Link href="/billing" className="font-semibold underline">Upgrade to Pro</Link>}>
          You have used all your free invoices. Upgrade to create unlimited invoices.
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search client or invoice #" />
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ value: f, label: f[0].toUpperCase() + f.slice(1) }))}
        />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}

      <Card className="overflow-hidden">
        {!data && !error && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>}

        {data && data.invoices.length === 0 && (
          <EmptyState
            icon="fileText"
            title={isFiltering ? "No invoices match" : "No invoices yet"}
            description={isFiltering ? "Try another search or filter." : clients.length === 0 ? "Add a client first, then create your first invoice." : "Create your first invoice to get started."}
            action={
              !isFiltering && !atLimit && (
                <Button onClick={startNew}><Icon name="plus" /> {clients.length === 0 ? "Add a client" : "New invoice"}</Button>
              )
            }
          />
        )}

        {data && data.invoices.length > 0 && (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <Link href={`/invoices/${inv._id}`} className="font-medium text-primary hover:underline">#{inv.number}</Link>
                    </td>
                    <td className="max-w-48 truncate px-4 py-3">{inv.clientId?.name || <span className="text-muted">Deleted client</span>}</td>
                    <td className="px-4 py-3"><DueText inv={inv} /></td>
                    <td className="px-4 py-3"><StatusBadge status={shownStatus(inv)} /></td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{money(inv.total, inv.currency || user.currency)}</td>
                    <td className="px-4 py-3">{rowActions(inv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {data.invoices.map((inv) => (
                <li key={inv._id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/invoices/${inv._id}`} className="min-w-0">
                      <p className="font-medium text-primary">#{inv.number}</p>
                      <p className="truncate text-sm">{inv.clientId?.name || "Deleted client"}</p>
                    </Link>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{money(inv.total, inv.currency || user.currency)}</p>
                      <StatusBadge status={shownStatus(inv)} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <DueText inv={inv} />
                    {rowActions(inv)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
      </Card>

      {editing && (
        <InvoiceForm
          invoice={editing === "new" || "copy" in editing ? null : editing}
          copyFrom={typeof editing === "object" && "copy" in editing ? editing.copy : null}
          clients={clients}
          currency={user.currency}
          defaultTaxRate={user.defaultTaxRate}
          onClose={() => setEditing(null)}
          onSaved={(inv) => {
            const isNew = editing === "new" || (typeof editing === "object" && "copy" in editing);
            setEditing(null);
            toast.success(isNew ? `Invoice #${inv.number} created` : "Invoice updated");
            refreshBilling();
            reload();
          }}
        />
      )}
      {sending && (
        <SendInvoiceModal
          invoice={sending}
          onClose={() => setSending(null)}
          onSent={() => {
            setSending(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesContent />
    </Suspense>
  );
}
