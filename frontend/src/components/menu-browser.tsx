"use client";

import Link from "next/link";
import { Fraunces } from "next/font/google";
import { useMemo } from "react";
import { useBranding } from "@/lib/branding-context";
import { effectivePrice, formatPrice, hasDiscount, hasSizes } from "@/lib/pricing";
import type { MenuCategory } from "@/lib/types";
import { useMenuFilter } from "@/lib/use-menu-filter";
import { ThemeToggle } from "@/components/theme-toggle";

// Editorial display serif — gives the menu its warm, artisanal voice.
const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700", "900"],
  style: ["normal", "italic"],
});

export function MenuBrowser({ menu }: { menu: MenuCategory[] }) {
  const { appName, logoUrl } = useBranding();
  const { query, setQuery, activeCat, setActiveCat, visible } =
    useMenuFilter(menu);

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

  const hasResults = visible.length > 0;

  return (
    <div className="font-ios flex h-screen flex-col bg-amber-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {/* Header (pinned) */}
      <header className="relative flex-shrink-0 overflow-hidden bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 px-5 pb-7 pt-9 text-[#3a2a16] dark:from-stone-900 dark:via-stone-900 dark:to-stone-950 dark:text-amber-50">
        {/* Soft depth glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-orange-300/50 blur-3xl dark:bg-amber-500/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-amber-200/60 blur-2xl dark:bg-stone-700/30"
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={appName}
                  className="h-12 w-12 rounded-2xl object-cover shadow-lg shadow-orange-900/25"
                />
              ) : (
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#3a2a16] text-amber-50 shadow-lg shadow-orange-900/25 dark:bg-pos-button dark:text-stone-950">
                  <CupIcon />
                </span>
              )}
              <div>
                <h1
                  className={`${display.className} text-3xl font-black leading-none tracking-tight`}
                >
                  {appName}
                </h1>
                <p className="mt-1.5 text-sm font-medium text-[#7a5a30] dark:text-amber-200/70">
                  Freshly brewed, made to order
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Search */}
          <div className="relative mt-6">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a drink, pastry, or category…"
              className="w-full rounded-2xl border border-white/70 bg-white/95 py-3.5 pl-11 pr-11 text-sm text-stone-900 shadow-lg shadow-orange-900/5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-400/30 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-700"
              >
                <ClearIcon />
              </button>
            )}
          </div>

          {/* Category filter — lives on the header, stays visible while scrolling */}
          <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pt-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 pb-20">
          {/* Promo banner */}
          {topDiscount > 0 && (
            <div className="promo-shimmer relative mt-6 flex items-center justify-between overflow-hidden rounded-3xl bg-gradient-to-r from-red-500 via-red-500 to-orange-500 px-6 py-6 text-white shadow-lg shadow-red-500/20 ring-1 ring-white/10">
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-10 right-24 h-40 w-40 rounded-full bg-white/10 blur-2xl"
              />
              <div className="relative z-10">
                <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm">
                  Today only
                </span>
                <p
                  className={`${display.className} mt-2 text-4xl font-black leading-none sm:text-5xl`}
                >
                  {topDiscount}% OFF
                </p>
                <p className="mt-2 text-sm text-white/90">
                  On selected items — ask our staff
                </p>
              </div>
              <span className="promo-bob relative z-10 text-6xl drop-shadow-md">
                🍰
              </span>
            </div>
          )}

          {/* Results */}
          {!hasResults ? (
            <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-3xl dark:bg-stone-800">
                🔎
              </span>
              <p className="mt-4 font-semibold text-stone-700 dark:text-stone-200">
                Nothing matches “{query}”
              </p>
              <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
                Try a different drink or category.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-10">
              {visible.map((cat) => (
                <section key={cat.id}>
                  <div className="mb-4 flex items-baseline gap-3">
                    <h2
                      className={`${display.className} text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100`}
                    >
                      {cat.name}
                    </h2>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-stone-800 dark:text-amber-300/80">
                      {cat.products.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {cat.products.map((product) => (
                      <Link
                        key={product.id}
                        href={`/menu/${product.id}`}
                        className="relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200/70 transition-shadow duration-300 hover:shadow-xl hover:shadow-orange-900/10 dark:bg-stone-900 dark:ring-stone-800"
                      >
                        <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-amber-100 to-stone-100 dark:from-stone-800 dark:to-stone-900">
                          {product.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-5xl opacity-80">
                              ☕
                            </div>
                          )}
                          {hasDiscount(product) && (
                            <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow-md shadow-red-500/30">
                              −{product.discountPercent}%
                            </span>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col p-4">
                          <p className="font-semibold leading-snug text-stone-900 dark:text-stone-100">
                            {product.name}
                          </p>
                          {product.description && (
                            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                              {product.description}
                            </p>
                          )}
                          <div className="mt-auto flex items-baseline gap-2 pt-3">
                            <span
                              className={`${display.className} text-lg font-bold text-stone-900 dark:text-stone-100`}
                            >
                              {hasSizes(product) && (
                                <span className="mr-1 font-sans text-xs font-medium text-stone-400">
                                  from
                                </span>
                              )}
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

          <footer className="mt-16 flex flex-col items-center gap-1 text-center">
            <span className="text-lg">☕</span>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500">
              Prices in USD · Ask our staff to place your order
            </p>
          </footer>
        </div>
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
      className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-pos-button text-pos-button-fg shadow-md shadow-orange-900/15"
          : "bg-white/80 text-stone-600 ring-1 ring-stone-200 backdrop-blur hover:bg-white dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-stone-800"
      }`}
    >
      {label}
    </button>
  );
}

function CupIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8h1.5a2.5 2.5 0 0 1 0 5H18" />
      <path d="M4 8h14v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" />
      <path d="M8 2c-.4.6-.4 1.4 0 2M12 2c-.4.6-.4 1.4 0 2M16 2c-.4.6-.4 1.4 0 2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
