import Link from "next/link";
import { effectivePrice, formatPrice, hasDiscount, hasSizes } from "@/lib/pricing";
import type { Product } from "@/lib/types";

export function AdminProductDetail({ product }: { product: Product }) {
  const status = product.isAvailable ? "Visible on customer menu" : "Hidden from customer menu";

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/70 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div>
          <p className="text-sm font-medium text-stone-400">Menu Preview</p>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            {product.name}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Admin product detail for price, stock, visibility, and discount review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/menu"
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
          >
            Back to menu
          </Link>
          <Link
            href="/admin/products"
            className="rounded-lg bg-[#2A1D15] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3A2A20]"
          >
            Manage products
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <section className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="aspect-square bg-stone-100">
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-7xl">
                ☕
              </div>
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
        </section>

        <section className="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {product.category && (
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                  {product.category.name}
                </span>
              )}
              <div className="mt-4 flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-bold tracking-tight text-stone-900">
                  {hasSizes(product) ? "from " : ""}
                  {formatPrice(effectivePrice(product))}
                </span>
                {hasDiscount(product) && !hasSizes(product) && (
                  <span className="text-sm text-stone-400 line-through">
                    {formatPrice(product.price)}
                  </span>
                )}
              </div>
            </div>
            {hasDiscount(product) && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-600">
                {product.discountPercent}% discount
              </span>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Info label="Stock" value={String(product.stock)} />
            <Info label="Visibility" value={status} />
            <Info label="Base price" value={formatPrice(product.price)} />
          </div>

          {hasSizes(product) && product.sizes && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
                Sizes
              </h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {product.sizes.map((size) => (
                  <div
                    key={size.size}
                    className="flex items-center justify-between rounded-xl border border-stone-200/70 bg-stone-50 px-3 py-2 text-sm"
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
            <div className="mt-6 border-t border-stone-100 pt-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
                Description
              </h2>
              <p className="mt-2 leading-relaxed text-stone-700">
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
    <div className="rounded-xl border border-stone-200/70 bg-stone-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}
