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
}

// Response shape from POST /auth/login and /auth/register.
export interface AuthResponse {
  accessToken: string;
  user: User;
}

// GET /auth/me returns the JWT payload (no name).
export interface AuthUser {
  id: number;
  username: string;
  role: Role;
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
  price: string;
  // Optional size options (S/M/L) with their own prices. null = no sizes.
  sizes: ProductSize[] | null;
  // Percentage off the price (0–100). 0 = no discount.
  discountPercent: number;
  image: string | null;
  // Additional gallery images (URLs or uploaded paths). null = none.
  gallery: string[] | null;
  isAvailable: boolean;
  stock: number;
  // Per-size stock rows (source of truth for sized products' stock).
  variants?: ProductVariant[];
  categoryId: number;
  category?: Category;
}

export interface ProductSize {
  size: string;
  price: number;
  // Cups of this size in stock (optional; mirrored to a ProductVariant row).
  stock?: number;
}

export interface ProductVariant {
  id: number;
  productId: number;
  size: string;
  price: string;
  stock: number;
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

export enum OrderType {
  DINE_IN = "dine_in",
  TAKEAWAY = "takeaway",
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
  orderType: OrderType;
  total: string;
  userId: number;
  items: OrderItem[];
  createdAt: string;
}

// Cashier "today" snapshot from GET /orders/today-summary.
export interface TodaySummary {
  orders: number;
  items: number;
  revenue: number;
  cupsBySize: Record<string, number>;
}

// POST /orders payload.
export interface CreateOrderPayload {
  orderType?: OrderType;
  items: { productId: number; quantity: number; size?: string }[];
}
