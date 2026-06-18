import type { ReactNode } from "react";

/**
 * Thin content wrapper for staff pages. The sidebar + auth are provided by
 * the (staff) route-group layout, so this only handles per-page spacing:
 *  - default: comfortable padding for dashboard-style pages
 *  - `bleed`: full viewport height with no padding, for pages that own their
 *    whole area (the POS).
 */
export function StaffShell({
  children,
  bleed,
}: {
  children: ReactNode;
  bleed?: boolean;
}) {
  if (bleed) {
    return <div className="h-screen overflow-hidden">{children}</div>;
  }
  return <div className="p-4 sm:p-6 lg:p-8">{children}</div>;
}
