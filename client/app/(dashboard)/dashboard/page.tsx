"use client";
import { useUser } from "../layout";

export default function DashboardPage() {
  const user = useUser();
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Hi, {user?.name} 👋</h1>
      <p className="mt-1 text-gray-600">Stats and charts coming in Phase 3.</p>
    </div>
  );
}
