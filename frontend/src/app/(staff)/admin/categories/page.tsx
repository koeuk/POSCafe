import { Suspense } from "react";
import { AdminProductManagement } from "@/components/admin-product-management";

export default function CategoriesPage() {
  return (
    <Suspense>
      <AdminProductManagement view="categories" />
    </Suspense>
  );
}
