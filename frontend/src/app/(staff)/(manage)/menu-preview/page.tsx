import { AdminMenuBrowser } from "@/components/admin-menu-browser";
import { RequireAuth } from "@/components/require-auth";
import { Role, type MenuCategory } from "@/lib/types";

// Admin menu preview is always fresh (availability/prices change).
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
      <main className="flex min-h-screen items-center justify-center bg-[#F5F5F6] px-4">
        <p className="rounded-xl bg-red-50 px-6 py-8 text-center text-red-600">
          {error}
        </p>
      </main>
    );
  }

  return (
    <RequireAuth role={Role.ADMIN}>
      <AdminMenuBrowser menu={menu} />
    </RequireAuth>
  );
}
