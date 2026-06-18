import type { ReactNode } from "react";
import { RequireAuth } from "@/components/require-auth";
import { StaffShell } from "@/components/staff-shell";
import { Role } from "@/lib/types";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth role={Role.ADMIN}>
      <StaffShell>{children}</StaffShell>
    </RequireAuth>
  );
}
