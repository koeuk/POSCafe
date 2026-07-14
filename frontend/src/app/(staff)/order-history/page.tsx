"use client";

import { StaffShell } from "@/components/staff-shell";
import { OrderHistoryView } from "@/components/order-history-view";

export default function OrderHistoryPage() {
  return (
    <StaffShell>
      <OrderHistoryView />
    </StaffShell>
  );
}
