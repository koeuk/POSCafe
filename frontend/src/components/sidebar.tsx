"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/branding-context";
import { useTheme, type Theme } from "@/lib/theme-context";
import { resolveCashierPages } from "@/lib/permissions";

interface NavItem {
  /** Stable id; cashier-assignable keys live in lib/permissions. */
  key: string;
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
    key: "dashboard",
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
    key: "pos",
    href: { staff: "/cashier/pos", admin: "/pos" },
    label: "Point of Sale",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <path d="M6 7h12l1 13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1L6 7Z" />
        <path d="M9 7V5a3 3 0 0 1 6 0v2" />
        <path d="M9 11v2M15 11v2" />
      </svg>
    ),
  },
  {
    key: "orders",
    href: { staff: "/cashier/orders", admin: "/orders" },
    label: "Orders",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M13 3v5h5M9 13h6M9 17h6" />
      </svg>
    ),
  },
  {
    key: "payments",
    href: "/pay",
    label: "Payments",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h3" />
      </svg>
    ),
  },
  {
    key: "kitchen",
    href: "/kitchen",
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
    key: "categories",
    href: { staff: "/cashier/categories", admin: "/categories" },
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
    key: "products",
    href: { staff: "/cashier/products", admin: "/products" },
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
    key: "stock",
    href: { staff: "/cashier/stock", admin: "/stock" },
    label: "Stock",
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <path d="M3 7h18M3 12h18M3 17h18" />
        <path d="M7 4v16" />
      </svg>
    ),
  },
  {
    key: "order-history",
    href: { staff: "/cashier/order-history", admin: "/manage-orders" },
    label: "Order History",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    key: "reports",
    href: { staff: "/cashier/reports", admin: "/reports" },
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
    key: "qr",
    href: "/qr",
    label: "QR Code",
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
  allowedPages,
  onNavigate,
  collapsed,
}: {
  pathname: string;
  isAdmin: boolean;
  allowedPages?: string[] | null;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const navRef = useRef<HTMLElement>(null);
  // The active "pill" position — slides between links as the route changes.
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);

  function matchesPath(path: string, exact?: boolean) {
    return exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  }

  // Admins see every page; cashiers see the pages they've been granted.
  const cashierPages = resolveCashierPages(allowedPages);
  const items = NAV.filter(
    (item) => isAdmin || cashierPages.includes(item.key),
  ).map((item) => {
    const href =
      typeof item.href === "string"
        ? item.href
        : item.href[isAdmin ? "admin" : "staff"];
    return { item, href, active: matchesPath(href, item.exact) };
  });

  // Measure the active link and move the pill to it (re-runs on route change
  // and window resize so it always lines up).
  useEffect(() => {
    function place() {
      const el = navRef.current?.querySelector<HTMLElement>(
        '[data-active="true"]',
      );
      setPill(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [pathname, isAdmin]);

  return (
    <nav ref={navRef} className="relative flex flex-col gap-1">
      {/* Sliding active highlight (sits behind the links). */}
      {pill && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 rounded-xl bg-pos-active shadow-sm transition-[transform,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateY(${pill.top}px)`, height: pill.height }}
        />
      )}
      {items.map(({ item, href, active }) => (
        <Link
          key={item.label}
          href={href}
          data-active={active}
          target={item.newTab ? "_blank" : undefined}
          onClick={onNavigate}
          aria-label={item.label}
          className={`group relative z-10 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-300 ${
            collapsed ? "lg:justify-center" : ""
          } ${
            active
              ? "text-amber-50 dark:text-stone-950"
              : "text-stone-600 hover:bg-stone-900/5 dark:text-stone-400 dark:hover:bg-white/5"
          }`}
        >
          <span className="shrink-0">{item.icon}</span>
          <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
          {item.newTab && (
            <span
              className={`ml-auto text-xs opacity-50 ${
                collapsed ? "lg:hidden" : ""
              }`}
            >
              ↗
            </span>
          )}
          {/* Hover tooltip — only when the sidebar is collapsed (desktop). */}
          {collapsed && (
            <span
              role="tooltip"
              className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 dark:bg-stone-700"
            >
              {item.label}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  const { appName, logoUrl } = useBranding();
  return (
    <div
      className={`flex items-center gap-2.5 px-2 ${
        collapsed ? "lg:justify-center lg:px-0" : ""
      }`}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={appName}
          className="h-9 w-9 flex-shrink-0 rounded-xl object-cover shadow-sm"
        />
      ) : (
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-pos-button text-lg text-amber-50 shadow-sm">
          ☕
        </span>
      )}
      <span
        className={`truncate text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 ${
          collapsed ? "lg:hidden" : ""
        }`}
      >
        {appName}
      </span>
    </div>
  );
}

// Three-way theme control: Light / System / Dark.
function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; label: string; icon: ReactNode }[] = [
    {
      value: "light",
      label: "Light",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" {...sw}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ),
    },
    {
      value: "system",
      label: "System",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" {...sw}>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      ),
    },
    {
      value: "dark",
      label: "Dark",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" {...sw}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-stone-200 bg-white p-0.5 dark:border-stone-700 dark:bg-stone-800">
      {options.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setTheme(o.value)}
            aria-label={`${o.label} theme`}
            aria-pressed={active}
            title={o.label}
            className={`grid h-7 w-7 place-items-center rounded-full transition ${
              active
                ? "bg-pos-button text-amber-50 dark:bg-pos-button dark:text-stone-950"
                : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
            }`}
          >
            {o.icon}
          </button>
        );
      })}
    </div>
  );
}

function UserBlock({ collapsed }: { collapsed?: boolean }) {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (user?.name ?? "?").charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative border-t border-stone-200/70 pt-3 dark:border-stone-800"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed ? user?.name : undefined}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-stone-900/5 dark:hover:bg-white/5 ${
          collapsed ? "lg:justify-center lg:px-0" : ""
        }`}
      >
        {user?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt={user.name}
            className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-amber-200 text-sm font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">
            {initial}
          </span>
        )}
        <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
          <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
            {user?.name}
          </p>
          <p className="text-xs uppercase tracking-wide text-stone-400 dark:text-stone-500">
            {user?.role}
          </p>
        </div>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-stone-400 transition-transform dark:text-stone-500 ${
            open ? "rotate-180" : ""
          } ${collapsed ? "lg:hidden" : ""}`}
          {...sw}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="pos-drop absolute bottom-full left-0 mb-2 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-800 dark:bg-stone-900"
        >
          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Appearance
            </span>
            <ThemeSwitch />
          </div>
          <div className="my-1 border-t border-stone-100 dark:border-stone-800" />
          {isAdmin && (
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-stone-700 transition hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" {...sw}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
              Settings
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" {...sw}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const { isAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const allowedPages = user?.allowedPages;

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col justify-between border-r border-white/60 bg-pos-sidebar p-4 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex dark:border-stone-800/60 ${
          collapsed ? "lg:w-20" : "lg:w-64"
        }`}
      >
        {/* Collapse / expand toggle on the right edge */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
          className="absolute -right-3 top-7 z-40 hidden h-6 w-6 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm transition hover:text-stone-800 lg:grid dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
            {...sw}
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="space-y-6">
          <Brand collapsed={collapsed} />
          <NavLinks
            pathname={pathname}
            isAdmin={isAdmin}
            allowedPages={allowedPages}
            collapsed={collapsed}
          />
        </div>
        <UserBlock collapsed={collapsed} />
      </aside>

      {/* Mobile: top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/60 bg-pos-sidebar px-4 py-3 backdrop-blur-xl lg:hidden dark:border-stone-800/60">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeSwitch />
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile: slide-over drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col justify-between border-r border-white/60 bg-pos-sidebar p-4 backdrop-blur-xl dark:border-stone-800/60">
            <div className="space-y-6">
              <Brand />
              <NavLinks
                pathname={pathname}
                isAdmin={isAdmin}
                allowedPages={allowedPages}
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
