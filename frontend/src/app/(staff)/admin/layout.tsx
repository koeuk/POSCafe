import type { ReactNode } from "react";
import { StaffShell } from "@/components/staff-shell";

// Access to /admin/* routes is enforced by PageGuard in the (staff) layout:
// admins see everything, cashiers only pages they've been granted, and
// unmapped admin routes (e.g. settings) stay admin-only.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
