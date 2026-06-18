import type { ReactNode } from "react";
import { RequireAuth } from "@/components/require-auth";
import { StaffFrame } from "@/components/staff-frame";

// Shared auth shell for staff pages. The sidebar is role-aware:
// cashiers see cashier workflow links, admins see management links too.
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <StaffFrame>{children}</StaffFrame>
    </RequireAuth>
  );
}
