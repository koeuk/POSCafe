"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { effectivePrice, formatPrice, hasDiscount, hasSizes } from "@/lib/pricing";
import type { MenuCategory } from "@/lib/types";

export function MenuBrowser({ menu }: { menu: MenuCategory[] }) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<number | "all">("all");

  // Best discount across the menu — drives the promo banner.
  const topDiscount = useMemo(
    () =>
      menu.reduce(
        (max, cat) =>
          cat.products.reduce(
            (m, p) => Math.max(m, p.discountPercent ?? 0),
            max,
          ),
        0,
      ),
    [menu],
  );

  // Filter by active category + search (matches product name OR category name).
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu
      .filter((cat) => activeCat === "all" || cat.id === activeCat)
      .map((cat) => {
        const catMatches = cat.name.toLowerCase().includes(q);
        const products = !q
          ? cat.products
          : catMatches
            ? cat.products // typing a category name shows all its products
            : cat.products.filter(
                (p) =>
                  p.name.toLowerCase().includes(q) ||
                  (p.description ?? "").toLowerCase().includes(q),
              );
        return { ...cat, products };
      })
      .filter((cat) => cat.products.length > 0);
  }, [menu, query, activeCat]);

  const hasResults = visible.length > 0;

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="bg-amber-400 px-5 pb-6 pt-8 text-stone-900">
        <h1 className="text-2xl font-extrabold tracking-tight">☕ POSCAFE</h1>
        <p className="text-sm font-medium text-amber-900/80">
          Browse our menu
        </p>

        {/* Search */}
        <div className="mt-4">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-sm">
            <span className="text-stone-400">🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search product or category…"
              className="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-stone-400 hover:text-stone-600"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-16">
        {/* Promo banner */}
        {topDiscount > 0 && (
          <div className="mt-5 flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 px-5 py-5 text-white shadow-sm">
            <div>
              <p className="text-3xl font-extrabold leading-none">
                {topDiscount}% OFF
              </p>
              <p className="mt-1 text-sm text-white/90">
                On selected items today
              </p>
            </div>
            <span className="text-5xl">🍰</span>
          </div>
        )}

        {/* Category tabs */}
        <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip
            label="All"
            active={activeCat === "all"}
            onClick={() => setActiveCat("all")}
          />
          {menu.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.name}
              active={activeCat === cat.id}
              onClick={() => setActiveCat(cat.id)}
            />
          ))}
        </div>

        {/* Results */}
        {!hasResults ? (
          <p className="px-4 py-16 text-center text-stone-400">
            No items match “{query}”.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {visible.map((cat) => (
              <section key={cat.id}>
                <h2 className="mb-3 text-lg font-bold text-stone-900">
                  {cat.name}
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {cat.products.map((product) => (
                    <Link
                      key={product.id}
                      href={`/menu/`}
                      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100 transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="relative aspect-square w-full bg-stone-100">
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-5xl">
                            ☕
                          </div>
                        )}
                        {hasDiscount(product) && (
                          <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white shadow">
                            -{product.discountPercent}%
                          </span>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col p-3">
                        <p className="font-medium text-stone-900 group-hover:text-red-600">
                          {product.name}
                        </p>
                        {product.description && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">
                            {product.description}
                          </p>
                        )}
                        <div className="mt-auto pt-3 flex items-baseline gap-2">
                          <span className="font-bold text-stone-900">
                            {hasSizes(product) ? "from " : ""}
                            {formatPrice(effectivePrice(product))}
                          </span>
                          {hasDiscount(product) && !hasSizes(product) && (
                            <span className="text-xs text-stone-400 line-through">
                              {formatPrice(product.price)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-12 text-center text-xs text-stone-400">
          Prices in USD · Ask our staff to place your order
        </footer>
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-red-500 text-white shadow"
          : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
      }`}
    >
      {label}
    </button>
  );
}
