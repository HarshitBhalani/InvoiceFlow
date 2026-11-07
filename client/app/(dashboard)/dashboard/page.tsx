"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { api, errMsg } from "@/lib/api";
import { money } from "@/lib/hooks";
import { useUser } from "../layout";

type Stats = {
  totals: { revenue: number; pending: number; overdue: number; paidCount: number; invoiceCount: number };
  statusSplit: { status: string; count: number }[];
  revenueByMonth: { month: string; revenue: number }[];
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#9ca3af",
  sent: "#3b82f6",
  paid: "#22c55e",
  overdue: "#ef4444",
};

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone || "text-gray-900"}`}>{value}</p>
    </div>
  );
}

const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-xl bg-gray-200 ${className}`} />
);

export default function DashboardPage() {
  const user = useUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Stats>("/dashboard/stats").then(setStats).catch((e) => setError(errMsg(e)));
  }, []);

  const pieData = stats?.statusSplit.filter((s) => s.count > 0) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Hi, {user?.name} 👋</h1>
      <p className="mb-6 mt-1 text-gray-600">Here is how your invoices are doing.</p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!stats && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-80 lg:col-span-2" />
            <Skeleton className="h-80" />
          </div>
        </>
      )}

      {stats && stats.totals.invoiceCount === 0 && (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center">
          <p className="font-medium text-gray-800">No invoices yet</p>
          <p className="mb-4 text-sm text-gray-500">Create your first invoice to see revenue and charts here.</p>
          <Link href="/invoices" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            Go to invoices
          </Link>
        </div>
      )}

      {stats && stats.totals.invoiceCount > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total revenue (paid)" value={money(stats.totals.revenue)} tone="text-green-600" />
            <StatCard label="Pending (sent)" value={money(stats.totals.pending)} tone="text-blue-600" />
            <StatCard label="Overdue" value={money(stats.totals.overdue)} tone="text-red-600" />
            <StatCard label="Paid invoices" value={`${stats.totals.paidCount} / ${stats.totals.invoiceCount}`} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-white p-4 lg:col-span-2">
              <h2 className="mb-3 font-semibold">Monthly revenue</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v) => money(Number(v))} />
                    <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <h2 className="mb-3 font-semibold">Invoice status</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="count" nameKey="status" innerRadius={50} outerRadius={85} paddingAngle={2}>
                      {pieData.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
