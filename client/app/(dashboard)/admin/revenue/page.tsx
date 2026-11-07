"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi, usePageTitle } from "@/lib/hooks";
import { money } from "@/lib/format";
import { Card, ErrorState, Skeleton } from "@/components/ui";

type Stats = {
  totals: { users: number; pro: number; free: number; mrr: number; conversion: number };
  planSplit: { plan: string; count: number }[];
  signupsByMonth: { month: string; signups: number }[];
};

const PLAN_COLORS: Record<string, string> = { free: "#94a3b8", pro: "#6366f1" };
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--fg)", fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--fg)" },
  cursor: { fill: "var(--surface-2)" },
};
const tick = { fontSize: 12, fill: "var(--muted)" };

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}

export default function AdminRevenuePage() {
  usePageTitle("Admin: revenue");
  const { data: s, error, reload } = useApi<Stats>("/admin/stats");

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!s) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const pie = s.planSplit.filter((p) => p.count > 0);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR" value={money(s.totals.mrr)} />
        <StatCard label="Total users" value={String(s.totals.users)} />
        <StatCard label="Pro users" value={String(s.totals.pro)} />
        <StatCard label="Free to Pro" value={`${s.totals.conversion}%`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold">New signups (last 6 months)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.signupsByMonth} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="month" tick={tick} stroke="var(--line)" />
                <YAxis allowDecimals={false} tick={tick} stroke="var(--line)" />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="signups" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Free vs Pro</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="count" nameKey="plan" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                  {pie.map((p) => <Cell key={p.plan} fill={PLAN_COLORS[p.plan]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
