// Sidebar pages an admin can grant to a cashier.
//
// `key` must match the `key` on the corresponding NAV item in
// components/sidebar.tsx. Every sidebar page is grantable — management pages
// (Dashboard, Categories, Products, Stock, Reports) have cashier routes under
// /cashier/* (see CASHIER_PAGE_HREFS) and are only visible once an admin grants
// them via allowedPages. Routes with no page key here (e.g. /settings) stay
// admin-only — see ADMIN_ONLY_PREFIXES below.

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
  { key: "categories", label: "Categories" },
  { key: "products", label: "Products" },
  { key: "stock", label: "Stock" },
  { key: "order-history", label: "Order History" },
  { key: "reports", label: "Reports" },
  { key: "qr", label: "QR Code" },
];

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

// Route prefix for the current role context, inferred from the path: cashier
// pages live under /cashier/*, admin pages at the clean root. Use to build
// sibling links that stay within the same namespace, e.g.
// `${rolePathBase(pathname)}/products`.
export function rolePathBase(pathname: string): "" | "/cashier" {
  return pathname.startsWith("/cashier") ? "/cashier" : "";
}

// Drops the optional /cashier namespace so a route is always matched against
// its clean form. Every path comparison in this file must go through this —
// checking a raw pathname against a clean prefix silently lets the namespaced
// variant (e.g. /cashier/settings) slip past the admin-only test below.
function stripCashierPrefix(pathname: string): string {
  return pathname.startsWith("/cashier/")
    ? pathname.slice("/cashier".length)
    : pathname;
}

// Which page a pathname belongs to. The optional /cashier prefix is stripped
// first so both /reports and /cashier/reports resolve to the same key
// (longest-prefix match so nested routes like /products/12 still resolve).
export function pageKeyForPath(pathname: string): string | null {
  const path = stripCashierPrefix(pathname);
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

// Where a signed-in user should land. Admins get the dashboard; a cashier goes
// straight to their first granted page. Sending everyone to /dashboard means a
// cashier without that grant gets bounced by PageGuard, flashing a
// "Redirecting…" screen on every single login.
export function landingHref(
  role: string,
  allowedPages: string[] | null | undefined,
): string {
  if (role === "admin") return "/dashboard";
  return firstAllowedHref(resolveCashierPages(allowedPages)) ?? "/dashboard";
}

// Admin-only routes that have no cashier-assignable page key. Cashiers are
// denied these even though they don't map to a CASHIER_PAGES entry.
// (/manage-orders is the admin Order History full view; /settings the
// staff-account manager.)
const ADMIN_ONLY_PREFIXES = ["/settings", "/manage-orders"];

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
  const path = stripCashierPrefix(pathname);
  const adminOnly = ADMIN_ONLY_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  return !adminOnly;
}
