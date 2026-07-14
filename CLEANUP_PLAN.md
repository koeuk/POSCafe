# POSCAFE — Code Cleanup Plan

_Generated from a full backend + frontend maintainability audit. Ordered by priority. Approach: small, verifiable slices — run `tsc --noEmit` + lint after each, verify behavior on the `:3005` preview. Behavior-preserving unless marked 🐞 (bug fix)._

**Legend:** 🐞 = actual bug · 🧹 = cleanup/dedup · 🏗️ = structural refactor · ✅ = done

---

## Phase 0 — Backend correctness bugs ✅ DONE

- [x] ✅ 🐞 **Payment flow now transactional** — `payments.service.ts` wraps the whole flow in `dataSource.transaction`, locks the order row (`pessimistic_write`), and commits the payment insert + order (paid + completed) atomically. _(Was fixed in parallel.)_
- [x] ✅ 🐞 **Single `order.updated` emit** — payment path now calls one `OrdersService.broadcastUpdate()` after commit instead of `markPaid` + `updateStatus`. `updateStatus` also gained status-transition validation. _(Was fixed in parallel.)_
- [x] ✅ 🐞 **Boot-time backfill removed** — deleted the `onModuleInit` raw-SQL migration + empty `catch {}` from `orders.service.ts` (completed one-time backfill; new orders always set `paymentStatus` correctly). Also removed now-dead `markPaid()`. Verified: `tsc` + `eslint` clean.
- [x] ✅ 🐞 **Stock oversell (no row lock)** — `pessimistic_write` lock present on product + variant reads.

---

## Phase 1 — Frontend quick wins (pure deletions/dedup, ~400 lines, no behavior change)

- [ ] 🧹 **3 copies of `ConfirmDialog`** → use shared `components/confirm-dialog.tsx`
  Inline copies at `components/admin-product-management.tsx:1341`, `app/(staff)/(manage)/settings/page.tsx:611`. Only the shared one handles Escape/backdrop.
- [ ] 🧹 **`pay`'s `money()` duplicates `formatPrice`** — `app/(staff)/pay/page.tsx:33-36` is byte-for-byte `pricing.formatPrice`. Delete; import `formatPrice`. Also inline `$${…toFixed(2)}` in `orders`, `order-history`, `manage-orders`.
- [ ] 🧹 **`order-history` ≈ `manage-orders`** — ~193 identical lines (198 each). Extract one `OrderHistoryView`; each route becomes an ~8-line wrapper (`StaffShell` vs `RequireAuth role={ADMIN}`).
- [ ] 🧹 **Duplicated inline types → `lib/types.ts`**
  `OrderWithUser` (in `orders`, `order-history`, `manage-orders`), `Payment` (`pay/page.tsx:15-23`), `SizeRow` (product form + stock page). Use `Role` instead of `role: string`; pin decimal fields to `string`.

---

## Phase 2 — Shared helpers (removes repetition across ~12 files)

- [ ] 🧹 **`lib/use-api.ts` — `useFetch<T>(fn, deps)`** returning `{data, loading, error, reload}` + `toErrorMessage(err, fallback)`.
  The `loading/error/cancelled` triad is copy-pasted in ~12 files (`pos`, `dashboard`, `pay`, `orders`, `order-history`, `manage-orders`, `stock`, `settings`, `admin-product-management`, `kitchen`, `reports`, admin views). Optional `{ pollMs }` to unify `orders`/`kitchen` polling.
- [ ] 🧹 **`lib/use-click-outside.ts`** — outside-click/Escape popover close is re-written ~5× (`CategoryCombobox`, `StockCell`, `PeriodMenu`, `StaffRow`), inconsistently.
- [ ] 🧹 **`lib/orders.ts` — `ORDER_STATUS_META` + `STATUS_FILTERS`** — status→label/color defined 4–5 ways (hex in dashboard, Tailwind classes in orders), already inconsistent.
- [ ] 🧹 **Design tokens** — brand color `#2A1D15` hardcoded ~40× and 3 near-identical input-class constants (`INPUT_CLASS`/`inputClass`/`INPUT`). Add `BRAND`/`INPUT` to `lib/ui.ts` (or CSS var) + a shared `<TextInput>`.
- [ ] 🧹 **Backend `common/money.ts`** — `Math.round(x*100)/100` + `Number(decimal)` coercion scattered across orders/payments/reports. Add `roundCents`/`toNumber`, or a TypeORM `ColumnNumericTransformer` on decimal columns.
- [ ] 🧹 **`useImageUpload()` hook / shared `<ImagePicker shape>`** — upload `setUploading/try/catch/finally` written 5× (`admin-product-management` ×3, settings Logo/Avatar pickers).

---

## Phase 3 — Structural refactors (schedule deliberately)

- [ ] 🏗️ **Split `components/admin-product-management.tsx` (1721 lines)** — one component owns category+product CRUD, 3 fetches, deep-linking, uploads, combobox, stock popover, validation.
  → `CategoryTable`, `ProductTable`, `ProductForm`, `CategoryForm`, `CategoryCombobox`, `StockCell` under `components/products/`.
- [ ] 🏗️ **Split `app/(staff)/(manage)/settings/page.tsx` (1251 lines)** — extract shared `<Modal>` shell (CreateUser/EditUser/Permissions re-implement backdrop chrome) and one `<ImagePicker>` (Avatar/Logo pickers near-identical); move modals + `StaffRow` to `components/settings/`.
- [ ] 🧹 **`menu-browser` vs `admin-menu-browser`** — extract shared `useMenuFilter(menu)` (category+search logic duplicated).
- [ ] 🧹 **Standardize data-fetching strategy** — some pages poll, equivalents fetch once; error handling ranges from full UI to silent `catch {}` (`pos:193`). Converge on `useFetch` + consistent error surface.

---

## Phase 4 — Backend structure & conventions

- [ ] 🏗️ **`reports.service.ts` — 5 near-identical raw QueryBuilders** (`summary`/`dailySales`/`categorySales`/`bestProducts`). Extract a `completedOrdersQB()` base + typed `mapRow` helper. Note MySQL `DATE_FORMAT` coupling.
- [ ] 🏗️ **Size modeled 3 unsynchronized ways** — `product.sizes` JSON `{size,price}`, `ProductVariant.stock`, and a `Size` catalog nothing references. `syncVariants()` exists only to reconcile two of them.
  **Fix:** make `ProductVariant` the single source of `{size,price,stock}`, drop the `sizes` JSON column, validate against `Size` — **or** delete the seemingly-dead `sizes` module. _(Higher risk — confirm scope first.)_
- [ ] 🧹 **Service naming** — `users.service.ts` (`createUser/updateUser/deleteUser`) and `settings.service.ts` (`find/update`) break the standard `create/findAll/findOne/update/remove`. Extract the hand-written "assign defined DTO fields" boilerplate.
- [ ] 🧹 **Validation & type-safety** — `ParseIntPipe` min/max on report params (`reports.controller.ts`), duplicate-size validation in `CreateProductDto`; install `@types/multer`; type `expiresIn` (drop `as any` in `auth.module.ts`); type report raw rows.
- [ ] 🧹 **`menu.service.ts:20-38`** — loads all products then filters/sorts in JS; push `isAvailable` filter + ordering into a QueryBuilder.

---

## Notes
- **Temp preview artifacts** still in tree: `next.config.ts` `distDir` override (harmless), `tsconfig.json` `.next-preview` includes (harmless noise) — revert at teardown of the `:3005` preview.
- `:3000` is a stale root-owned `next start` build; `:3005` is the live dev preview with latest code.
