import { CashierMenuBrowser } from "@/components/cashier-menu-browser";
import { StaffShell } from "@/components/staff-shell";
import type { MenuCategory } from "@/lib/types";

// Cashier menu preview is always fresh (availability/prices change).
export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getMenu(): Promise<MenuCategory[]> {
  const res = await fetch(`${API_URL}/menu`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load menu (${res.status})`);
  return res.json();
}

export default async function MenuPage() {
  let menu: MenuCategory[] = [];
  let error: string | null = null;
  try {
    menu = await getMenu();
  } catch {
    error = "Sorry, the menu is unavailable right now.";
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F5F6] px-4 dark:bg-stone-950">
        <p className="rounded-xl bg-red-50 px-6 py-8 text-center text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      </main>
    );
  }

  return (
    <StaffShell>
      <CashierMenuBrowser menu={menu} />
    </StaffShell>
  );
}
