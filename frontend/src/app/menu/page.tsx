import { MenuBrowser, MenuUnavailable } from "@/components/menu-browser";
import type { MenuCategory } from "@/lib/types";

// Customer-facing menu is always fresh (availability/prices change).
export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getMenu(): Promise<MenuCategory[]> {
  const res = await fetch(`${API_URL}/menu`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load menu (${res.status})`);
  return res.json();
}

export default async function MenuPage() {
  let menu: MenuCategory[] | null = null;
  try {
    menu = await getMenu();
  } catch {
    // The apology text is rendered by a client component so it can be
    // translated; this server page only decides which state to show.
    return <MenuUnavailable />;
  }

  return <MenuBrowser menu={menu} />;
}
