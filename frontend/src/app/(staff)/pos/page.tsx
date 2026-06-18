"use client";

import Link from "next/link";
import { Fraunces } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/staff-shell";
import { api } from "@/lib/api";
import { effectivePrice, formatPrice, hasDiscount } from "@/lib/pricing";
import type { Category, Order, Product, ProductSize } from "@/lib/types";

// Distinctive warm display serif for the brand & headings.
const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"] });

interface CartLine {
  product: Product;
  quantity: number;
  size: ProductSize | null;
}

function cartKey(productId: number, sizeName: string | null | undefined) {
  return `${productId}:${sizeName ?? ""}`;
}

function POSScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  // Load the menu (categories + products) once.
  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      try {
        const [cats, prods] = await Promise.all([
          api<Category[]>("/categories"),
          api<Product[]>("/products"),
        ]);
        if (!cancelled) {
          setCategories(cats);
          setProducts(prods);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load menu",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMenu();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleProducts = useMemo(
    () =>
      activeCategory === null
        ? products
        : products.filter((p) => p.categoryId === activeCategory),
    [products, activeCategory],
  );

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, line) => sum + effectivePrice(line.product, line.size) * line.quantity,
        0,
      ),
    [cart],
  );

  const itemCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart],
  );

  const addToCart = useCallback((product: Product, size: ProductSize | null = null) => {
    setLastOrder(null);
    setCheckoutError(null);
    setCart((prev) => {
      const sizeName = size?.size ?? null;
      // Don't exceed available stock across all size variants of the product.
      const currentForProduct = prev
        .filter((l) => l.product.id === product.id)
        .reduce((sum, l) => sum + l.quantity, 0);
      if (currentForProduct >= product.stock) return prev;

      const existing = prev.find(
        (l) => l.product.id === product.id && (l.size?.size ?? null) === sizeName,
      );
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id && (l.size?.size ?? null) === sizeName
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      return [...prev, { product, quantity: 1, size }];
    });
  }, []);

  const changeQty = useCallback(
    (productId: number, delta: number, sizeName: string | null = null) => {
      setCart((prev) =>
        prev.flatMap((l) => {
          if (l.product.id !== productId || (l.size?.size ?? null) !== sizeName) {
            return [l];
          }
          const next = l.quantity + delta;
          if (next <= 0) return [];
          if (delta > 0) {
            const currentForProduct = prev
              .filter((line) => line.product.id === productId)
              .reduce((sum, line) => sum + line.quantity, 0);
            if (currentForProduct >= l.product.stock) return [l];
          }
          return [{ ...l, quantity: next }];
        }),
      );
    },
    [],
  );

  const clearCart = useCallback(() => setCart([]), []);

  async function handleCheckout() {
    if (cart.length === 0) return;
    setPlacing(true);
    setCheckoutError(null);
    setLastOrder(null);
    try {
      const order = await api<Order>("/orders", {
        method: "POST",
        body: {
          items: cart.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
            ...(l.size ? { size: l.size.size } : {}),
          })),
        },
      });
      setLastOrder(order);
      setCart([]);
      // Refresh products so stock numbers stay accurate.
      try {
        setProducts(await api<Product[]>("/products"));
      } catch {
        // non-fatal — menu will refresh on next load
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="font-ios flex h-full flex-col bg-[#FBF7F1] text-stone-900">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Menu */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Category pills */}
          <div className="flex shrink-0 flex-wrap gap-2 px-5 py-4 sm:px-7">
            <CategoryTab
              label="All"
              active={activeCategory === null}
              onClick={() => setActiveCategory(null)}
            />
            {categories.map((c) => (
              <CategoryTab
                key={c.id}
                label={c.name}
                active={activeCategory === c.id}
                onClick={() => setActiveCategory(c.id)}
              />
            ))}
          </div>

          {/* Product grid */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-7">
            {loading ? (
              <GridSkeleton />
            ) : loadError ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {loadError}
              </p>
            ) : visibleProducts.length === 0 ? (
              <p className="mt-10 text-center text-sm text-stone-400">
                No products here yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {visibleProducts.map((product, i) => {
                  const soldOut = !product.isAvailable || product.stock <= 0;
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      soldOut={soldOut}
                      animationDelay={`${Math.min(i * 40, 400)}ms`}
                      onAdd={addToCart}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Cart */}
        <aside className="flex w-full shrink-0 flex-col border-t border-stone-200/80 bg-white lg:w-[26rem] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between px-6 pb-3 pt-5">
            <h2 className={`${display.className} text-lg font-semibold`}>
              Current Order
            </h2>
            <div className="flex items-center gap-3">
              {itemCount > 0 && (
                <span
                  key={itemCount}
                  className="pos-pop rounded-full bg-[#2A1D15] px-2.5 py-0.5 text-xs font-semibold text-amber-50"
                >
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </span>
              )}
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-sm text-stone-400 transition hover:text-red-500"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            {lastOrder && (
              <div className="pos-drop mx-2 mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[11px] text-white">
                    ✓
                  </span>
                  Order {lastOrder.orderNumber} placed
                </div>
                <div className="mt-1 flex items-center justify-between pl-7">
                  <span>{formatPrice(lastOrder.total)}</span>
                  <div className="flex gap-3">
                    <Link
                      href={`/pay?orderId=${lastOrder.id}`}
                      className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                    >
                      Pay
                    </Link>
                    <Link
                      href="/orders"
                      className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="mt-16 flex flex-col items-center px-6 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-3xl">
                  🧾
                </div>
                <p className="mt-4 font-medium text-stone-500">
                  Your order is empty
                </p>
                <p className="mt-1 text-sm text-stone-400">
                  Tap a product to add it here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {cart.map((line) => (
                  <li
                    key={cartKey(line.product.id, line.size?.size)}
                    className="pos-line-in flex items-center gap-3 rounded-xl border border-stone-100 bg-white px-3 py-2.5 transition hover:border-stone-200"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-amber-50 to-stone-100 text-xl">
                      {line.product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={line.product.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        "☕"
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-stone-900">
                        {line.product.name}
                        {line.size && (
                          <span className="ml-1 text-xs font-normal text-stone-400">
                            {line.size.size}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-stone-500">
                        {formatPrice(effectivePrice(line.product, line.size))}
                        <span className="ml-1.5 font-medium text-stone-900">
                          ={" "}
                          {formatPrice(
                            effectivePrice(line.product, line.size) * line.quantity,
                          )}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <QtyButton
                        label="−"
                        onClick={() => changeQty(line.product.id, -1, line.size?.size ?? null)}
                      />
                      <span className="w-5 text-center text-sm font-semibold text-stone-900">
                        {line.quantity}
                      </span>
                      <QtyButton
                        label="+"
                        disabled={cart.filter((l) => l.product.id === line.product.id).reduce((sum, l) => sum + l.quantity, 0) >= line.product.stock}
                        onClick={() => changeQty(line.product.id, 1, line.size?.size ?? null)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Checkout */}
          <div className="border-t border-stone-200/80 bg-white px-6 py-5">
            {checkoutError && (
              <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                {checkoutError}
              </p>
            )}
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-stone-500">Total</span>
              <span
                key={total}
                className={`${display.className} pos-pop text-3xl font-bold text-stone-900`}
              >
                {formatPrice(total)}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || placing}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2A1D15] py-3.5 font-semibold text-amber-50 shadow-lg shadow-amber-900/10 transition-all hover:bg-[#3b2a1e] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
            >
              {placing ? (
                "Placing order…"
              ) : (
                <>
                  Checkout
                  <span className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </>
              )}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  soldOut,
  animationDelay,
  onAdd,
}: {
  product: Product;
  soldOut: boolean;
  animationDelay: string;
  onAdd: (product: Product, size?: ProductSize | null) => void;
}) {
  const sizes = product.sizes ?? [];
  const priceLabel = sizes.length > 0
    ? `from ${formatPrice(effectivePrice(product))}`
    : formatPrice(effectivePrice(product));

  return (
    <article
      style={{ animationDelay }}
      className={`ios-rise group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200/70 bg-white p-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 ${
        soldOut
          ? "opacity-55"
          : "hover:-translate-y-1 hover:border-amber-200 hover:shadow-[0_12px_28px_rgba(120,80,40,0.14)]"
      }`}
    >
      <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-stone-100">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl opacity-70">
            ☕
          </div>
        )}
        {hasDiscount(product) && (
          <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
            -{product.discountPercent}%
          </span>
        )}
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
            <span className="rounded-full bg-stone-900/80 px-3 py-1 text-xs font-semibold text-white">
              Sold out
            </span>
          </div>
        )}
      </div>

      <span className="line-clamp-1 font-semibold text-stone-900">
        {product.name}
      </span>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-semibold text-stone-900">{priceLabel}</span>
        {hasDiscount(product) && sizes.length === 0 && (
          <span className="text-xs text-stone-400 line-through">
            {formatPrice(product.price)}
          </span>
        )}
      </div>
      <span
        className={`mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
          soldOut
            ? "bg-stone-100 text-stone-400"
            : product.stock <= 5
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {soldOut ? "Out of stock" : `${product.stock} left`}
      </span>

      {sizes.length > 0 ? (
        <div className="mt-3 grid grid-cols-1 gap-1.5">
          {sizes.map((size) => (
            <button
              key={size.size}
              type="button"
              disabled={soldOut}
              onClick={() => onAdd(product, size)}
              className="flex items-center justify-between rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-900 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{size.size}</span>
              <span>{formatPrice(effectivePrice(product, size))}</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          disabled={soldOut}
          onClick={() => onAdd(product, null)}
          className="mt-3 rounded-lg bg-[#2A1D15] px-3 py-2 text-sm font-semibold text-amber-50 transition hover:bg-[#3b2a1e] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
        >
          Add
        </button>
      )}
    </article>
  );
}

function CategoryTab({
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
      className={`rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
        active
          ? "bg-[#2A1D15] text-amber-50 shadow-sm"
          : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
      }`}
    >
      {label}
    </button>
  );
}

function QtyButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 bg-white text-base font-medium text-stone-700 transition hover:bg-stone-50 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-stone-200/70 bg-white p-3"
        >
          <div className="mb-3 aspect-square w-full animate-pulse rounded-xl bg-stone-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-stone-100" />
          <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-stone-100" />
        </div>
      ))}
    </div>
  );
}

export default function POSPage() {
  return (
    <StaffShell bleed>
      <POSScreen />
    </StaffShell>
  );
}
