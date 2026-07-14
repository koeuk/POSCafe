import { OrderStatus } from "./types";

/** Canonical human-readable label for each order status. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "Pending",
  [OrderStatus.PREPARING]: "Preparing",
  [OrderStatus.READY]: "Ready",
  [OrderStatus.COMPLETED]: "Completed",
  [OrderStatus.CANCELLED]: "Cancelled",
};

/** Filter tabs (All + every status) shared by the order-list views. */
export const STATUS_FILTERS: { label: string; value: OrderStatus | "all" }[] = [
  { label: "All", value: "all" },
  ...Object.values(OrderStatus).map((value) => ({
    label: ORDER_STATUS_LABEL[value],
    value,
  })),
];
