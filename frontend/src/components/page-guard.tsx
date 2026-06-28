"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import {
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
    router.replace(target ?? "/login");
  }, [loading, user, allowed, router]);

  if (!loading && user && !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-stone-500 dark:text-stone-400">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
