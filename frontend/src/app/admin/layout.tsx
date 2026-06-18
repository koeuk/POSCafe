"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

/* ── Line icons (1.7px round strokes) ─────────────────────────────── */
const sw = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const I = {
  dashboard: <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></svg>,
  pos: <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}><path d="M3 7h18l-1.4 11.2A2 2 0 0 1 17.6 20H6.4a2 2 0 0 1-2-1.8L3 7Z" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /></svg>,
  orders: <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M13 3v5h5M9 13h6M9 17h4" /></svg>,
  products: <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" /><path d="m4 7 8 4 8-4M12 11v10" /></svg>,
  menu: <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M19 19H6a2 2 0 0 0-2 2" /></svg>,
  qr: <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3M20 14v.01M14 20h.01M17 20h.01M20 17v3" /></svg>,
  bell: <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>,
  search: <svg viewBox="0 0 24 24" className="h-4 w-4" {...sw}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>,
  logout: <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>,
  menuBtn: <svg viewBox="0 0 24 24" className="h-6 w-6" {...sw}><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
};

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
  newTab?: boolean;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: I.dashboard },
  { href: "/pos", label: "Point of Sale", icon: I.pos },
  { href: "/admin/orders", label: "Orders", icon: I.orders },
  { href: "/admin/products", label: "Products", icon: I.products, adminOnly: true },
  { href: "/menu", label: "View Menu", icon: I.menu, newTab: true },
  { href: "/menu/qr", label: "QR Code", icon: I.qr, newTab: true },
];

const ACCENT = "#7C5CFC"; // refined violet

function Shell({ children }: { children: ReactNode }) {
  const { user, isAdmin, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => !n.adminOnly || isAdmin);
  const initial = (user?.name ?? user?.username ?? "?").charAt(0).toUpperCase();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-6 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-stone-900 text-lg text-white">
          ☕
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-stone-900">
          POS<span style={{ color: ACCENT }}>CAFE</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((n) => {
          const active = !n.newTab && isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              target={n.newTab ? "_blank" : undefined}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
              style={
                active
                  ? { background: `${ACCENT}14`, color: ACCENT }
                  : { color: "#78716c" }
              }
            >
              <span className={active ? "" : "text-stone-400"}>{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-stone-100 p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-500 transition hover:bg-red-50 hover:text-red-600"
        >
          {I.logout}
          Logout
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#F5F4FA] text-stone-900">
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-screen shrink-0 border-r border-stone-200/70 lg:block">
        {sidebar}
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full border-r border-stone-200 shadow-xl">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-stone-200/70 bg-white/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 lg:hidden"
            aria-label="Open menu"
          >
            {I.menuBtn}
          </button>

          <label className="flex max-w-md flex-1 items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-stone-500">
            {I.search}
            <input
              type="search"
              placeholder="Search anything…"
              className="w-full bg-transparent text-sm text-stone-700 outline-none placeholder:text-stone-400"
            />
          </label>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <button
              className="relative grid h-9 w-9 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
              aria-label="Notifications"
            >
              {I.bell}
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-white"
                style={{ background: ACCENT }}
              >
                {initial}
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-semibold text-stone-900">
                  {user?.name ?? user?.username}
                </p>
                <p className="text-xs text-stone-400">
                  {isAdmin ? "Administrator" : "Cashier"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <Shell>{children}</Shell>
    </RequireAuth>
  );
}
