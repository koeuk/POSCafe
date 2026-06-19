"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Replays a gentle fade + drift-up whenever the route changes, so navigating
 * between staff pages feels smooth instead of snapping. Keying on the pathname
 * remounts the wrapper, which restarts the CSS animation.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
