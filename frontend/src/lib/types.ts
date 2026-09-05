// Shared domain types, mirroring the backend contract.

export enum Role {
  ADMIN = "admin",
  CASHIER = "cashier",
}

export interface User {
  id: number;
  name: string;
  username: string;
  // Recovery address for the forgot-password code. null = no self-service
  // reset for this account.
  email?: string | null;
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

export type StockMode = "count" | "recipe";

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
  // One rule per product: 'count' = `stock` is the units on hand (whatever
  // the size); 'recipe' = made to order from consumables, `stock` is 0.
  stockMode: StockMode;
  stock: number;
  // Size options (S/M/L): size name + price. Sizes never carry stock.
  // Empty/absent = the product has no sizes.
  variants?: ProductVariant[];
  // 'recipe' products only: servings per size (null size = every size).
  // Read through recipeAvailability()/sizeStock()/totalStock() in pricing.ts.
  recipes?: RecipeAvailability[];
  // Set once a product with sales history was deleted (archived): such
  // products never appear in catalog lists, only inside past orders.
  archivedAt?: string | null;
  categoryId: number;
  category?: Category;
}

export interface RecipeAvailability {
  size: string | null;
  servings: number;
}

export interface ProductVariant {
  id: number;
  productId: number;
  size: string;
  // DECIMAL-as-string, like Product.price.
  price: string;
  sortOrder: number;
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
  // Signed change (+ = restock, − = correction).
  delta: number;
  stockAfter: number;
  userId: number | null;
  user?: { id: number; name: string } | null;
  createdAt: string;
}

// Raw materials, packaging supplies (cups, lids, straws) & ingredients
export interface InventoryItem {
  id: number;
  name: string;
  category: string; // 'Raw Materials' | 'Packaging' | 'Operating Supplies' | custom
  unit: string; // 'pcs', 'g', 'ml', 'kg', 'L'
  stockQuantity: string; // DECIMAL-as-string
  minThreshold: string; // DECIMAL-as-string
  costPerUnit: string; // DECIMAL-as-string
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryMovement {
  id: number;
  inventoryItemId: number;
  inventoryItem?: InventoryItem;
  delta: string;
  stockAfter: string;
  reason: string;
  orderId?: number | null;
  userId?: number | null;
  user?: { id: number; name: string } | null;
  createdAt: string;
}

export interface RecipeItem {
  id: number;
  recipeId: number;
  inventoryItemId: number;
  inventoryItem?: InventoryItem;
  quantity: string; // DECIMAL-as-string
}

export interface Recipe {
  id: number;
  productId: number;
  product?: Product;
  size: string | null;
  items: RecipeItem[];
  createdAt?: string;
  updatedAt?: string;
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
  // Preparation note from the cashier ("less sugar, no ice").
  note: string | null;
  // What the sale consumed: recipe ingredients or the product's stock count.
  stockSource?: "recipe" | "stock";
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

// Bakong/KHQR configuration (GET /settings/payment, admin only).
export interface PaymentConfig {
  bakongAccountId: string | null;
  bakongMerchantName: string | null;
  bakongMerchantCity: string | null;
  // true = pay screen embeds the amount and the code expires; false = one
  // reusable code and the customer types the amount.
  khqrDynamic: boolean;
}

// A generated KHQR for one order (GET /payments/khqr/:orderId).
export interface Khqr {
  // The EMVCo/KHQR string to render as a QR code.
  qr: string;
  md5: string;
  // The order total. Embedded in the code only when `dynamic` is true.
  amount: number;
  currency: "USD";
  merchantName: string;
  // Whether the amount is baked in (else the customer types it).
  dynamic: boolean;
  // Epoch ms after which the code stops being accepted; null when static.
  expiresAt: number | null;
}

// The shop's reusable KHQR (GET /payments/khqr/static): no amount, no expiry.
export interface StaticKhqr {
  qr: string;
  md5: string;
  merchantName: string;
  merchantCity: string;
}

// Editable size row used by the product form: raw string inputs,
// parsed/validated on save.
export interface SizeRow {
  size: string;
  price: string;
}
