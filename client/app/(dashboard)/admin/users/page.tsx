"use client";
import { useEffect, useState } from "react";
import { api, errMsg } from "@/lib/api";
import { useApi, useDebounce, usePageTitle } from "@/lib/hooks";
import { formatDate } from "@/lib/format";
import { useConfirm, useToast } from "@/components/providers";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Pagination, SearchInput, SegmentedControl, Skeleton } from "@/components/ui";

type AdminUser = { _id: string; name: string; email: string; role: string; plan: string; banned: boolean; createdAt: string };
type ListRes = { users: AdminUser[]; total: number; page: number; pages: number };
type PlanFilter = "all" | "free" | "pro";

export default function AdminUsersPage() {
  usePageTitle("Admin: users");
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const q = useDebounce(search);

  useEffect(() => { setPage(1); }, [q, plan]);

  const { data, error, loading, reload } = useApi<ListRes>(
    `/admin/users?page=${page}&limit=10&search=${encodeURIComponent(q)}&plan=${plan === "all" ? "" : plan}`
  );

  async function toggleBan(u: AdminUser) {
    const ok = await confirm({
      title: `${u.banned ? "Unban" : "Ban"} ${u.name}?`,
      message: u.banned ? "They will be able to log in again." : "They will be logged out and unable to log in.",
      confirmText: u.banned ? "Unban user" : "Ban user",
      danger: !u.banned,
    });
    if (!ok) return;
    setBusyId(u._id);
    try {
      await api(`/admin/users/${u._id}/ban`, { method: "PATCH", body: JSON.stringify({ banned: !u.banned }) });
      toast.success(u.banned ? "User unbanned" : "User banned");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  const banButton = (u: AdminUser) =>
    u.role !== "admin" && (
      <Button variant={u.banned ? "secondary" : "ghost"} size="sm" disabled={busyId === u._id} onClick={() => toggleBan(u)} className={u.banned ? "" : "hover:!text-danger"}>
        {u.banned ? "Unban" : "Ban"}
      </Button>
    );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or email" />
        <SegmentedControl
          value={plan}
          onChange={setPlan}
          options={[{ value: "all", label: "All" }, { value: "free", label: "Free" }, { value: "pro", label: "Pro" }]}
        />
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}

      <Card className="overflow-hidden">
        {!data && !error && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
        {data && data.users.length === 0 && <EmptyState icon="users" title="No users found" description="Try a different search or filter." />}

        {data && data.users.length > 0 && (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.users.map((u) => (
                  <tr key={u._id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.name} {u.role === "admin" && <Badge tone="primary">admin</Badge>}</p>
                          <p className="truncate text-xs text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge tone={u.plan === "pro" ? "primary" : "neutral"}>{u.plan.toUpperCase()}</Badge></td>
                    <td className="px-4 py-3 text-muted">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3"><Badge tone={u.banned ? "danger" : "success"}>{u.banned ? "Banned" : "Active"}</Badge></td>
                    <td className="px-4 py-3 text-right">{banButton(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {data.users.map((u) => (
                <li key={u._id} className="flex items-center gap-3 p-4">
                  <Avatar name={u.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-muted">{u.email}</p>
                    <div className="mt-1 flex gap-1">
                      <Badge tone={u.plan === "pro" ? "primary" : "neutral"}>{u.plan.toUpperCase()}</Badge>
                      <Badge tone={u.banned ? "danger" : "success"}>{u.banned ? "Banned" : "Active"}</Badge>
                    </div>
                  </div>
                  {banButton(u)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
      </Card>
    </div>
  );
}
