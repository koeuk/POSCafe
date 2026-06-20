import { Suspense } from "react";
import { AdminProductManagement } from "@/components/admin-product-management";

export default function ProductsPage() {
  return (
    <Suspense>
      <AdminProductManagement view="products" />
    </Suspense>
  );
}
