import type { ReactNode } from "react";
import { StaffShell } from "@/components/staff-shell";

// Management pages (categories, products, stock, reports) at clean top-level
// URLs. Auth + sidebar come from the (staff) layout; access is enforced per
// page by PageGuard. This only adds the standard content padding.
export default function ManageLayout({ children }: { children: ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
