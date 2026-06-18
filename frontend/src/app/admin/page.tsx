"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

const LINKS = [
  {
    href: "/pos",
    title: "POS",
    desc: "Take orders & checkout",
    icon: "🧾",
  },
  {
    href: "/admin/products",
    title: "Manage Menu",
    desc: "Categories & products",
    icon: "🍰",
  },
  {
    href: "/admin/orders",
    title: "Order History",
    desc: "View & update orders",
    icon: "📋",
  },
  {
    href: "/menu",
    title: "View Menu",
    desc: "See the customer menu",
    icon: "📖",
    newTab: true,
  },
  {
    href: "/menu/qr",
    title: "Show QR Code",
    desc: "Print the scan-to-view QR",
    icon: "📱",
    newTab: true,
  },
];

function AdminDashboard() {
  const { user, logout } = useAuth();

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">☕ POSCAFE</h1>
          <p className="text-sm text-stone-500">
            Welcome back, {user?.name ?? "staff"}
          </p>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
        >
          Log out
        </button>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="mb-6 text-lg font-semibold text-stone-900">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target={link.newTab ? "_blank" : undefined}
              className="group rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition hover:border-stone-900 hover:shadow-md"
            >
              <div className="mb-3 text-3xl">{link.icon}</div>
              <p className="font-semibold text-stone-900">{link.title}</p>
              <p className="mt-1 text-sm text-stone-500">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth>
      <AdminDashboard />
    </RequireAuth>
  );
}
