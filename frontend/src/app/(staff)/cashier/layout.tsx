import type { ReactNode } from "react";

// Pass-through for the /cashier/* segment. The shell differs per page:
//  - management pages live in (manage) and get a padded StaffShell there;
//  - pos/orders/order-history re-export top-level pages that wrap their own
//    shell (the POS is full-bleed, so it must not be padded here).
export default function CashierLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
