"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export type User = { id: string; name: string; email: string; role: string; plan: string };
const UserContext = createContext<User | null>(null);
export const useUser = () => useContext(UserContext);

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/invoices", label: "Invoices" },
  { href: "/billing", label: "Billing" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api<{ user: User }>("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => router.push("/login"));
  }, [router]);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (!user) return <p className="p-8 text-gray-500">Loading...</p>;

  return (
    <UserContext.Provider value={user}>
      <div className="min-h-screen bg-gray-50 md:flex">
        <aside className="border-b bg-white p-4 md:min-h-screen md:w-56 md:border-b-0 md:border-r">
          <h2 className="mb-4 text-lg font-bold text-indigo-600">InvoiceFlow</h2>
          <nav className="flex gap-2 md:flex-col">
            {(user.role === "admin" ? [...links, { href: "/admin", label: "Admin" }] : links).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  pathname.startsWith(l.href) ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 border-t pt-4 text-xs text-gray-500 md:mt-8">
            <p className="truncate font-medium text-gray-700">{user.name}</p>
            <p className="mb-2 uppercase">{user.plan} plan</p>
            <button onClick={logout} className="text-red-600 hover:underline">Log out</button>
          </div>
        </aside>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </UserContext.Provider>
  );
}
