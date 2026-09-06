"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import {
  NO_ACCESS_HREF,
  firstAllowedHref,
  isPathAllowed,
  resolveCashierPages,
} from "@/lib/permissions";
import { Role } from "@/lib/types";

/**
 * Page-level permission gate for all staff routes. Authentication is handled by
 * the surrounding RequireAuth; this only redirects an authenticated user away
 * from a page their role/permissions don't allow.
 */
export function PageGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useT();
  const pathname = usePathname();
  const router = useRouter();

  const allowed =
    !user || isPathAllowed(user.role, user.allowedPages, pathname);

  useEffect(() => {
    if (loading || !user || allowed) return;
    const target =
      user.role === Role.ADMIN
        ? "/dashboard"
        : firstAllowedHref(resolveCashierPages(user.allowedPages));
    // Must match landingHref's fallback. Redirecting to /login instead would
    // bounce off the login page (which sends a signed-in user back to their
    // landing href) and loop forever.
    router.replace(target ?? NO_ACCESS_HREF);
    // `pathname` matters even though only `allowed` is read: navigating from
    // one blocked page to another leaves `allowed` false on both sides, so
    // without it the effect never re-runs and the redirect never fires —
    // leaving the user stuck on "Redirecting…" for good.
  }, [loading, user, allowed, pathname, router]);

  if (!loading && user && !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-stone-500 dark:text-stone-400">
        {t("Redirecting…")}
      </div>
    );
  }

  return <>{children}</>;
}
