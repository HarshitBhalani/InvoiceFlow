"use client";
import Link from "next/link";
import {
  CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useApi, usePageTitle } from "@/lib/hooks";
import { formatDate, greeting, money } from "@/lib/format";
import { Icon, type IconName } from "@/components/Icon";
import { Alert, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge, cx } from "@/components/ui";
import { useShell } from "../layout";
import type { InvoiceData } from "@/components/InvoiceForm";

type Stats = {
  totals: { revenue: number; pending: number; overdue: number; paidCount: number; invoiceCount: number };
  statusSplit: { status: string; count: number }[];
  revenueByMonth: { month: string; revenue: number }[];
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  sent: "#3b82f6",
  paid: "#22c55e",
  overdue: "#ef4444",
};

const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--fg)", fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--fg)" },
};
const tick = { fontSize: 12, fill: "var(--muted)" };

function StatCard({ label, value, icon, tone }: { label: string; value: string; icon: IconName; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", tone)}>
          <Icon name={icon} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}

export default function DashboardPage() {
  usePageTitle("Dashboard");
  const { user } = useShell();
  const stats = useApi<Stats>("/dashboard/stats");
  const recent = useApi<{ invoices: InvoiceData[] }>("/invoices?limit=5");

  const fmt = (n: number) => money(n, user.currency);
  const s = stats.data;
  const pie = s?.statusSplit.filter((x) => x.count > 0) ?? [];
  const hasRevenue = s?.revenueByMonth.some((m) => m.revenue > 0);

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        description="Here is how your invoices are doing."
        actions={
          <Link href="/invoices?new=1" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover">
            <Icon name="plus" /> New invoice
          </Link>
        }
      />

      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}

      {!s && !stats.error && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-80 lg:col-span-2" />
            <Skeleton className="h-80" />
          </div>
        </div>
      )}

      {s && s.totals.invoiceCount === 0 && (
        <Card>
          <EmptyState
            icon="fileText"
            title="Create your first invoice"
            description="Add a client, then create an invoice. Your revenue and charts will show up here."
            action={
              <Link href="/clients" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover">
                Add a client
              </Link>
            }
          />
        </Card>
      )}

      {s && s.totals.invoiceCount > 0 && (
        <>
          {s.totals.overdue > 0 && (
            <Alert
              tone="danger"
              action={<Link href="/invoices?status=overdue" className="font-semibold underline">View</Link>}
            >
              You have {fmt(s.totals.overdue)} in overdue invoices.
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Revenue (paid)" value={fmt(s.totals.revenue)} icon="trendingUp" tone="bg-success-soft text-success" />
            <StatCard label="Pending" value={fmt(s.totals.pending)} icon="clock" tone="bg-info-soft text-info" />
            <StatCard label="Overdue" value={fmt(s.totals.overdue)} icon="alertCircle" tone="bg-danger-soft text-danger" />
            <StatCard label="Paid invoices" value={`${s.totals.paidCount} of ${s.totals.invoiceCount}`} icon="checkCircle" tone="bg-primary-soft text-primary" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="p-4 lg:col-span-2">
              <h2 className="mb-3 font-semibold">Monthly revenue</h2>
              {hasRevenue ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={s.revenueByMonth} margin={{ left: -8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                      <XAxis dataKey="month" tick={tick} stroke="var(--line)" />
                      <YAxis tick={tick} stroke="var(--line)" tickFormatter={(v) => `$${v}`} />
                      <Tooltip {...tooltipStyle} formatter={(v) => fmt(Number(v))} />
                      <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon="trendingUp" title="No paid invoices yet" description="Mark an invoice as paid and your revenue chart will appear." />
              )}
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 font-semibold">Invoice status</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pie} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                      {pie.map((x) => <Cell key={x.status} fill={STATUS_COLORS[x.status]} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="mt-6">
            <div className="flex items-center justify-between p-4">
              <h2 className="font-semibold">Recent invoices</h2>
              <Link href="/invoices" className="text-sm font-medium text-primary hover:underline">View all</Link>
            </div>
            {recent.error && <div className="px-4 pb-4"><ErrorState message={recent.error} onRetry={recent.reload} /></div>}
            {!recent.data && !recent.error && <div className="space-y-2 px-4 pb-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
            <ul className="divide-y divide-line border-t border-line">
              {recent.data?.invoices.map((inv) => (
                <li key={inv._id}>
                  <Link href={`/invoices/${inv._id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">#{inv.number} · {inv.clientId?.name || "Deleted client"}</p>
                      <p className="text-xs text-muted">Due {formatDate(inv.dueDate)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={inv.isOverdue ? "overdue" : inv.status} />
                      <span className="w-24 text-right text-sm font-medium tabular-nums">{money(inv.total, inv.currency || user.currency)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
