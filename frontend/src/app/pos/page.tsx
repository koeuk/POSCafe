"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { effectivePrice, formatPrice, hasDiscount } from "@/lib/pricing";
import type { Category, Order, Product } from "@/lib/types";

interface CartLine {
  product: Product;
  quantity: number;
}

function POSScreen() {
  const { user, logout } = useAuth();

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
          setLoadError(err instanceof Error ? err.message : "Failed to load menu");
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
        (sum, line) => sum + effectivePrice(line.product) * line.quantity,
        0,
      ),
    [cart],
  );

  const itemCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart],
  );

  const addToCart = useCallback((product: Product) => {
    setLastOrder(null);
    setCheckoutError(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        // Don't exceed available stock.
        if (existing.quantity >= product.stock) return prev;
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const changeQty = useCallback((productId: number, delta: number) => {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.product.id !== productId) return [l];
        const next = l.quantity + delta;
        if (next <= 0) return [];
        if (next > l.product.stock) return [l];
        return [{ ...l, quantity: next }];
      }),
    );
  }, []);

  const removeLine = useCallback((productId: number) => {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }, []);

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
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <h1 className="text-xl font-bold text-gray-900">☕ POSCAFE</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            {user?.name}{" "}
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs uppercase text-gray-500">
              {user?.role}
            </span>
          </span>
          <button
            onClick={logout}
            className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Menu */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 border-b border-gray-200 bg-white px-6 py-3">
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
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {loading ? (
              <p className="text-sm text-gray-500">Loading menu…</p>
            ) : loadError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {loadError}
              </p>
            ) : visibleProducts.length === 0 ? (
              <p className="text-sm text-gray-500">No products here yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visibleProducts.map((product) => {
                  const soldOut = !product.isAvailable || product.stock <= 0;
                  return (
                    <button
                      key={product.id}
                      disabled={soldOut}
                      onClick={() => addToCart(product)}
                      className="flex flex-col items-start rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-900 hover:shadow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:shadow-sm"
                    >
                      <span className="font-medium text-gray-900">
                        {product.name}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-sm">
                        <span className="font-medium text-gray-900">
                          {formatPrice(effectivePrice(product))}
                        </span>
                        {hasDiscount(product) && (
                          <>
                            <span className="text-gray-400 line-through">
                              {formatPrice(product.price)}
                            </span>
                            <span className="rounded bg-red-100 px-1 text-xs font-semibold text-red-700">
                              -{product.discountPercent}%
                            </span>
                          </>
                        )}
                      </span>
                      <span className="mt-2 text-xs text-gray-400">
                        {soldOut ? "Sold out" : `${product.stock} in stock`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Cart */}
        <aside className="flex w-96 flex-col border-l border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              Current Order
              {itemCount > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({itemCount} item{itemCount === 1 ? "" : "s"})
                </span>
              )}
            </h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-sm text-gray-400 transition hover:text-red-500"
              >
                Clear
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {lastOrder && (
              <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                ✅ Order <strong>{lastOrder.orderNumber}</strong> placed —{" "}
                ${Number(lastOrder.total).toFixed(2)}
              </div>
            )}

            {cart.length === 0 ? (
              <p className="mt-8 text-center text-sm text-gray-400">
                Tap a product to add it to the order.
              </p>
            ) : (
              <ul className="space-y-3">
                {cart.map((line) => (
                  <li
                    key={line.product.id}
                    className="flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">
                        {line.product.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatPrice(effectivePrice(line.product))} each
                        {hasDiscount(line.product) && (
                          <span className="ml-1 text-gray-400 line-through">
                            {formatPrice(line.product.price)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <QtyButton
                        label="−"
                        onClick={() => changeQty(line.product.id, -1)}
                      />
                      <span className="w-6 text-center text-sm font-medium text-gray-900">
                        {line.quantity}
                      </span>
                      <QtyButton
                        label="+"
                        disabled={line.quantity >= line.product.stock}
                        onClick={() => changeQty(line.product.id, 1)}
                      />
                    </div>
                    <div className="w-16 text-right text-sm font-semibold text-gray-900">
                      {formatPrice(effectivePrice(line.product) * line.quantity)}
                    </div>
                    <button
                      onClick={() => removeLine(line.product.id)}
                      className="text-gray-300 transition hover:text-red-500"
                      aria-label="Remove item"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Checkout */}
          <div className="border-t border-gray-200 px-5 py-4">
            {checkoutError && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {checkoutError}
              </p>
            )}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-gray-600">Total</span>
              <span className="text-2xl font-bold text-gray-900">
                ${total.toFixed(2)}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || placing}
              className="w-full rounded-lg bg-gray-900 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {placing ? "Placing order…" : "Checkout"}
            </button>
          </div>
        </aside>
      </div>
    </div>
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
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-gray-900 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
      className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

export default function POSPage() {
  return (
    <RequireAuth>
      <POSScreen />
    </RequireAuth>
  );
}
