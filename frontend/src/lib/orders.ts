import type { TranslationKey } from "./i18n";
import { OrderStatus } from "./types";

/** Canonical label for each order status — a translation key; render with `t()`. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, TranslationKey> = {
  [OrderStatus.PENDING]: "Pending",
  [OrderStatus.PREPARING]: "Preparing",
  [OrderStatus.READY]: "Ready",
  [OrderStatus.COMPLETED]: "Completed",
  [OrderStatus.CANCELLED]: "Cancelled",
};

/** Filter tabs (All + every status) shared by the order-list views. */
export const STATUS_FILTERS: {
  label: TranslationKey;
  value: OrderStatus | "all";
}[] = [
  { label: "All", value: "all" },
  ...Object.values(OrderStatus).map((value) => ({
    label: ORDER_STATUS_LABEL[value],
    value,
  })),
];
