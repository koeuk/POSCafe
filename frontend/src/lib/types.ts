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
  image: string | null;
  isAvailable: boolean;
  stock: number;
  categoryId: number;
  category?: Category;
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

export interface OrderItem {
  id: number;
  productId: number;
  product?: Product;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  total: string;
  userId: number;
  items: OrderItem[];
  createdAt: string;
}

// POST /orders payload.
export interface CreateOrderPayload {
  items: { productId: number; quantity: number }[];
}
