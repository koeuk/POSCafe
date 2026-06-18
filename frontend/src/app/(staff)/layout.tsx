import type { ReactNode } from "react";
import { RequireAuth } from "@/components/require-auth";
import { StaffFrame } from "@/components/staff-frame";

// Shared auth shell for all staff pages. Admins get the management sidebar;
// cashier-facing pages use the full viewport for the POS flow.
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-[#F3ECE3]">
        <Sidebar />
        <div className="lg:pl-64">{children}</div>
      </div>
    </RequireAuth>
  );
}
