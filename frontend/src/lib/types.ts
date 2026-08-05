// Shared domain types, mirroring the backend contract.

export enum Role {
  ADMIN = "admin",
  CASHIER = "cashier",
}

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
  avatar?: string | null;
  // Sidebar pages a cashier may see (keys from lib/permissions).
  // null/undefined = default cashier pages. Ignored for admins.
  allowedPages?: string[] | null;
}

// Response shape from POST /auth/login and /auth/register.
export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  isActive: boolean;
}

// Note: TypeORM returns DECIMAL columns as strings (e.g. price "3.50").
export interface Product {
  id: number;
  name: string;
  description: string | null;
  // Base price; sized products price per-variant and use this as fallback.
  price: string;
  // Percentage off the price (0–100). 0 = no discount.
  discountPercent: number;
  image: string | null;
  // Additional gallery images (URLs or uploaded paths). null = none.
  gallery: string[] | null;
  isAvailable: boolean;
  stock: number;
  // Size options (S/M/L): the single source of size name, price and stock.
  // Empty/absent = the product has no sizes.
  variants?: ProductVariant[];
  categoryId: number;
  category?: Category;
}

export interface ProductVariant {
  id: number;
  productId: number;
  size: string;
  // DECIMAL-as-string, like Product.price.
  price: string;
  sortOrder: number;
  stock: number;
}

// Units sold per product (GET /products/sold, non-cancelled orders).
export interface SoldCount {
  productId: number;
  sold: number;
}

// A manual stock change (GET /products/movements, newest first).
export interface StockMovement {
  id: number;
  productId: number;
  product?: Product;
  size: string | null;
  // Signed change (+ = restock, − = correction).
  delta: number;
  stockAfter: number;
  userId: number | null;
  user?: { id: number; name: string } | null;
  createdAt: string;
}

// Master cup-size catalog (Small / Medium / Large), managed on the Stock page.
export interface Size {
  id: number;
  name: string;
  sortOrder: number;
}

// Shape returned by the public GET /menu endpoint: active categories,
// each with their available products only.
export interface MenuCategory {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  products: Product[];
}

export enum OrderStatus {
  PENDING = "pending",
  PREPARING = "preparing",
  READY = "ready",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum PaymentStatus {
  UNPAID = "unpaid",
  PAID = "paid",
  REFUNDED = "refunded",
}

export enum PaymentMethod {
  CASH = "cash",
  QR = "qr",
  CARD = "card",
}

export interface OrderItem {
  id: number;
  productId: number;
  product?: Product;
  quantity: number;
  size: string | null;
  unitPrice: string;
  subtotal: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: string;
  userId: number;
  items: OrderItem[];
  createdAt: string;
}

// Order joined with the cashier who created it (GET /orders includes `user`).
export interface OrderWithUser extends Order {
  user?: { id: number; name: string; role: Role };
}

// A recorded payment (GET /payments/order/:id, POST /payments).
// Decimal fields are strings, matching the DECIMAL-as-string note above.
export interface Payment {
  id: number;
  orderId: number;
  method: PaymentMethod;
  amount: string;
  tendered: string;
  change: string;
  // Set when an admin refunded this payment.
  refundedAt: string | null;
  refundedById: number | null;
  createdAt: string;
}

// Editable size row used by the product form and the stock manager:
// raw string inputs, parsed/validated on save.
export interface SizeRow {
  size: string;
  price: string;
  stock: string;
}
