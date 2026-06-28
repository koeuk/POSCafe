import { notFound } from "next/navigation";
import { AdminProductDetail } from "@/components/admin-product-detail";
import { RequireAuth } from "@/components/require-auth";
import { Role, type Product } from "@/lib/types";

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
    <RequireAuth role={Role.ADMIN}>
      <AdminProductDetail product={product} />
    </RequireAuth>
  );
}
