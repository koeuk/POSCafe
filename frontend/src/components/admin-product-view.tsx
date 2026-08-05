"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rolePathBase } from "@/lib/permissions";
import {
  effectivePrice,
  formatPrice,
  hasDiscount,
  hasSizes,
} from "@/lib/pricing";
import { type Product } from "@/lib/types";
import { GLASS } from "@/lib/ui";

function ProductView({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Stay in the current role's namespace (admin: clean, cashier: /cashier/*).
  const base = rolePathBase(usePathname());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await api<Product>(`/products/${id}`);
        if (!cancelled) setProduct(p);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load product",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl">
        <div className={`h-40 animate-pulse rounded-2xl ${GLASS}`} />
        <div className={`mt-6 h-96 animate-pulse rounded-2xl ${GLASS}`} />
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="mx-auto max-w-5xl">
        <div className={`rounded-2xl p-6 ${GLASS}`}>
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error ?? "Product not found."}
          </p>
          <Link
            href={`${base}/products`}
            className="mt-4 inline-block text-sm font-medium text-stone-600 hover:underline dark:text-stone-300"
          >
            ← Back to products
          </Link>
        </div>
      </main>
    );
  }

  const images = [product.image, ...(product.gallery ?? [])].filter(
    Boolean,
  ) as string[];
  const current = images[active] ?? null;
  const sized = hasSizes(product);
  const discounted = hasDiscount(product);
  const totalStock = sized
    ? (product.variants ?? []).reduce((sum, v) => sum + v.stock, 0)
    : product.stock;

  return (
    <main className="mx-auto max-w-5xl">
      {/* Header */}
      <header
        className={`mb-6 flex flex-wrap items-start justify-between gap-3 rounded-2xl px-5 py-5 ${GLASS}`}
      >
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-stone-400 dark:text-stone-500">
            <Link href={`${base}/products`} className="hover:underline">
              Products
            </Link>
            <span>/</span>
            <span className="text-stone-600 dark:text-stone-300">
              {product.name}
            </span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            {product.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/products`}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Back
          </Link>
          <Link
            href={`/menu/${product.id}`}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Customer view
          </Link>
          <Link
            href={`${base}/products?edit=${product.id}`}
            className="rounded-lg bg-pos-button px-4 py-2 text-sm font-medium text-pos-button-fg transition hover:opacity-90"
          >
            Edit product
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,420px)_1fr]">
        {/* Gallery */}
        <section className={`overflow-hidden rounded-2xl ${GLASS}`}>
          <div className="aspect-square w-full bg-stone-100 dark:bg-stone-800">
            {current ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-7xl">
                ☕
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-3">
              {images.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Show image ${index + 1}`}
                  className={`shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                    index === active
                      ? "ring-pos-button"
                      : "ring-stone-200 hover:ring-stone-300 dark:ring-stone-700"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-16 w-16 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Details */}
        <section className={`rounded-2xl p-6 ${GLASS}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {product.category && (
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                    {product.category.name}
                  </span>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    product.isAvailable
                      ? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                      : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
                  }`}
                >
                  {product.isAvailable ? "Available" : "Hidden"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                  {sized ? "from " : ""}
                  {formatPrice(effectivePrice(product))}
                </span>
                {discounted && !sized && (
                  <span className="text-base text-stone-400 line-through">
                    {formatPrice(product.price)}
                  </span>
                )}
              </div>
            </div>
            {discounted && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {product.discountPercent}% off
              </span>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Info label="Base price" value={formatPrice(product.price)} />
            <Info label="Total stock" value={String(totalStock)} />
            <Info label="Sizes" value={sized ? String(product.variants?.length ?? 0) : "—"} />
          </div>

          {sized && product.variants && product.variants.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                Sizes &amp; stock
              </h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-stone-200/70 dark:border-stone-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-400 dark:bg-stone-800/50 dark:text-stone-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Size</th>
                      <th className="px-4 py-2.5 font-medium">Price</th>
                      <th className="px-4 py-2.5 font-medium">In stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {product.variants.map((s) => (
                      <tr
                        key={s.size}
                        className="text-stone-700 dark:text-stone-300"
                      >
                        <td className="px-4 py-2.5 font-medium text-stone-900 dark:text-stone-100">
                          {s.size}
                        </td>
                        <td className="px-4 py-2.5">{formatPrice(s.price)}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={
                              (s.stock ?? 0) > 0
                                ? ""
                                : "text-red-500 dark:text-red-400"
                            }
                          >
                            {s.stock ?? 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {product.description && (
            <div className="mt-6 border-t border-stone-100 pt-5 dark:border-stone-800">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                Description
              </h2>
              <p className="mt-2 leading-relaxed text-stone-700 dark:text-stone-300">
                {product.description}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200/70 bg-stone-50 px-4 py-3 dark:border-stone-800 dark:bg-stone-800/40">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-stone-900 dark:text-stone-100">
        {value}
      </p>
    </div>
  );
}

export function AdminProductView({ id }: { id: string }) {
  return <ProductView id={id} />;
}
