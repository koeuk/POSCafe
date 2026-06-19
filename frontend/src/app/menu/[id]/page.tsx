import Link from "next/link";
import { notFound } from "next/navigation";
import { effectivePrice, formatPrice, hasDiscount, hasSizes } from "@/lib/pricing";
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
      <div className="mx-auto max-w-5xl lg:px-6 lg:py-10">
        <div className="overflow-hidden bg-white shadow-sm lg:grid lg:grid-cols-2 lg:rounded-3xl">
          {/* Image — full-width on phones, sized panel on laptop */}
          <div className="bg-stone-50">
          <div className="relative aspect-square w-full bg-stone-200 lg:aspect-[4/3]">
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
              className="group absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-stone-700 shadow-md ring-1 ring-black/5 backdrop-blur transition hover:w-auto hover:gap-1.5 hover:bg-white hover:px-4 hover:text-stone-900 active:scale-95"
              aria-label="Back to menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 shrink-0 transition-transform group-hover:-translate-x-0.5"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span className="hidden text-sm font-medium group-hover:inline">
                Back
              </span>
            </Link>

            {hasDiscount(product) && (
              <span className="absolute right-4 top-4 rounded-full bg-red-500 px-3 py-1 text-sm font-semibold text-white shadow">
                -{product.discountPercent}% OFF
              </span>
            )}
          </div>

          {product.gallery && product.gallery.length > 0 && (
            <div className="flex gap-2 overflow-x-auto p-3">
              {product.gallery.map((url, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt={`${product.name} ${index + 1}`}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-stone-200"
                />
              ))}
            </div>
          )}
          </div>

          {/* Details */}
          <div className="px-5 pb-16 pt-6 lg:flex lg:flex-col lg:p-10">
            {product.category && (
              <span className="inline-block w-fit rounded-full bg-amber-200 px-3 py-1 text-xs font-medium text-amber-900">
                {product.category.name}
              </span>
            )}

            <h1 className="mt-3 text-2xl font-extrabold text-stone-900 lg:text-3xl">
              {product.name}
            </h1>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-2xl font-bold text-red-600">
                {hasSizes(product) ? "from " : ""}
                {formatPrice(effectivePrice(product))}
              </span>
              {hasDiscount(product) && !hasSizes(product) && (
                <span className="text-base text-stone-400 line-through">
                  {formatPrice(product.price)}
                </span>
              )}
            </div>

            {hasSizes(product) && product.sizes && (
              <div className="mt-6">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Sizes
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {product.sizes.map((size) => (
                    <div
                      key={size.size}
                      className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-stone-700">{size.size}</span>
                      <span className="font-semibold text-stone-900">
                        {formatPrice(effectivePrice(product, size))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              className="mt-10 flex w-full items-center justify-center rounded-xl bg-stone-900 py-3 font-medium text-white transition hover:bg-stone-800 lg:mt-auto"
            >
              ← Back to menu
            </Link>

            <p className="mt-4 text-center text-xs text-stone-400">
              Ask our staff to place your order
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
