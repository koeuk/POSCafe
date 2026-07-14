"use client";

import { useMemo, useState } from "react";
import type { MenuCategory } from "./types";

/**
 * Category-tab + search filtering shared by the public `MenuBrowser` and the
 * admin `AdminMenuBrowser`. Typing a category name shows all its products;
 * otherwise matches product name or description. Empty categories drop out.
 */
export function useMenuFilter(menu: MenuCategory[]) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<number | "all">("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu
      .filter((cat) => activeCat === "all" || cat.id === activeCat)
      .map((cat) => {
        const catMatches = cat.name.toLowerCase().includes(q);
        const products = !q
          ? cat.products
          : catMatches
            ? cat.products
            : cat.products.filter(
                (p) =>
                  p.name.toLowerCase().includes(q) ||
                  (p.description ?? "").toLowerCase().includes(q),
              );
        return { ...cat, products };
      })
      .filter((cat) => cat.products.length > 0);
  }, [menu, query, activeCat]);

  return { query, setQuery, activeCat, setActiveCat, visible };
}
