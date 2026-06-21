import { AdminCategoryView } from "@/components/admin-category-view";

export default async function AdminCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminCategoryView id={id} />;
}
