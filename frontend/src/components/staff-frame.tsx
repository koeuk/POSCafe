"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "./sidebar";

export function StaffFrame({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <div className="min-h-screen bg-[#F3ECE3]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#F3ECE3]">
      <Sidebar />
      <div className="lg:pl-64">{children}</div>
    </div>
  );
}
