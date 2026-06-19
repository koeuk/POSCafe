"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Role } from "@/lib/types";

interface RequireAuthProps {
  children: ReactNode;
  /** Restrict to a specific role (e.g. admin-only pages). */
  role?: Role;
}

/**
 * Guards a page: redirects unauthenticated users to /login, and users
 * lacking the required role back to the POS screen.
 */
export function RequireAuth({ children, role }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (role && user.role !== role) {
      router.replace("/pos");
    }
  }, [user, loading, role, router]);

  if (loading || !user || (role && user.role !== role)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
