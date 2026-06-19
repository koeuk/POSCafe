import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product-gallery";
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
          {/* Image slider — full-width on phones, sized panel on laptop */}
          <ProductGallery
            name={product.name}
            mainImage={product.image}
            gallery={product.gallery ?? []}
            discountPercent={hasDiscount(product) ? product.discountPercent : 0}
          />

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

            <p className="mt-10 text-center text-xs text-stone-400 lg:mt-auto">
              Ask our staff to place your order
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
