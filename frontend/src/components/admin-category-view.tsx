"use client";

import { useEffect, useState } from "react";
import { AdminCategoryDetail } from "@/components/admin-category-detail";
import { api } from "@/lib/api";
import { type Category, type Product } from "@/lib/types";
import { GLASS } from "@/lib/ui";

function CategoryView({ id }: { id: string }) {
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cat, prods] = await Promise.all([
          api<Category>(`/categories/${id}`),
          api<Product[]>(`/products?categoryId=${id}`),
        ]);
        if (!cancelled) {
          setCategory(cat);
          setProducts(prods);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load category",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl">
        <div className={`h-32 animate-pulse rounded-2xl ${GLASS}`} />
        <div className={`mt-6 h-96 animate-pulse rounded-2xl ${GLASS}`} />
      </main>
    );
  }

  if (error || !category) {
    return (
      <main className="mx-auto max-w-7xl">
        <div className={`rounded-2xl p-6 ${GLASS}`}>
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error ?? "Category not found."}
          </p>
        </div>
      </main>
    );
  }

  return <AdminCategoryDetail category={category} products={products} />;
}

export function AdminCategoryView({ id }: { id: string }) {
  return <CategoryView id={id} />;
}
