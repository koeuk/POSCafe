import { SetMetadata } from '@nestjs/common';

export const PAGE_KEY = 'requiredPages';

// Pages a cashier may access when `allowedPages` was never set (null — legacy
// accounts). Mirrors the frontend's DEFAULT_CASHIER_PAGES and the user entity's
// documented "null = fall back to the default cashier pages" semantics.
export const DEFAULT_CASHIER_PAGES = ['pos', 'orders', 'order-history'];

/**
 * Restricts a route to users who can access at least one of the given sidebar
 * pages (enforced by the global RolesGuard). Admins always pass; cashiers pass
 * when one of these page keys is in their `allowedPages`.
 */
export const RequiresPage = (...pages: string[]) =>
  SetMetadata(PAGE_KEY, pages);
