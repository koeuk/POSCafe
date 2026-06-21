"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { PageTransition } from "./page-transition";

const COLLAPSE_KEY = "poscafe-sidebar-collapsed";

export function StaffFrame({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // Restore the user's collapsed preference after mount.
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F6] dark:bg-stone-950">
      <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      <div
        className={`transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          collapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
