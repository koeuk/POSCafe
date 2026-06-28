import type { ReactNode } from "react";
import { StaffShell } from "@/components/staff-shell";

// Cashier-namespaced management pages (/cashier/*). Auth + sidebar come from
// the (staff) layout; PageGuard enforces per-page access.
export default function CashierLayout({ children }: { children: ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
