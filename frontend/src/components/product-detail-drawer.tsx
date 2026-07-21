"use client";

import { useEffect, useRef, useState } from "react";
import {
  effectivePrice,
  formatPrice,
  hasDiscount,
  hasSizes,
  sizeStock,
  totalStock,
} from "@/lib/pricing";
import type { Product, ProductSize } from "@/lib/types";

/**
 * Right slide-over showing a product's full details (image, gallery, sizes,
 * description). Optionally lets staff add a size straight to the order via
 * `onAdd`. Pass `product = null` to keep it closed.
 */
export function ProductDetailDrawer({
  product,
  onClose,
  onAdd,
}: {
  product: Product | null;
  onClose: () => void;
  onAdd?: (product: Product, size?: ProductSize | null) => void;
}) {
  const [activeImage, setActiveImage] = useState<string | null>(null);

  // Keep the latest onClose in a ref so the Escape/scroll-lock effect below can
  // depend only on `product`. onClose is a fresh closure on every parent render
  // (it's usually an inline arrow), so including it in the deps would tear down
  // and re-install the listener — and momentarily unlock body scroll — on every
  // parent re-render, e.g. each time an item is added from the drawer.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Reset the previewed image whenever a different product opens.
  useEffect(() => {
    setActiveImage(product?.image ?? null);
  }, [product]);

  // Close on Escape and lock body scroll while open.
  useEffect(() => {
    if (!product) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [product]);

  if (!product) return null;

  const sizes = product.sizes ?? [];
  const stock = totalStock(product);
  const soldOut = !product.isAvailable || stock <= 0;
  const gallery = [
    ...(product.image ? [product.image] : []),
    ...(product.gallery ?? []),
  ];

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="drawer-overlay-in absolute inset-0 bg-stone-950/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="drawer-panel-in absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-stone-900">
        <header className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-800">
          <h2 className="text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Product details
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 text-stone-500 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* Image */}
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-stone-100 dark:from-amber-500/15 dark:to-stone-800">
            {activeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeImage}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-6xl opacity-70">
                ☕
              </div>
            )}
            {hasDiscount(product) && (
              <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white shadow">
                -{product.discountPercent}% OFF
              </span>
            )}
            {soldOut && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] dark:bg-stone-950/60">
                <span className="rounded-full bg-stone-900/80 px-3 py-1 text-xs font-semibold text-white">
                  Sold out
                </span>
              </div>
            )}
          </div>

          {/* Gallery thumbnails */}
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {gallery.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(url)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                    activeImage === url
                      ? "ring-pos-button"
                      : "ring-transparent hover:ring-stone-300 dark:hover:ring-stone-600"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${product.name} ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Category + name + price */}
          {product.category && (
            <span className="mt-5 inline-block rounded-full bg-amber-200 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">
              {product.category.name}
            </span>
          )}
          <h3 className="mt-3 text-2xl font-extrabold text-stone-900 dark:text-stone-100">
            {product.name}
          </h3>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-xl font-bold text-red-600 dark:text-red-400">
              {hasSizes(product) ? "from " : ""}
              {formatPrice(effectivePrice(product))}
            </span>
            {hasDiscount(product) && !hasSizes(product) && (
              <span className="text-sm text-stone-400 line-through dark:text-stone-500">
                {formatPrice(product.price)}
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            {soldOut ? "Out of stock" : `${stock} in stock`}
          </p>

          {/* Sizes */}
          {hasSizes(product) && (
            <div className="mt-6">
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Sizes
              </h4>
              <div className={sizes.length === 1 ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2"}>
                {sizes.map((size, index) => {
                  const sizeOut = sizeStock(product, size.size) <= 0;
                  return (
                    <button
                      key={size.size}
                      type="button"
                      disabled={!onAdd || sizeOut}
                      onClick={() => onAdd?.(product, size)}
                      className={["flex", sizes.length === 3 && index === 2 ? "col-span-2" : "", "w-full min-w-0 max-w-full items-center justify-between gap-3 rounded-xl border border-stone-200 px-3 py-2.5 text-sm transition hover:border-pos-button disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700"].join(" ")}
                    >
                      <span className="min-w-0 break-words text-left font-medium leading-snug text-stone-700 dark:text-stone-300">
                        {size.size}
                        {sizeOut && (
                          <span className="ml-1.5 text-xs text-red-500">out</span>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                        {formatPrice(effectivePrice(product, size))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div className="mt-6">
              <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Description
              </h4>
              <p className="leading-relaxed text-stone-700 dark:text-stone-300">
                {product.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer: quick add for products without sizes */}
        {onAdd && !hasSizes(product) && (
          <div className="border-t border-stone-200 px-5 py-4 dark:border-stone-800">
            <button
              type="button"
              disabled={soldOut}
              onClick={() => onAdd(product)}
              className="w-full rounded-xl bg-pos-button py-3 text-sm font-semibold text-pos-button-fg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {soldOut ? "Sold out" : "Add to order"}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
