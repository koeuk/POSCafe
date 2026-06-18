"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  href: string | { staff: string; admin: string };
  label: string;
  icon: ReactNode;
  newTab?: boolean;
  adminOnly?: boolean;
  /** Match this exact path only (e.g. /admin shouldn't stay active on /admin/orders). */
  exact?: boolean;
}

const sw = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    adminOnly: true,
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/pos",
    label: "Point of Sale",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M3 9h18M7 14h4" />
      </svg>
    ),
  },
  {
    href: "/orders",
    label: "Orders",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M13 3v5h5M9 13h6M9 17h6" />
      </svg>
    ),
  },
  {
    href: { staff: "/pay", admin: "/admin/pay" },
    label: "Payments",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h3" />
      </svg>
    ),
  },
  {
    href: { staff: "/kitchen", admin: "/admin/kitchen" },
    label: "Kitchen",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <path d="M6 3v6a3 3 0 1 0 6 0V3" />
        <path d="M9 12v9" />
        <path d="M17 3v18" />
        <path d="M14 7h6" />
      </svg>
    ),
  },
  {
    href: "/admin/categories",
    label: "Categories",
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <path d="M4 5h16M4 12h16M4 19h16" />
        <path d="M8 3v4M16 3v4M8 10v4M16 10v4M8 17v4M16 17v4" />
      </svg>
    ),
  },
  {
    href: "/admin/products",
    label: "Products",
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
        <path d="m4 7 8 4 8-4M12 11v10" />
      </svg>
    ),
  },
  {
    href: "/admin/orders",
    label: "Order History",
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    href: "/admin/reports",
    label: "Reports",
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <rect x="7" y="11" width="3" height="5" rx="1" />
        <rect x="12" y="7" width="3" height="9" rx="1" />
        <rect x="17" y="9" width="3" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: { staff: "/menu", admin: "/admin/menu" },
    label: "View Menu",
    adminOnly: true,
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    href: { staff: "/menu/qr", admin: "/admin/menu/qr" },
    label: "QR Code",
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3M21 14v7M17 21h4" />
      </svg>
    ),
  },
];

function NavLinks({
  pathname,
  isAdmin,
  onNavigate,
}: {
  pathname: string;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  function matchesPath(path: string, exact?: boolean) {
    return exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  }

  return (
    <nav className="flex flex-col gap-1">
      {NAV.filter((i) => !i.adminOnly || isAdmin).map((item) => {
        const href = typeof item.href === "string"
          ? item.href
          : item.href[isAdmin ? "admin" : "staff"];
        const active = matchesPath(href, item.exact);
        return (
          <Link
            key={item.label}
            href={href}
            target={item.newTab ? "_blank" : undefined}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-[#2A1D15] text-amber-50 shadow-sm"
                : "text-stone-600 hover:bg-stone-900/5"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.newTab && <span className="ml-auto text-xs opacity-50">↗</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2A1D15] text-lg text-amber-50 shadow-sm">
        ☕
      </span>
      <span className="text-lg font-bold tracking-tight text-stone-900">
        POSCAFE
      </span>
    </div>
  );
}

function UserBlock() {
  const { user, logout } = useAuth();
  const initial = (user?.name ?? "?").charAt(0).toUpperCase();
  return (
    <div className="border-t border-stone-200/70 pt-3">
      <div className="flex items-center gap-3 px-2 py-1">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-200 text-sm font-semibold text-amber-900">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-stone-900">
            {user?.name}
          </p>
          <p className="text-xs uppercase tracking-wide text-stone-400">
            {user?.role}
          </p>
        </div>
      </div>
      <button
        onClick={logout}
        className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
      >
        Log out
      </button>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-stone-200/70 bg-[#F3ECE3]/90 p-4 backdrop-blur-xl lg:flex">
        <div className="space-y-6">
          <Brand />
          <NavLinks pathname={pathname} isAdmin={isAdmin} />
        </div>
        <UserBlock />
      </aside>

      {/* Mobile: top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200/70 bg-[#F3ECE3]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Brand />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 bg-white text-stone-700"
        >
          ☰
        </button>
      </div>

      {/* Mobile: slide-over drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col justify-between border-r border-stone-200/70 bg-[#F3ECE3] p-4">
            <div className="space-y-6">
              <Brand />
              <NavLinks
                pathname={pathname}
                isAdmin={isAdmin}
                onNavigate={() => setOpen(false)}
              />
            </div>
            <UserBlock />
          </aside>
        </div>
      )}
    </>
  );
}
