"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";

export function StaffFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F5F6] dark:bg-stone-950">
      <Sidebar />
      <div className="lg:pl-64">{children}</div>
    </div>
  );
}
