"use client";

import Link from "next/link";
import { Fraunces } from "next/font/google";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StaffShell } from "@/components/staff-shell";
import { ProductDetailDrawer } from "@/components/product-detail-drawer";
import {
  CheckoutExtrasDialog,
  type ExtrasLine,
} from "@/components/checkout-extras-dialog";
import { rolePathBase } from "@/lib/permissions";
import { api } from "@/lib/api";
import { useBranding } from "@/lib/branding-context";
import { useT } from "@/lib/i18n";
import {
  effectivePrice,
  formatKhr,
  formatPrice,
  hasDiscount,
  isRecipeManaged,
  recipeAvailability,
  sizeStock,
  totalStock,
} from "@/lib/pricing";
import type {
  Category,
  InventoryItem,
  Order,
  Product,
  ProductVariant,
} from "@/lib/types";
import { GLASS } from "@/lib/ui";

// Distinctive warm display serif for the brand & headings.
const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"] });

interface CartLine {
  product: Product;
  quantity: number;
  size: ProductVariant | null;
  // Preparation note ("less sugar, no ice"), sent with the order line.
  note: string;
  // Customer's-choice add-ons: inventoryItemId → amount per drink as typed
  // (in the option's unit), from the checkout dialog. "" = none.
  extras: Record<number, string>;
}

/** The recipe covering a cart line, or null when the product is counted. */
function availabilityFor(line: CartLine) {
  return recipeAvailability(line.product, line.size?.size ?? null);
}

function cartKey(productId: number, sizeName: string | null | undefined) {
  return `${productId}:${sizeName ?? ""}`;
}

