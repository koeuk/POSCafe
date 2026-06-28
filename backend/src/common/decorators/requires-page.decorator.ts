import { SetMetadata } from '@nestjs/common';

export const PAGE_KEY = 'requiredPages';

/**
 * Restricts a route to users who can access at least one of the given sidebar
 * pages (enforced by the global RolesGuard). Admins always pass; cashiers pass
 * when one of these page keys is in their `allowedPages`.
 */
export const RequiresPage = (...pages: string[]) =>
  SetMetadata(PAGE_KEY, pages);
