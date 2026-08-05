import type { Product, ProductVariant } from "./types";

type PriceOption = ProductVariant | string | number | null | undefined;

/** The product's size options, in display order (empty = no sizes). */
export function sizeOptions(product: Product): ProductVariant[] {
  return product.variants ?? [];
}

function resolveBasePrice(product: Product, option?: PriceOption): number {
  if (typeof option === "number") return option;
  if (typeof option === "string") {
    const match = product.variants?.find((v) => v.size === option);
    if (match) return Number(match.price);
  } else if (option && typeof option === "object") {
    return Number(option.price);
  }

  if (product.variants && product.variants.length > 0) {
    return Math.min(...product.variants.map((v) => Number(v.price)));
  }

  return Number(product.price);
}

/**
 * The effective unit price after the product's discount, rounded to cents.
 * Mirrors the backend calculation in orders.service.ts so the cart total
 * shown to the cashier matches what the server actually charges.
 */
export function effectivePrice(product: Product, option?: PriceOption): number {
  const base = resolveBasePrice(product, option);
  const discount = Math.min(Math.max(product.discountPercent ?? 0, 0), 100);
  return Math.round(base * (1 - discount / 100) * 100) / 100;
}

/** Whether the product has an active discount. */
export function hasDiscount(product: Product): boolean {
  return (product.discountPercent ?? 0) > 0;
}

/** Whether the product requires a size choice at checkout. */
export function hasSizes(product: Product): boolean {
  return Boolean(product.variants && product.variants.length > 0);
}

/**
 * Units in stock for one size of a sized product (0 if no variant row yet).
 */
export function sizeStock(product: Product, size: string): number {
  return product.variants?.find((variant) => variant.size === size)?.stock ?? 0;
}

/**
 * Total units available. Sized products sum their per-size variants;
 * unsized products use the base `stock`.
 */
export function totalStock(product: Product): number {
  if (product.variants && product.variants.length > 0) {
    return product.variants.reduce((sum, v) => sum + v.stock, 0);
  }
  return product.stock;
}

/**
 * Capacity (high-water mark) across all sizes, or the product's for unsized
 * items. Paired with totalStock() to derive how many units have sold.
 */
export function stockCapacity(product: Product): number {
  if (product.variants && product.variants.length > 0) {
    return product.variants.reduce(
      (sum, v) => sum + (v.totalStock ?? v.stock ?? 0),
      0,
    );
  }
  return product.totalStock ?? product.stock;
}

/** Units sold so far = capacity − units still in stock (never negative). */
export function soldCount(product: Product): number {
  return Math.max(0, stockCapacity(product) - totalStock(product));
}

/** Format a numeric/string amount as USD (e.g. 3.5 -> "$3.50"). */
export function formatPrice(value: number | string): string {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : String(value);
}
