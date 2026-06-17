# ☕ POSCAFE — Coffee Shop POS System Plan

A full-stack Point-of-Sale system for a coffee shop. Cashiers take orders, admins
manage the menu and view reports, and the kitchen sees orders update in real time.

---

## 1. Tech Stack

| Part      | Technology                          |
| --------- | ----------------------------------- |
| Backend   | NestJS (TypeScript)                 |
| Frontend  | Next.js (React, App Router)         |
| Database  | MySQL                               |
| ORM       | TypeORM                             |
| Auth      | JWT (Passport)                      |
| Real-time | Socket.IO                           |
| Hashing   | bcrypt                              |

**Current state:** Backend is scaffolded with all dependencies installed (TypeORM,
mysql2, JWT, Passport, bcrypt, Socket.IO). `.env` is configured for MySQL db `poscafe`
on `localhost:3306`, JWT secret, app on port `3001`. Frontend not yet created.

---

## 2. System Flow

```
[ USER (Cashier / Admin) ]
          ↓
[ FRONTEND (Next.js UI) ]
          ↓ API request (REST + Socket.IO)
[ BACKEND (NestJS API) ]
          ↓
[ MySQL DATABASE ]
          ↓
Response → Frontend → User sees result
```

### Order flow (step by step)
1. Cashier logs in (frontend → `POST /auth/login`)
2. Backend verifies user, returns JWT
3. Cashier browses products, adds to cart (frontend state)
4. Cashier clicks **Checkout** → `POST /orders`
5. Backend saves order + items to MySQL, calculates total, sets status
6. Backend emits a Socket.IO event (`order.created`)
7. Kitchen / Admin screen updates instantly
8. Payment recorded → order marked **completed**

---

## 3. Database Schema (MySQL)

| Table          | Key fields                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| `users`        | id, name, username (unique), password (hashed), role, createdAt, updatedAt |
| `categories`   | id, name, createdAt                                                        |
| `products`     | id, name, price, image, isAvailable, categoryId (FK), createdAt            |
| `orders`       | id, orderNumber, total, status, cashierId (FK → users), createdAt          |
| `order_items`  | id, orderId (FK), productId (FK), quantity, unitPrice, subtotal            |
| `payments`     | id, orderId (FK), method (cash/qr/card), amount, paidAt                    |

**Relationships**
- `category` 1 — n `products`
- `order` 1 — n `order_items`
- `product` 1 — n `order_items`
- `user (cashier)` 1 — n `orders`
- `order` 1 — 1 `payment`

**Enums**
- `role`: `admin` | `cashier`
- `order.status`: `pending` | `preparing` | `ready` | `completed` | `cancelled`
- `payment.method`: `cash` | `qr` | `card`

---

## 4. Backend (NestJS) — Modules & Endpoints

All routes protected by a global JWT guard except those marked `@Public()`.
Admin-only routes guarded by a roles guard (`@Roles('admin')`).

### 🔐 Auth Module
| Method | Route            | Access  | Purpose                       |
| ------ | ---------------- | ------- | ----------------------------- |
| POST   | `/auth/register` | Public* | Create user (admin bootstrap) |
| POST   | `/auth/login`    | Public  | Login, returns JWT            |
| GET    | `/auth/me`       | Auth    | Current user profile          |

*`register` should be admin-only once the first admin exists.

### 👤 Users Module
| Method | Route        | Access | Purpose         |
| ------ | ------------ | ------ | --------------- |
| GET    | `/users`     | Admin  | List users      |
| POST   | `/users`     | Admin  | Create cashier  |
| PATCH  | `/users/:id` | Admin  | Update user     |
| DELETE | `/users/:id` | Admin  | Remove user     |

### 📂 Categories Module
`GET /categories`, `POST`, `PATCH /:id`, `DELETE /:id` (writes = admin)

### 🍔 Products Module
`GET /products` (+ filter by category), `POST`, `PATCH /:id`, `DELETE /:id`,
toggle availability. Writes = admin.

### 🧾 Orders Module
| Method | Route                 | Access | Purpose                    |
| ------ | --------------------- | ------ | -------------------------- |
| POST   | `/orders`             | Auth   | Create order + items       |
| GET    | `/orders`             | Auth   | List / filter by status    |
| GET    | `/orders/:id`         | Auth   | Order detail               |
| PATCH  | `/orders/:id/status`  | Auth   | Update status (→ realtime) |

### 💳 Payments Module *(Phase 3)*
`POST /payments` — record payment, mark order completed.

### 📊 Reports Module *(Phase 3)*
`GET /reports/daily-sales`, `GET /reports/best-products`.

### 🔄 Realtime Gateway (Socket.IO) *(Phase 3)*
Emits: `order.created`, `order.updated`. Kitchen/admin screens subscribe.

---

## 5. Frontend (Next.js) — Pages

| Page                | Route             | Access  | Purpose                          |
| ------------------- | ----------------- | ------- | -------------------------------- |
| Login               | `/login`          | Public  | Cashier/admin sign in            |
| POS screen          | `/pos`            | Auth    | Product grid + cart + checkout   |
| Admin dashboard     | `/admin`          | Admin   | Overview                         |
| Product management  | `/admin/products` | Admin   | CRUD products & categories       |
| Order history       | `/admin/orders`   | Auth    | Past orders, filter by status    |
| Reports             | `/admin/reports`  | Admin   | Daily sales, best sellers        |
| Kitchen screen      | `/kitchen`        | Auth    | Live order queue (Socket.IO)     |

**Cross-cutting:** JWT stored client-side, attached to API + socket; auth guard
redirects unauthenticated users to `/login`; shared API client; cart state (Context/Zustand).

---

## 6. Suggested Folder Structure (Backend)

```
backend/src/
├── main.ts                 # CORS + global ValidationPipe
├── app.module.ts           # ConfigModule + TypeOrmModule.forRootAsync
├── common/
│   ├── enums/              # role.enum, order-status.enum, payment-method.enum
│   └── decorators/         # @Public, @Roles, @CurrentUser
├── auth/                   # service, controller, jwt.strategy, guards, dto
├── users/                  # entity, service, controller, dto
├── categories/
├── products/
├── orders/                 # order + order-item entities
├── payments/
├── reports/
└── realtime/               # Socket.IO gateway
```

---

## 7. Build Roadmap

### Phase 1 — MVP (core selling loop)
- [ ] TypeORM → MySQL connection (`ConfigModule` + `forRootAsync`)
- [ ] CORS + global validation in `main.ts`
- [ ] Users module + `User` entity
- [ ] Auth module: register, login, JWT, role guards
- [ ] Categories module (CRUD)
- [ ] Products module (CRUD)
- [ ] Orders module (create order + items, calculate total)
- [ ] Frontend: login page + auth
- [ ] Frontend: POS screen (product grid, cart, checkout)

### Phase 2 — Management
- [ ] Admin dashboard
- [ ] Product & category management UI
- [ ] Order history page + status filtering

### Phase 3 — Real-time & money
- [ ] Socket.IO gateway (live orders)
- [ ] Kitchen screen (subscribes to events)
- [ ] Payments module + UI
- [ ] Reports module (daily sales, best products) + reports page

---

## 8. Recommended Build Order
1. **DB connection + Auth** (everything depends on it) ← *start here*
2. **Categories + Products** (the menu)
3. **Orders** (the core transaction)
4. **Frontend login + POS** (make it usable)
5. **Admin + history** (Phase 2)
6. **Realtime + payments + reports** (Phase 3)
