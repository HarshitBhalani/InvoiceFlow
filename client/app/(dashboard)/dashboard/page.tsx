"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type User = { name: string; email: string; role: string; plan: string };

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api<{ user: User }>("/auth/me").then((d) => setUser(d.user)).catch(() => router.push("/login"));
  }, [router]);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (!user) return <p className="p-8">Loading...</p>;
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Hi, {user.name} 👋</h1>
      <p className="text-gray-600">{user.email} · {user.role} · {user.plan} plan</p>
      <button onClick={logout} className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm text-white">Log out</button>
    </main>
  );
}