function POSScreen() {
  const pathname = usePathname();
  const { khrPerUsd } = useBranding();
  const { t } = useT();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  // Supplies offered as checkout add-ons. Empty when this cashier may not
  // read the Inventory page — the recipe's own optional lines still show.
  const [supplies, setSupplies] = useState<InventoryItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  // Set when the post-checkout product refresh failed, so the stock numbers
  // on screen are known to be behind the server.
  const [stockStale, setStockStale] = useState(false);

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
        // Supplies power the checkout add-ons picker. A cashier without the
        // Inventory page gets a 403 here — the menu still loads, and the
        // dialog falls back to the recipes' own optional lines.
        try {
          const items = await api<InventoryItem[]>("/inventory");
          if (!cancelled) setSupplies(items);
        } catch {
          if (!cancelled) setSupplies([]);
        }
      } catch (err) {
        if (!cancelled) {
          // "" = no message from the server; the fallback is translated at render.
          setLoadError(err instanceof Error ? err.message : "");
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

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory !== null && p.categoryId !== activeCategory) {
        return false;
      }
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !(p.description ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [products, activeCategory, query]);

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

  const addToCart = useCallback((product: Product, size: ProductVariant | null = null) => {
    setLastOrder(null);
    setCheckoutError(null);
    setCart((prev) => {
      const sizeName = size?.size ?? null;
      // Cap by the cups actually in stock: per-size for sized products,
      // base stock otherwise.
      const cap = sizeName ? sizeStock(product, sizeName) : totalStock(product);
      const currentForLine = prev
        .filter(
          (l) => l.product.id === product.id && (l.size?.size ?? null) === sizeName,
        )
        .reduce((sum, l) => sum + l.quantity, 0);
      if (currentForLine >= cap) return prev;

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
      return [...prev, { product, quantity: 1, size, note: "", extras: {} }];
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
            const cap = sizeName
              ? sizeStock(l.product, sizeName)
              : totalStock(l.product);
            const currentForLine = prev
              .filter(
                (line) =>
                  line.product.id === productId &&
                  (line.size?.size ?? null) === sizeName,
              )
              .reduce((sum, line) => sum + line.quantity, 0);
            if (currentForLine >= cap) return [l];
          }
          return [{ ...l, quantity: next }];
        }),
      );
    },
    [],
  );

  const setNote = useCallback(
    (productId: number, sizeName: string | null, note: string) => {
      setCart((prev) =>
        prev.map((l) =>
          l.product.id === productId && (l.size?.size ?? null) === sizeName
            ? { ...l, note }
            : l,
        ),
      );
    },
    [],
  );

  const setExtra = useCallback(
    (key: string, inventoryItemId: number, amount: string) => {
      setCart((prev) =>
        prev.map((l) =>
          cartKey(l.product.id, l.size?.size) === key
            ? { ...l, extras: { ...l.extras, [inventoryItemId]: amount } }
            : l,
        ),
      );
    },
    [],
  );

  const removeExtra = useCallback((key: string, inventoryItemId: number) => {
    setCart((prev) =>
      prev.map((l) => {
        if (cartKey(l.product.id, l.size?.size) !== key) return l;
        const next = { ...l.extras };
        delete next[inventoryItemId];
        return { ...l, extras: next };
      }),
    );
  }, []);

  // Checkout pauses on an add-ons dialog when any line offers extras.
  const [choosingExtras, setChoosingExtras] = useState(false);
  const extrasLines = useMemo<ExtrasLine[]>(
    () =>
      cart
        .filter((l) => availabilityFor(l) !== null)
        .map((l) => ({
          key: cartKey(l.product.id, l.size?.size),
          title: l.size ? `${l.product.name} (${l.size.size})` : l.product.name,
          quantity: l.quantity,
          options: availabilityFor(l)?.options ?? [],
          chosen: l.extras,
        })),
    [cart],
  );

  // Nothing to ask when there are neither supplies to offer nor suggestions.
  const hasSuggestions = extrasLines.some((l) => l.options.length > 0);

  function startCheckout() {
    if (cart.length === 0 || placing) return;
    if (extrasLines.length > 0 && (supplies.length > 0 || hasSuggestions)) {
      setCheckoutError(null);
      setChoosingExtras(true);
      return;
    }
    void handleCheckout();
  }

  // Synchronous double-submit guard — see handleCheckout.
  const placingRef = useRef(false);

  const clearCart = useCallback(() => setCart([]), []);

  async function handleCheckout() {
    if (cart.length === 0) return;
    // `placing` only disables the button on the NEXT render, so two taps
    // dispatched in the same frame both get past it. Order creation has no
    // idempotency key and the backend happily creates a second order, taking
    // the stock with it — the customer pays once and the books show two
    // orders. A ref flips synchronously, so the second tap returns here.
    if (placingRef.current) return;
    placingRef.current = true;
    setPlacing(true);
    setCheckoutError(null);
    setLastOrder(null);
    try {
      const order = await api<Order>("/orders", {
        method: "POST",
        body: {
          items: cart.map((l) => {
            const extras = Object.entries(l.extras)
              .map(([id, amount]) => ({
                inventoryItemId: Number(id),
                quantity: Number(amount),
              }))
              .filter((e) => Number.isFinite(e.quantity) && e.quantity > 0);
            return {
              productId: l.product.id,
              quantity: l.quantity,
              ...(l.size ? { size: l.size.size } : {}),
              ...(l.note.trim() ? { note: l.note.trim() } : {}),
              ...(extras.length > 0 ? { extras } : {}),
            };
          }),
        },
      });
      setLastOrder(order);
      setCart([]);
      setChoosingExtras(false);
      // Refresh products so stock numbers stay accurate. The order itself is
      // already placed, so a failure here isn't fatal — but it must not pass
      // silently either: the cashier would keep building orders against
      // pre-sale stock numbers and only discover the shortfall at checkout,
      // after the customer has ordered.
      try {
        setProducts(await api<Product[]>("/products"));
        setStockStale(false);
      } catch {
        setStockStale(true);
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : t("Checkout failed"));
      setChoosingExtras(false);
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  }

  return (
    <div className="font-ios flex h-full flex-col bg-[#F5F5F6] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Menu */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Category pills */}
          <div className="flex shrink-0 flex-wrap gap-2 px-5 py-4 sm:px-7">
            <CategoryTab
              label={t("All")}
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

          {/* Search */}
          <div className="shrink-0 px-5 pb-3 sm:px-7">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
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
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Search product…")}
                aria-label={t("Search product")}
                className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-10 text-sm text-stone-900 outline-none transition focus:border-pos-button focus:ring-2 focus:ring-pos-button/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("Clear search")}
                  className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-700"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Product grid */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-7">
            {loading ? (
              <GridSkeleton />
            ) : loadError !== null ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {loadError || t("Failed to load menu")}
              </p>
            ) : visibleProducts.length === 0 ? (
              <p className="mt-10 text-center text-sm text-stone-400 dark:text-stone-500">
                {t("No products here yet.")}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {visibleProducts.map((product, i) => {
                  const soldOut =
                    !product.isAvailable || totalStock(product) <= 0;
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      soldOut={soldOut}
                      animationDelay={`${Math.min(i * 40, 400)}ms`}
                      onAdd={addToCart}
                      onView={setViewProduct}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Cart */}
        <aside className="flex w-full shrink-0 flex-col border-t border-stone-200/80 bg-white dark:border-stone-800 dark:bg-stone-900 lg:w-[26rem] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between px-6 pb-3 pt-5">
            <h2 className={`${display.className} text-lg font-semibold`}>
              {t("Current Order")}
            </h2>
            <div className="flex items-center gap-3">
              {itemCount > 0 && (
                <span
                  key={itemCount}
                  className="pos-pop rounded-full bg-pos-button px-2.5 py-0.5 text-xs font-semibold text-pos-button-fg"
                >
                  {t(itemCount === 1 ? "{count} item" : "{count} items", {
                    count: itemCount,
                  })}
                </span>
              )}
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-sm text-stone-400 transition hover:text-red-500 dark:text-stone-500"
                >
                  {t("Clear")}
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            {stockStale && (
              <div className="mx-2 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
                {t(
                  "Stock numbers may be out of date — the menu couldn't be refreshed. Reload the page before relying on them.",
                )}
              </div>
            )}
            {lastOrder && (
              <div className="pos-drop mx-2 mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[11px] text-white">
                    ✓
                  </span>
                  {t("Order {number} placed", { number: lastOrder.orderNumber })}
                </div>
                <div className="mt-1 flex items-center justify-between pl-7">
                  <span>{formatPrice(lastOrder.total)}</span>
                  <div className="flex gap-3">
                    <Link
                      href={`/pay?orderId=${lastOrder.id}`}
                      className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
                    >
                      {t("Pay")}
                    </Link>
                    <Link
                      href={`${rolePathBase(pathname)}/orders`}
                      className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
                    >
                      {t("View")}
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="mt-16 flex flex-col items-center px-6 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-3xl dark:bg-amber-500/15">
                  🧾
                </div>
                <p className="mt-4 font-medium text-stone-500 dark:text-stone-400">
                  {t("Your order is empty")}
                </p>
                <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
                  {t("Tap a product to add it here.")}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {cart.map((line) => (
                  <li
                    key={cartKey(line.product.id, line.size?.size)}
                    className="pos-line-in flex items-center gap-3 rounded-xl border border-stone-100 bg-white px-3 py-2.5 transition hover:border-stone-200 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-amber-50 to-stone-100 text-xl dark:from-amber-500/15 dark:to-stone-800">
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
                      <p className="truncate font-medium text-stone-900 dark:text-stone-100">
                        {line.product.name}
                        {line.size && (
                          <span className="ml-1 text-xs font-normal text-stone-400 dark:text-stone-500">
                            {line.size.size}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        {formatPrice(effectivePrice(line.product, line.size))}
                        <span className="ml-1.5 font-medium text-stone-900 dark:text-stone-100">
                          ={" "}
                          {formatPrice(
                            effectivePrice(line.product, line.size) * line.quantity,
                          )}
                        </span>
                      </p>
                      <input
                        type="text"
                        value={line.note}
                        onChange={(e) =>
                          setNote(
                            line.product.id,
                            line.size?.size ?? null,
                            e.target.value,
                          )
                        }
                        maxLength={255}
                        placeholder={t("Note — e.g. less sugar")}
                        className="mt-1 w-full rounded-md border border-transparent bg-stone-50 px-2 py-1 text-xs text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-300 focus:bg-white dark:bg-stone-800 dark:text-stone-300 dark:placeholder:text-stone-500 dark:focus:border-stone-600 dark:focus:bg-stone-900"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <QtyButton
                        label="−"
                        onClick={() => changeQty(line.product.id, -1, line.size?.size ?? null)}
                      />
                      <span className="w-5 text-center text-sm font-semibold text-stone-900 dark:text-stone-100">
                        {line.quantity}
                      </span>
                      <QtyButton
                        label="+"
                        disabled={
                          cart
                            .filter(
                              (l) =>
                                l.product.id === line.product.id &&
                                (l.size?.size ?? null) === (line.size?.size ?? null),
                            )
                            .reduce((sum, l) => sum + l.quantity, 0) >=
                          (line.size
                            ? sizeStock(line.product, line.size.size)
                            : totalStock(line.product))
                        }
                        onClick={() => changeQty(line.product.id, 1, line.size?.size ?? null)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Checkout */}
          <div className="border-t border-stone-200/80 bg-white px-6 py-5 dark:border-stone-800 dark:bg-stone-900">
            {checkoutError && (
              <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {checkoutError}
              </p>
            )}
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-stone-500 dark:text-stone-400">{t("Total")}</span>
              <span className="text-right">
                <span
                  key={total}
                  className={`${display.className} pos-pop block text-3xl font-bold text-stone-900 dark:text-stone-100`}
                >
                  {formatPrice(total)}
                </span>
                <span className="text-sm font-medium text-stone-400 dark:text-stone-500">
                  ≈ {formatKhr(total, khrPerUsd)}
                </span>
              </span>
            </div>
            <button
              onClick={startCheckout}
              disabled={cart.length === 0 || placing}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-pos-button py-3.5 font-semibold text-pos-button-fg shadow-lg shadow-amber-900/10 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
            >
              {placing ? (
                t("Placing order…")
              ) : (
                <>
                  {t("Checkout")}
                  <span className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      <ProductDetailDrawer
        product={viewProduct}
        onClose={() => setViewProduct(null)}
        onAdd={addToCart}
      />

      {choosingExtras && (
        <CheckoutExtrasDialog
          lines={extrasLines}
          supplies={supplies}
          busy={placing}
          onChange={setExtra}
          onRemove={removeExtra}
          onCancel={() => setChoosingExtras(false)}
          onConfirm={() => void handleCheckout()}
        />
      )}
    </div>
  );
}

function ProductCard({
  product,
  soldOut,
  animationDelay,
  onAdd,
  onView,
}: {
  product: Product;
  soldOut: boolean;
  animationDelay: string;
  onAdd: (product: Product, size?: ProductVariant | null) => void;
  onView: (product: Product) => void;
}) {
  const { t } = useT();
  const sizes = product.variants ?? [];
  const stock = totalStock(product);
  const madeToOrder = isRecipeManaged(product);
  const priceLabel = sizes.length > 0
    ? t("from {price}", { price: formatPrice(effectivePrice(product)) })
    : formatPrice(effectivePrice(product));

  return (
    <article
      style={{ animationDelay }}
      className={`ios-rise relative flex flex-col overflow-hidden rounded-2xl ${GLASS} p-3 text-left transition-shadow duration-200 ${
        soldOut
          ? "opacity-55"
          : "hover:shadow-[0_12px_28px_rgba(120,80,40,0.14)]"
      }`}
    >
      <div className="relative mb-3 aspect-[1/1] w-full shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-stone-100 dark:from-amber-500/15 dark:to-stone-800">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover"
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
        <button
          type="button"
          onClick={() => onView(product)}
          aria-label={t("View {name} details", { name: product.name })}
          title={t("View details")}
          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-stone-700 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white hover:text-stone-900 dark:bg-stone-900/80 dark:text-stone-300 dark:ring-white/10 dark:hover:bg-stone-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] dark:bg-stone-950/60">
            <span className="rounded-full bg-stone-900/80 px-3 py-1 text-xs font-semibold text-white">
              {t("Sold out")}
            </span>
          </div>
        )}
      </div>

      <span className="line-clamp-1 font-semibold text-stone-900 dark:text-stone-100">
        {product.name}
      </span>
      {/* Wraps rather than truncating: the price and the availability badge are
          both longer in Khmer than in English and must stay readable. */}
      <div className="mt-1 flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="whitespace-nowrap font-semibold text-stone-900 dark:text-stone-100">
            {priceLabel}
          </span>
          {hasDiscount(product) && sizes.length === 0 && (
            <span className="shrink-0 text-xs text-stone-400 line-through dark:text-stone-500">
              {formatPrice(product.price)}
            </span>
          )}
        </div>
        <span
          className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            soldOut
              ? "bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500"
              : stock <= 5
                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          }`}
        >
          {soldOut
            ? madeToOrder
              ? t("Out of ingredients")
              : t("Out of stock")
            : madeToOrder
              ? t("{n} can be made", { n: stock })
              : t("{n} left", { n: stock })}
        </span>
      </div>

      <div className="mt-auto pt-3">
        {sizes.length > 0 ? (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${sizes.length}, minmax(0, 1fr))` }}
          >
            {sizes.map((size) => {
              const sizeOut = sizeStock(product, size.size) <= 0;
              return (
                <button
                  key={size.size}
                  type="button"
                  disabled={sizeOut}
                  onClick={() => onAdd(product, size)}
                  className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-stone-200 px-1 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-900 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stone-700 dark:text-stone-300 dark:hover:border-stone-500 dark:hover:bg-stone-800"
                >
                  <span className="max-w-full truncate leading-none">
                    {size.size}
                    {sizeOut && (
                      <span className="ml-0.5 text-[10px] text-red-500">{t("out")}</span>
                    )}
                  </span>
                  <span className="tabular-nums text-[10px] leading-none text-stone-500 dark:text-stone-400">
                    {formatPrice(effectivePrice(product, size))}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <button
            type="button"
            disabled={soldOut}
            onClick={() => onAdd(product, null)}
            className="w-full rounded-lg bg-pos-button px-3 py-2 text-sm font-semibold text-pos-button-fg transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
          >
            {t("Add")}
          </button>
        )}
      </div>
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
          ? "bg-pos-button text-pos-button-fg shadow-sm"
          : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400 dark:hover:bg-stone-800"
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
      className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 bg-white text-base font-medium text-stone-700 transition hover:bg-stone-50 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
    >
      {label}
    </button>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900"
        >
          <div className="mb-3 aspect-square w-full animate-pulse rounded-xl bg-stone-100 dark:bg-stone-800" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-stone-100 dark:bg-stone-800" />
          <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-stone-100 dark:bg-stone-800" />
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
