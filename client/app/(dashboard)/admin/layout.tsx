"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PageHeader, cx } from "@/components/ui";
import { useUser } from "../layout";

const tabs = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/revenue", label: "Revenue" },
];

// UI guard only. The real protection is requireRole("admin") on the server.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (user && !isAdmin) router.replace("/dashboard");
  }, [user, isAdmin, router]);

  if (!isAdmin) return null;

  return (
    <div>
      <PageHeader title="Admin" description="Manage users and track revenue." />
      <div className="mb-6 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={pathname === t.href ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              pathname === t.href ? "border-primary text-primary" : "border-transparent text-muted hover:text-fg"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
