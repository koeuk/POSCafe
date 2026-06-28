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
  // Capacity high-water mark (largest stock ever set). sold = totalStock - stock.
  totalStock: number;
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
  stock: number;
  // Capacity high-water mark for this size (see Product.totalStock).
  totalStock: number;
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
