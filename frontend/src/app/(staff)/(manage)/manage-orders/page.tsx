"use client";

import { RequireAuth } from "@/components/require-auth";
import { OrderHistoryView } from "@/components/order-history-view";
import { Role } from "@/lib/types";

export default function AdminOrdersPage() {
  return (
    <RequireAuth role={Role.ADMIN}>
      <OrderHistoryView />
    </RequireAuth>
  );
}
