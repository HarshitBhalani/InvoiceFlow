"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
      <div className="mb-6 flex gap-2 border-b">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              pathname === t.href ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
