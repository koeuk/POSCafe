import Link from "next/link";
import { notFound } from "next/navigation";
import { effectivePrice, formatPrice, hasDiscount } from "@/lib/pricing";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getProduct(id: string): Promise<Product | null> {
  const res = await fetch(`${API_URL}/menu/product/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load product (${res.status})`);
  return res.json();
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <main className="min-h-screen bg-amber-50">
      {/* Image with back button overlay */}
      <div className="relative aspect-square w-full bg-stone-200 sm:aspect-video">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-7xl">
            ☕
          </div>
        )}

        <Link
          href="/menu"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-stone-800 shadow backdrop-blur transition hover:bg-white"
          aria-label="Back to menu"
        >
          ←
        </Link>

        {hasDiscount(product) && (
          <span className="absolute right-4 top-4 rounded-full bg-red-500 px-3 py-1 text-sm font-semibold text-white shadow">
            -{product.discountPercent}% OFF
          </span>
        )}
      </div>

      {/* Details */}
      <div className="mx-auto -mt-6 max-w-2xl rounded-t-3xl bg-amber-50 px-5 pb-16 pt-6">
        {product.category && (
          <span className="inline-block rounded-full bg-amber-200 px-3 py-1 text-xs font-medium text-amber-900">
            {product.category.name}
          </span>
        )}

        <h1 className="mt-3 text-2xl font-extrabold text-stone-900">
          {product.name}
        </h1>

        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl font-bold text-red-600">
            {formatPrice(effectivePrice(product))}
          </span>
          {hasDiscount(product) && (
            <span className="text-base text-stone-400 line-through">
              {formatPrice(product.price)}
            </span>
          )}
        </div>

        {product.description && (
          <div className="mt-6">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Description
            </h2>
            <p className="leading-relaxed text-stone-700">
              {product.description}
            </p>
          </div>
        )}

        <Link
          href="/menu"
          className="mt-10 flex w-full items-center justify-center rounded-xl bg-stone-900 py-3 font-medium text-white transition hover:bg-stone-800"
        >
          ← Back to menu
        </Link>

        <p className="mt-4 text-center text-xs text-stone-400">
          Ask our staff to place your order
        </p>
      </div>
    </main>
  );
}
