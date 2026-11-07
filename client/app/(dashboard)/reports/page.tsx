"use client";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi, usePageTitle } from "@/lib/hooks";
import { money } from "@/lib/format";
import { Icon, type IconName } from "@/components/Icon";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, cx } from "@/components/ui";

type Pnl = {
  currency: string;
  months: { month: string; revenue: number; expenses: number; profit: number }[];
  totals: { revenue: number; expenses: number; profit: number; taxCollected: number; outstanding: number };
  byCategory: { category: string; amount: number }[];
};

const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--fg)", fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--fg)" },
  cursor: { fill: "var(--surface-2)" },
};
const tick = { fontSize: 12, fill: "var(--muted)" };

function Stat({ label, value, icon, tone, hint }: { label: string; value: string; icon: IconName; tone: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", tone)}><Icon name={icon} /></span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export default function ReportsPage() {
  usePageTitle("Reports");
  const { data, error, reload } = useApi<Pnl>("/reports/pnl");

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const { totals: t, currency: cur } = data;
  const empty = t.revenue === 0 && t.expenses === 0;
  const maxCat = Math.max(1, ...data.byCategory.map((c) => c.amount));

  return (
    <div>
      <PageHeader title="Reports" description="Profit and loss for the last 12 months. Revenue counts invoices marked as paid." />

      {empty ? (
        <Card>
          <EmptyState icon="barChart" title="Nothing to report yet" description="Mark invoices as paid and add your expenses. Your profit will show up here."
            action={<Link href="/expenses" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover">Add an expense</Link>} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Revenue" value={money(t.revenue, cur)} icon="trendingUp" tone="bg-success-soft text-success" hint="Paid invoices, tax included" />
            <Stat label="Expenses" value={money(t.expenses, cur)} icon="receipt" tone="bg-danger-soft text-danger" />
            <Stat label="Profit" value={money(t.profit, cur)} icon="barChart" tone={t.profit >= 0 ? "bg-primary-soft text-primary" : "bg-danger-soft text-danger"} hint={t.profit < 0 ? "You spent more than you earned" : undefined} />
            <Stat label="Tax collected" value={money(t.taxCollected, cur)} icon="fileText" tone="bg-info-soft text-info" hint={`Still owed to you: ${money(t.outstanding, cur)}`} />
          </div>

          <Card className="mt-6 p-4">
            <h2 className="mb-3 font-semibold">Revenue vs expenses</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.months} margin={{ left: -8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="month" tick={tick} stroke="var(--line)" />
                  <YAxis tick={tick} stroke="var(--line)" />
                  <Tooltip {...tooltipStyle} formatter={(v) => money(Number(v), cur)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="mb-3 font-semibold">Spending by category</h2>
              {data.byCategory.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">No expenses recorded.</p>
              ) : (
                <ul className="space-y-3">
                  {data.byCategory.map((c) => (
                    <li key={c.category}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="capitalize">{c.category}</span>
                        <span className="font-medium tabular-nums">{money(c.amount, cur)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-2">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="overflow-hidden">
              <h2 className="p-4 font-semibold">Month by month</h2>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-y border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Month</th>
                      <th className="px-4 py-2 text-right font-medium">Revenue</th>
                      <th className="px-4 py-2 text-right font-medium">Expenses</th>
                      <th className="px-4 py-2 text-right font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular-nums">
                    {[...data.months].reverse().map((m) => (
                      <tr key={m.month}>
                        <td className="px-4 py-2">{m.month}</td>
                        <td className="px-4 py-2 text-right">{money(m.revenue, cur)}</td>
                        <td className="px-4 py-2 text-right">{money(m.expenses, cur)}</td>
                        <td className={cx("px-4 py-2 text-right font-medium", m.profit < 0 ? "text-danger" : "")}>{money(m.profit, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
