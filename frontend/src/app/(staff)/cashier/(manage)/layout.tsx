import type { ReactNode } from "react";
import { StaffShell } from "@/components/staff-shell";

// Cashier-namespaced management pages (/cashier/categories, /products, /stock,
// /reports). These re-use the admin page components, which expect their shell
// from a layout, so this adds the standard padded content area. Auth + sidebar
// come from the (staff) layout; access is enforced per page by PageGuard.
export default function CashierManageLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <StaffShell>{children}</StaffShell>;
}
