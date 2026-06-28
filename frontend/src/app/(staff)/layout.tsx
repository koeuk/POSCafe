import type { ReactNode } from "react";
import { PageGuard } from "@/components/page-guard";
import { RequireAuth } from "@/components/require-auth";
import { StaffFrame } from "@/components/staff-frame";

// Shared auth shell for staff pages. RequireAuth handles authentication;
// PageGuard enforces per-cashier page permissions (admins see everything).
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <PageGuard>
        <StaffFrame>{children}</StaffFrame>
      </PageGuard>
    </RequireAuth>
  );
}
