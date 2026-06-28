"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatPrice } from "@/lib/pricing";
import type { Category, Product } from "@/lib/types";
import { GLASS } from "@/lib/ui";

export function AdminCategoryDetail({
  category,
  products,
}: {
  category: Category;
  products: Product[];
}) {
  const availableCount = products.filter((product) => product.isAvailable).length;
  const pathname = usePathname();
  // Stay in the current role's namespace (admin: clean, cashier: /cashier/*).
  const base = pathname.startsWith("/cashier") ? "/cashier" : "";

  return (
    <main className="mx-auto max-w-7xl">
      <header className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-5 ${GLASS}`}>
        <div>
          <p className="text-sm font-medium text-stone-400 dark:text-stone-500">Menu Category</p>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            {category.name}
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {category.description || "No category description has been added."}
          </p>
        </div>
        <Link
          href={`${base}/categories`}
          className="rounded-lg bg-[#2A1D15] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3A2A20]"
        >
          Categories
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className={`overflow-hidden rounded-2xl ${GLASS}`}>
          <div className="aspect-video bg-stone-100 dark:bg-stone-800 lg:aspect-square">
            {category.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={category.image}
                alt={category.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-6xl">
                ☕
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 p-5">
            <Info label="Products" value={String(products.length)} />
            <Info label="Visible" value={String(availableCount)} />
            <Info
              label="Status"
              value={category.isActive ? "Active" : "Hidden"}
              className="col-span-2"
            />
          </div>
        </section>

        <section className={`overflow-hidden rounded-2xl ${GLASS}`}>
          <div className="border-b border-stone-100 dark:border-stone-800 px-5 py-4">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Products in this category
            </h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Review the products that will appear under this menu category.
            </p>
          </div>

          {products.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-stone-400 dark:text-stone-500">
              No products in this category yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 dark:text-stone-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {products.map((product) => (
                    <tr key={product.id} className="text-stone-800 transition-colors hover:bg-stone-50/70 dark:text-stone-200 dark:hover:bg-stone-800/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-900 dark:text-stone-100">{product.name}</p>
                        <p className="mt-0.5 max-w-md truncate text-xs text-stone-400 dark:text-stone-500">
                          {product.description || "No description"}
                        </p>
                      </td>
                      <td className="px-4 py-3">{productPriceLabel(product)}</td>
                      <td className="px-4 py-3">{product.stock}</td>
                      <td className="px-4 py-3">
                        {product.isAvailable ? (
                          <span className="rounded-full bg-green-50 dark:bg-green-500/15 px-2 py-0.5 text-xs text-green-700 dark:text-green-300">
                            Available
                          </span>
                        ) : (
                          <span className="rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-xs text-stone-500 dark:text-stone-400">
                            Hidden
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`${base}/products/${product.id}`}
                          className="rounded-lg border border-stone-200 dark:border-stone-800 px-3 py-1.5 text-sm font-medium text-stone-600 dark:text-stone-400 transition hover:bg-stone-50 dark:hover:bg-stone-800"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-stone-200/70 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 px-4 py-3 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-stone-900 dark:text-stone-100">{value}</p>
    </div>
  );
}

function productPriceLabel(product: Product): string {
  if (product.sizes && product.sizes.length > 0) {
    const min = Math.min(...product.sizes.map((size) => Number(size.price)));
    return `from ${formatPrice(min)}`;
  }
  return formatPrice(product.price);
}
