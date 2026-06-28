# ☕ POSCAFE

A full-stack **Point-of-Sale system for a coffee shop**. Cashiers take orders, admins manage the menu and view reports, and the kitchen sees live order updates over WebSockets.

---

## Features

- **Authentication** — JWT login with role-based access (`admin` / `cashier`)
- **Granular page permissions** — admins can choose exactly which sidebar pages each cashier can see; cashiers browse under a `/cashier/*` namespace while admins use clean URLs
- **Point of Sale** — fast cart + checkout with size variants, discounts and live stock caps
- **Orders & Kitchen** — real-time order board (pending → preparing → ready → completed) via Socket.IO
- **Payments** — cash / QR / card, with cash tendered & change; orders tracked as **unpaid → paid**
- **Products & Categories** — full CRUD with image upload, gallery, per-size pricing and stock
- **Stock** — per-size cup stock management
- **Reports** — daily sales, best sellers, revenue by date range, stock overview
- **Public menu + QR** — customer-facing menu reachable by scanning a generated QR code
- **Dark mode** and a responsive, collapsible sidebar

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11 · TypeORM · MySQL |
| Auth | JWT (Passport) · bcrypt |
| Realtime | Socket.IO |
| Frontend | Next.js 16 (App Router, React 19) |
| Styling | Tailwind CSS 4 |
| Validation | class-validator / class-transformer |

---

## Project Structure

```
POSCAFE/
├── backend/          # NestJS API (auth, users, products, orders, payments, reports…)
│   └── src/
├── frontend/         # Next.js app
│   └── src/
│       ├── app/(staff)/        # authenticated app shell
│       │   ├── (manage)/       # admin clean-URL management pages
│       │   └── cashier/        # cashier-namespaced pages
│       ├── components/         # sidebar, guards, admin views…
│       └── lib/                # api client, auth + permissions, types
└── PLAN.md           # design notes & roadmap
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MySQL running locally (default `localhost:3306`)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # set DB credentials + JWT_SECRET
npm run start:dev         # http://localhost:3001
```

The database schema is created automatically (`synchronize: true` in development).

### 2. Frontend

```bash
cd frontend
npm install
# .env.local: NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev               # http://localhost:3000
```

### First user
The **first** account registered becomes the **admin**; subsequent accounts default to `cashier`. Admins create and manage other staff (and their page permissions) under **Settings**.

---

## Roles & Permissions

- **Admin** — full access; clean URLs (`/products`, `/reports`, …).
- **Cashier** — only the pages an admin grants, served under `/cashier/*`. Access is enforced both in the sidebar and by a route guard, and on the backend via a `@RequiresPage()` check.

---

## Scripts

**Backend**

```bash
npm run start:dev    # watch mode
npm run build        # compile
npm run start:prod   # run dist
```

**Frontend**

```bash
npm run dev          # dev server
npm run build        # production build
npm run start        # serve build
npm run lint         # eslint
```
