"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

/* ── SF-symbol-style line icons (1.6px round strokes) ─────────────── */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Icon({ path }: { path: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" {...stroke}>
      {path}
    </svg>
  );
}

const ICONS = {
  pos: (
    <Icon
      path={
        <>
          <path d="M3 7h18l-1.4 11.2A2 2 0 0 1 17.6 20H6.4a2 2 0 0 1-2-1.8L3 7Z" />
          <path d="M8 7V5a4 4 0 0 1 8 0v2" />
        </>
      }
    />
  ),
  orders: (
    <Icon
      path={
        <>
          <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
          <path d="M13 3v5h5" />
          <path d="M9 13h6M9 17h4" />
        </>
      }
    />
  ),
  products: (
    <Icon
      path={
        <>
          <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
          <path d="m4 7 8 4 8-4M12 11v10" />
        </>
      }
    />
  ),
  categories: (
    <Icon
      path={
        <>
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </>
      }
    />
  ),
  menu: (
    <Icon
      path={
        <>
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" />
          <path d="M19 19H6a2 2 0 0 0-2 2" />
        </>
      }
    />
  ),
  qr: (
    <Icon
      path={
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <path d="M14 14h3v3M20 14v.01M14 20h.01M17 20h.01M20 17v3" />
        </>
      }
    />
  ),
};

interface Tile {
  key: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  accent: string; // iOS system color
  href?: string;
  newTab?: boolean;
  adminOnly?: boolean;
  soon?: boolean;
}

const TILES: Tile[] = [
  { key: "pos", title: "Point of Sale", subtitle: "Take orders & checkout", icon: ICONS.pos, accent: "#FF9500", href: "/pos" },
  { key: "orders", title: "Orders", subtitle: "Live order dashboard", icon: ICONS.orders, accent: "#007AFF", href: "/admin/orders", soon: true },
  { key: "products", title: "Products", subtitle: "Manage items & discounts", icon: ICONS.products, accent: "#34C759", href: "/admin/products", adminOnly: true, soon: true },
  { key: "categories", title: "Categories", subtitle: "Organize the menu", icon: ICONS.categories, accent: "#5856D6", href: "/admin/categories", adminOnly: true, soon: true },
  { key: "menu", title: "View Menu", subtitle: "Customer-facing menu", icon: ICONS.menu, accent: "#30B0C7", href: "/menu", newTab: true },
  { key: "qr", title: "QR Code", subtitle: "Scan-to-view, ready to print", icon: ICONS.qr, accent: "#FF2D55", href: "/menu/qr", newTab: true },
];

function tint(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function Dashboard() {
  const { user, isAdmin, logout } = useAuth();
  const [today, setToday] = useState("");

  // Set after mount to avoid an SSR/client time mismatch.
  useEffect(() => {
    // One-time client-only date init; intentional setState in effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    );
  }, []);

  const tiles = TILES.filter((t) => !t.adminOnly || isAdmin);
  const initial = (user?.name ?? user?.username ?? "?").charAt(0).toUpperCase();

  return (
    <main className="font-ios relative min-h-screen overflow-hidden text-stone-900">
      {/* Atmosphere: warm drifting blobs + grain behind the glass */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#F3ECE3]" />
        <div className="ios-drift absolute -left-40 -top-48 h-[44rem] w-[44rem] rounded-full bg-[radial-gradient(circle,rgba(255,149,0,0.30),transparent_62%)] blur-3xl" />
        <div
          className="ios-drift absolute -right-44 top-1/3 h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle,rgba(255,45,85,0.18),transparent_62%)] blur-3xl"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="ios-drift absolute -bottom-52 left-1/4 h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,rgba(88,86,214,0.16),transparent_62%)] blur-3xl"
          style={{ animationDelay: "-12s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      {/* Floating glass top bar */}
      <header className="sticky top-0 z-20 border-b border-white/40 bg-white/45 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-stone-900 text-lg text-white shadow-sm">
              ☕
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              POSCAFE
            </span>
          </div>
          <button
            onClick={logout}
            className="rounded-full border border-white/60 bg-white/60 px-4 py-1.5 text-sm font-medium text-stone-700 shadow-sm backdrop-blur transition hover:bg-white/90 active:scale-95"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 pb-20 pt-10">
        {/* Hero greeting */}
        <section
          className="ios-rise mb-10 flex items-end justify-between gap-4"
          style={{ animationDelay: "40ms" }}
        >
          <div>
            <p className="text-sm font-medium text-stone-500">{today || " "}</p>
            <h1 className="mt-1 text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              Welcome back,
              <br />
              <span className="text-stone-900">{user?.name ?? "there"}</span>
            </h1>
            <span
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                color: isAdmin ? "#5856D6" : "#FF9500",
                background: tint(isAdmin ? "#5856D6" : "#FF9500", 0.12),
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: isAdmin ? "#5856D6" : "#FF9500" }}
              />
              {isAdmin ? "Administrator" : "Cashier"}
            </span>
          </div>
          <div className="hidden h-16 w-16 shrink-0 place-items-center rounded-full border border-white/70 bg-white/60 text-2xl font-semibold text-stone-700 shadow-sm backdrop-blur sm:grid">
            {initial}
          </div>
        </section>

        {/* Tile grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile, i) => {
            const inner = (
              <>
                {/* specular highlight */}
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />
                <div className="flex items-start justify-between">
                  <span
                    className="grid h-14 w-14 place-items-center rounded-2xl shadow-inner transition-transform duration-300 group-hover:scale-105"
                    style={{ color: tile.accent, background: tint(tile.accent, 0.14) }}
                  >
                    {tile.icon}
                  </span>
                  {tile.soon ? (
                    <span className="rounded-full bg-stone-900/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                      Soon
                    </span>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5 text-stone-300 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-stone-400"
                      {...stroke}
                    >
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  )}
                </div>
                <div className="mt-6">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {tile.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {tile.subtitle}
                  </p>
                </div>
              </>
            );

            const cls =
              "ios-rise group relative flex flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/55 p-6 shadow-[0_8px_30px_rgba(70,45,20,0.08)] backdrop-blur-xl transition-all duration-300";
            const delay = { animationDelay: `${120 + i * 70}ms` };

            return tile.soon ? (
              <div
                key={tile.key}
                style={delay}
                className={`${cls} cursor-default opacity-95`}
                aria-disabled
              >
                {inner}
              </div>
            ) : (
              <Link
                key={tile.key}
                href={tile.href!}
                target={tile.newTab ? "_blank" : undefined}
                style={delay}
                className={`${cls} hover:-translate-y-1 hover:bg-white/80 hover:shadow-[0_18px_50px_rgba(70,45,20,0.16)] active:scale-[0.98]`}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
