import { notFound } from "next/navigation";
import { AdminCategoryDetail } from "@/components/admin-category-detail";
import type { Category, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getCategory(id: string): Promise<Category | null> {
  const res = await fetch(`${API_URL}/categories/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load category (${res.status})`);
  return res.json();
}

async function getProducts(id: string): Promise<Product[]> {
  const res = await fetch(`${API_URL}/products?categoryId=${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
  return res.json();
}

export default async function AdminCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [category, products] = await Promise.all([
    getCategory(id),
    getProducts(id),
  ]);

  if (!category) notFound();

  return <AdminCategoryDetail category={category} products={products} />;
}
