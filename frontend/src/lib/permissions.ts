// Sidebar pages an admin can grant to a cashier.
//
// `key` must match the `key` on the corresponding NAV item in
// components/sidebar.tsx. Only pages whose backend endpoints a cashier may
// already call are assignable here — Dashboard, Categories, Products, Stock and
// Reports stay admin-only and are intentionally absent.

export interface PagePermission {
  key: string;
  label: string;
}

// Every sidebar page is assignable. Order here drives the permissions UI and
// the redirect fallback (first granted page wins).
export const CASHIER_PAGES: PagePermission[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "pos", label: "Point of Sale" },
  { key: "orders", label: "Orders" },
  { key: "payments", label: "Payments" },
  { key: "kitchen", label: "Kitchen" },
  { key: "categories", label: "Categories" },
  { key: "products", label: "Products" },
  { key: "stock", label: "Stock" },
  { key: "order-history", label: "Order History" },
  { key: "reports", label: "Reports" },
  { key: "qr", label: "QR Code" },
];

export const CASHIER_PAGE_KEYS = CASHIER_PAGES.map((p) => p.key);

// Pages a cashier sees when `allowedPages` has never been set (legacy accounts).
// Mirrors the original hard-coded cashier sidebar.
export const DEFAULT_CASHIER_PAGES = ["pos", "orders", "order-history"];

// The pages a cashier can actually see, given their stored allowedPages.
export function resolveCashierPages(allowed?: string[] | null): string[] {
  return allowed ?? DEFAULT_CASHIER_PAGES;
}

// Canonical (admin) route for each page — the clean path with no role prefix.
// Used to resolve which page a URL belongs to.
export const CLEAN_PAGE_HREFS: Record<string, string> = {
  dashboard: "/dashboard",
  pos: "/pos",
  orders: "/orders",
  payments: "/pay",
  kitchen: "/kitchen",
  categories: "/categories",
  products: "/products",
  stock: "/stock",
  "order-history": "/order-history",
  reports: "/reports",
  qr: "/qr",
};

// Where the sidebar sends a cashier. The management pages live under a
// /cashier/* namespace so the cashier role is visible in the URL; admins use
// the clean routes above.
export const CASHIER_PAGE_HREFS: Record<string, string> = {
  ...CLEAN_PAGE_HREFS,
  pos: "/cashier/pos",
  orders: "/cashier/orders",
  categories: "/cashier/categories",
  products: "/cashier/products",
  stock: "/cashier/stock",
  "order-history": "/cashier/order-history",
  reports: "/cashier/reports",
};

// Which page a pathname belongs to. The optional /cashier prefix is stripped
// first so both /reports and /cashier/reports resolve to the same key
// (longest-prefix match so nested routes like /products/12 still resolve).
export function pageKeyForPath(pathname: string): string | null {
  const path = pathname.startsWith("/cashier/")
    ? pathname.slice("/cashier".length)
    : pathname;
  let best: string | null = null;
  let bestLen = -1;
  for (const [key, href] of Object.entries(CLEAN_PAGE_HREFS)) {
    const match = path === href || path.startsWith(`${href}/`);
    if (match && href.length > bestLen) {
      best = key;
      bestLen = href.length;
    }
  }
  return best;
}

// First page (in sidebar order) a cashier may visit — used as a redirect target.
export function firstAllowedHref(allowed: string[]): string | null {
  const page = CASHIER_PAGES.find((p) => allowed.includes(p.key));
  return page ? CASHIER_PAGE_HREFS[page.key] : null;
}

// Admin-only routes that have no cashier-assignable page key. Cashiers are
// denied these even though they don't map to a CASHIER_PAGES entry.
// (/manage-orders is the admin Order History full view; /menu-preview the admin
// menu browser; /settings the staff-account manager.)
const ADMIN_ONLY_PREFIXES = ["/settings", "/menu-preview", "/manage-orders"];

// Whether the given role/permissions may view the page at `pathname`.
// Admins see everything; cashiers see granted pages plus shared unmapped routes
// (e.g. /view-menu), but never the admin-only routes above.
export function isPathAllowed(
  role: string,
  allowedPages: string[] | null | undefined,
  pathname: string,
): boolean {
  if (role === "admin") return true;
  const key = pageKeyForPath(pathname);
  if (key) return resolveCashierPages(allowedPages).includes(key);
  const adminOnly = ADMIN_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  return !adminOnly;
}
