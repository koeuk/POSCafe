"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { effectivePrice, formatPrice, hasDiscount, hasSizes } from "@/lib/pricing";
import type { MenuCategory } from "@/lib/types";
import { GLASS } from "@/lib/ui";

export function AdminMenuBrowser({ menu }: { menu: MenuCategory[] }) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<number | "all">("all");

  const summary = useMemo(() => {
    const products = menu.flatMap((cat) => cat.products);
    return {
      categories: menu.length,
      products: products.length,
      discounted: products.filter(hasDiscount).length,
      stocked: products.filter((product) => product.stock > 0).length,
    };
  }, [menu]);

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
                (product) =>
                  product.name.toLowerCase().includes(q) ||
                  (product.description ?? "").toLowerCase().includes(q),
              );
        return { ...cat, products };
      })
      .filter((cat) => cat.products.length > 0);
  }, [menu, query, activeCat]);

  return (
    <main className="mx-auto max-w-7xl">
      <header className={`mb-6 rounded-2xl px-5 py-5 ${GLASS}`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">
              Menu Preview
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Admin view of published categories, availability, pricing, and discounts.
            </p>
          </div>
          <Link
            href="/admin/products"
            className="rounded-lg bg-[#2A1D15] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3A2A20]"
          >
            Manage products
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Categories" value={String(summary.categories)} />
          <Metric label="Products" value={String(summary.products)} />
          <Metric label="Discounted" value={String(summary.discounted)} />
          <Metric label="In stock" value={String(summary.stocked)} />
        </div>
      </header>

      <section className={`rounded-2xl p-5 ${GLASS}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="All"
              active={activeCat === "all"}
              onClick={() => setActiveCat("all")}
            />
            {menu.map((cat) => (
              <FilterChip
                key={cat.id}
                label={cat.name}
                active={activeCat === cat.id}
                onClick={() => setActiveCat(cat.id)}
              />
            ))}
          </div>
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 lg:w-80">
            <span className="text-stone-400">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Product or category"
              className="min-w-0 flex-1 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
            />
          </label>
        </div>

        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-stone-400">
            No menu items match this view.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {visible.map((cat) => (
              <section key={cat.id}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-stone-900">
                    {cat.name}
                  </h2>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
                    {cat.products.length} item{cat.products.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {cat.products.map((product) => (
                    <Link
                      key={product.id}
                      href={`/admin/menu/${product.id}`}
                      className={`group grid grid-cols-[72px_1fr] overflow-hidden rounded-2xl ${GLASS} transition hover:border-[#2A1D15]/30 hover:shadow-md`}
                    >
                      <div className="relative h-full min-h-24 bg-stone-100">
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-2xl">
                            ☕
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-stone-900 group-hover:text-[#2A1D15]">
                              {product.name}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-stone-500">
                              {product.description || "No description"}
                            </p>
                          </div>
                          {hasDiscount(product) && (
                            <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                              -{product.discountPercent}%
                            </span>
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-bold text-stone-900">
                            {hasSizes(product) ? "from " : ""}
                            {formatPrice(effectivePrice(product))}
                          </span>
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                            Stock {product.stock}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              product.isAvailable
                                ? "bg-green-50 text-green-700"
                                : "bg-stone-100 text-stone-500"
                            }`}
                          >
                            {product.isAvailable ? "Visible" : "Hidden"}
                          </span>
                        </div>
                        {product.gallery && product.gallery.length > 0 && (
                          <div className="mt-3 flex gap-1.5">
                            {product.gallery.slice(0, 4).map((url, index) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={`${url}-${index}`}
                                src={url}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-stone-200"
                              />
                            ))}
                            {product.gallery.length > 4 && (
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-stone-100 text-xs font-medium text-stone-500">
                                +{product.gallery.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200/70 bg-stone-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-stone-900">{value}</p>
    </div>
  );
}

function FilterChip({
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
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-[#2A1D15] text-white"
          : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
      }`}
    >
      {label}
    </button>
  );
}
