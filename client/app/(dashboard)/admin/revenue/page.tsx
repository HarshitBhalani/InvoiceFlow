"use client";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, errMsg } from "@/lib/api";
import { money } from "@/lib/hooks";

type Stats = {
  totals: { users: number; pro: number; free: number; mrr: number; conversion: number };
  planSplit: { plan: string; count: number }[];
  signupsByMonth: { month: string; signups: number }[];
};

const PLAN_COLORS: Record<string, string> = { free: "#9ca3af", pro: "#4f46e5" };

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function AdminRevenuePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Stats>("/admin/stats").then(setStats).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!stats) return <p className="text-gray-500">Loading...</p>;

  const pie = stats.planSplit.filter((p) => p.count > 0);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR" value={money(stats.totals.mrr)} />
        <StatCard label="Total users" value={String(stats.totals.users)} />
        <StatCard label="Pro users" value={String(stats.totals.pro)} />
        <StatCard label="Free to Pro" value={`${stats.totals.conversion}%`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold">New signups (last 6 months)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.signupsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="signups" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold">Free vs Pro</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="count" nameKey="plan" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {pie.map((p) => <Cell key={p.plan} fill={PLAN_COLORS[p.plan]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
