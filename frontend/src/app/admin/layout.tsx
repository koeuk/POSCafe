import type { ReactNode } from "react";
import { StaffShell } from "@/components/staff-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
