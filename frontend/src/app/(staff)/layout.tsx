import type { ReactNode } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Sidebar } from "@/components/sidebar";

// Shared shell for all staff pages (admin, POS, orders): a persistent
// sidebar on the left, content on the right. URLs are unchanged because
// (staff) is a route group.
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
