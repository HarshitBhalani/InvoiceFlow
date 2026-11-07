"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "@/lib/api";
import { formatDate, useDebounce } from "@/lib/hooks";
import { Pagination, inputCls } from "@/components/ui";

type AdminUser = { _id: string; name: string; email: string; role: string; plan: string; banned: boolean; createdAt: string };
type ListRes = { users: AdminUser[]; total: number; page: number; pages: number };

export default function AdminUsersPage() {
  const [data, setData] = useState<ListRes | null>(null);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const q = useDebounce(search);

  const load = useCallback(async () => {
    try {
      setData(await api<ListRes>(`/admin/users?page=${page}&search=${encodeURIComponent(q)}&plan=${plan}`));
    } catch (e) {
      setError(errMsg(e));
    }
  }, [page, q, plan]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, plan]);

  async function toggleBan(u: AdminUser) {
    if (!confirm(`${u.banned ? "Unban" : "Ban"} ${u.name}?`)) return;
    try {
      await api(`/admin/users/${u._id}/ban`, { method: "PATCH", body: JSON.stringify({ banned: !u.banned }) });
      load();
    } catch (e) {
      alert(errMsg(e));
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input className={`${inputCls} max-w-xs`} placeholder="Search name or email" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <select className={`${inputCls} max-w-[10rem]`} value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-gray-500">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Plan</th><th className="p-3">Joined</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {!data && <tr><td className="p-4 text-gray-500" colSpan={6}>Loading...</td></tr>}
            {data?.users.length === 0 && <tr><td className="p-6 text-center text-gray-500" colSpan={6}>No users found.</td></tr>}
            {data?.users.map((u) => (
              <tr key={u._id} className="border-b last:border-0">
                <td className="p-3 font-medium">{u.name}{u.role === "admin" && <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">admin</span>}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${u.plan === "pro" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-700"}`}>{u.plan}</span>
                </td>
                <td className="p-3">{formatDate(u.createdAt)}</td>
                <td className="p-3">{u.banned ? <span className="text-red-600">Banned</span> : <span className="text-green-600">Active</span>}</td>
                <td className="p-3 text-right">
                  {u.role !== "admin" && (
                    <button className={u.banned ? "text-green-600 hover:underline" : "text-red-600 hover:underline"} onClick={() => toggleBan(u)}>
                      {u.banned ? "Unban" : "Ban"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </div>
  );
}
