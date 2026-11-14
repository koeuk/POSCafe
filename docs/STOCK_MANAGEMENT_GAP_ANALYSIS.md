# POSCAFE — Stock Management Gap Analysis

**Prepared:** 13 November 2026 (Asia/Phnom_Penh)

**Scope:** Compare the 15 requested features and 18 proposed tables with the current backend, frontend, Prisma schema, and existing test source.

**Deliverable:** Assessment and implementation backlog. This document does not implement missing features or change database data.

## Implementation progress

✅ means implemented and verified; 🟡 means partly complete; ⬜ means not started.

**Implementation order:** Follow the feature checklist from **1 → 15**. Complete and verify the current feature before starting the next feature. Required shared dependencies may be implemented with the current feature; they do not mark later features complete. Mark a feature ✅ only when its requested behavior is implemented and verified.

**Current focus: 2. Ingredient Management.** Stock Dashboard (Feature 1) is completed: distinguishing raw ingredients from packaging/operating supplies, scoped dashboard metrics, category breakdown cards, and backend summary API (`GET /inventory/summary`). Next is **2. Ingredient Management**: normalized category master (`inventory_categories`), and ingredient CRUD with category linkage.

- ✅ Added four white summary cards for all inventory items: total items, low stock (positive quantities only), out of stock, and current stock value.
- ✅ Added unit-cost entry/editing in USD per stock unit and a warning when stocked items have zero/missing costs. These cards distinguish ingredients from other supplies when filtered, and include a full category breakdown.
- ✅ New ingredients with opening stock create an atomic `opening_balance` movement; API-created items record the staff member.
- ✅ Quantity corrections require a nonblank `adjustmentReason`; the actual reason is saved in history. Cost-only edits do not require a stock correction reason.
- ✅ Adjust/restock requests require a nonblank reason; the UI supplies a required reason field.
- ✅ Dashboard: distinguished ingredients from packaging/operating supplies with dynamic scoped metrics, category breakdown cards, and backend summary API.
- ✅ History retention on deletion, archive/restore, and history filtering/pagination are implemented (see increments below).
- 🟡 Adjustments/history: document records, legacy opening reconciliation, and historical cost/unit/name snapshots remain.
- ⬜ Dedicated receiving/stock-out documents and full ingredient reports.
- ⬜ Completion-time consumption with reservations and snapshots.
- ⬜ Suppliers, purchasing, physical counts, locations, batches, expiry, and structured waste.

### Second increment

- ✅ Added a paginated ingredient history screen and `GET /inventory/history`, filtered by ingredient, staff ID, date range, and stock direction. History shows signed quantity, resulting balance, reason, staff, and order reference.
- ✅ History results and total count use one consistent database snapshot. Invalid page/date/direction filters are rejected, and stale browser responses are ignored.
- ✅ Separate Stock In, Stock Out, and Adjustment buttons now open the appropriate signed-quantity action. Notes remain required and stock-out errors are shown inside the dialog.
- ✅ Oversized stock-out and zero-delta requests are rejected without changing stock; quantities are no longer silently clamped.
- ✅ Deletion of items with movement history is refused, including forced deletion, before recipes can be changed. History is retained. Archiving and restoration are completed in the third increment.
- ✅ Stock units cannot be changed after movements exist, preventing history from being relabeled with a different unit.
- 🟡 These are basic stock actions, not posted receipt/issue documents. Source documents, idempotency across network retries, typed waste categories, historical cost/unit/name snapshots and legacy opening reconciliation remain unfinished.

**Verification:** 5 inventory unit tests and 93 backend integration tests passed. Frontend/backend type checks and changed-file lint passed. A browser check with mocked data verified valuation, the missing-cost warning, cost-only edits preserving live stock, and history pagination/direction filtering.

### Third increment — ingredient archiving

- ✅ Added nullable `inventory_items.archivedAt` and an index through the additive `20261113000100_ArchiveInventoryItems` migration. Existing quantities and movement rows are unchanged.
- ✅ Added Archive / Restore actions and active/archived list switching. Archived items retain quantities, costs, IDs, and all movement history; history filters include archived items.
- ✅ Active lists, low-stock alerts, and POS add-on options exclude archived supplies. Stock edits and restocking require restoration first.
- ✅ Archiving an ingredient used by a recipe is refused; recipes are not silently stripped. Recipe saving locks ingredient rows and rejects archived ingredients. Checkout also rejects archived add-ons/ingredients before committing stock.
- ✅ Refund/cancellation reversals still return quantities to their original item, including an archived item, preserving the ledger.
- ✅ Demo seeding respects archived supplies instead of duplicating or automatically restoring them; demo recipes requiring them are skipped.
- 🟡 Legacy opening reconciliation, immutable unit/name/cost snapshots, posted receiving/adjustment documents, and the other phases remain incomplete.

### Fourth increment — ingredient stock dashboard & category distinction

- ✅ Backend summary API: added `GET /inventory/summary` returning total stock items, positive low stock, out of stock, valuation, uncosted count, and category breakdown. Added `?category=...` and `?positiveOnly=true` filters to `GET /inventory/low-stock`.
- ✅ Ingredient vs supply dashboard cards: four summary cards now dynamically scope to the selected category. Selecting "Raw Materials" displays ingredient-focused labels (`Total ingredients`, ingredient low stock, ingredient out-of-stock, and ingredient stock valuation) with ingredient-specific uncosted warnings.
- ✅ Category breakdown: added interactive category breakdown cards under the main summary cards for Raw Materials (Ingredients), Packaging, and Operating Supplies, showing item count, valuation, and stock health, with one-click filtering.
- ✅ Verified with 8 backend unit tests (including summary calculations, category scoping, and low-stock filters), backend typecheck & lint, and frontend typecheck & lint.

**Archive API:** Stock permission is required for `GET /inventory/archived`, `POST /inventory/:id/archive`, and `POST /inventory/:id/restore`. Normal `GET /inventory` returns active items. Archived items remain readable by ID for inventory staff. Archive/restore do not change quantities or create stock movements. Items referenced by recipes must be removed from those recipes before archiving.

**Verification:** 8 unit tests passed in backend. Production backend and frontend type checks and changed-file lints passed.

**History API:** `GET /inventory/history` accepts `page` (default 1), `pageSize` (default 25, maximum 100), `inventoryItemId`, `userId`, `direction` (`all`/`in`/`out`), and inclusive local-calendar `from`/`to` dates (`YYYY-MM-DD`). It returns `{ items, total, page, pageSize }`. Existing `/inventory/movements` array responses are preserved. Deleting an item with history returns 409; oversized/zero stock adjustments return 400.

**API change:** `GET /inventory/summary` provides structured inventory metrics with optional `?category=`. `GET /inventory/low-stock` accepts `?category=` and `?positiveOnly=`. `PATCH /inventory/:id` needs `adjustmentReason` when quantity changes. `POST /inventory/:id/restock` needs a nonblank `reason`.

## 1. Current position

The application already has the core of ingredient and recipe inventory. It is not yet a complete purchasing, stock control, and batch management system.

| Status | Number of requested features |
| --- | ---: |
| Implemented at the requested basic level | 4 |
| Partially implemented or behavior differs | 6 |
| Missing as a dedicated workflow | 5 |
| **Total** | **15** |

“Implemented” means matching functionality was found in source. “Partial” means useful functionality exists but does not cover the full description. These labels are a source assessment, not a new runtime certification.

**Most important behavior difference:** ingredients are deducted when an order is **created**, including an unpaid Pay Later order. Payment later marks that order paid and completed without another deduction. Your requirement says to deduct when the sale is **completed**. Changing this requires a deliberate reservation/consumption design so unpaid orders cannot oversell ingredients.

## 2. Feature checklist

| # | Feature | Priority | Status | What exists now | What is missing or needs changing |
| --- | --- | --- | --- | --- | --- |
| 1 | Stock Dashboard | High | **✅ Implemented** | Summary cards distinguish ingredients from other supplies when filtered; category breakdown cards surface ingredient vs packaging metrics; `GET /inventory/summary` returns structured metrics. Products tab shows sellable units, sold-out products, and made-to-order products. | Complete and verified. |
| 2 | Ingredient Management | High | **✅ Implemented — basic** | Add, edit, delete, search, and group supplies/ingredients. Stores stock unit, quantity, minimum threshold, and editable unit cost. Deletion checks recipe usage; force deletion can remove recipe lines. | Basic requested CRUD and categorization are present. A normalized category master is still needed for the proposed schema. |
| 3 | Stock In | High | **🟡 Partial** | Positive quantity adjustments add stock and create ingredient movement records. | A receiving document with received date, supplier/source, purchase quantity/unit, unit cost, receipt reference, and posted status. No supplier or purchase order linkage. |
| 4 | Stock Out | High | **🟡 Partial** | Negative adjustments subtract stock and require a free-text reason. Sales also create ingredient deductions. | A dedicated manual issue/waste action with required reason and explicit usage/damage/waste classification. Oversized subtraction is now rejected. Structured source documents and usage/damage/waste types remain. |
| 5 | Recipe Management | High | **✅ Implemented — basic** | Recipes by product and size, ingredient quantities, compatible units, optional add-ons, recipe editing, and calculated servings. Saving a recipe switches a product to recipe stock mode. | The core requirement is present. Recipe/version snapshots become necessary if consumption is moved from order placement to later completion. |
| 6 | Auto Stock Deduction | High | **🟡 Partial — different trigger** | Atomic deduction at order creation; ingredient shortages roll back the order. Locks prevent overselling. Cancellation/refund reverses recorded deductions. | Deduction at completed sale rather than at unpaid order placement. Must separate reservation from consumption and prevent duplicate consumption on retries. |
| 7 | Low Stock Alerts | High | **✅ Implemented — basic visual alerts** | Per-item thresholds, low-stock badges, a low-stock count, and `GET /inventory/low-stock`. Current comparison is quantity **at or below** the threshold. | No push/email/SMS or persistent notification lifecycle. Those are optional enhancements unless you require an alert outside the inventory screen. Out-of-stock items currently also count as low stock. |
| 8 | Stock Adjustment | High | **🟡 Partial** | Quantity edits require a reason and journal the actual difference; the adjust/restock dialog requires a note. | Structured adjustment records and consistent before/after/actor presentation remain. |
| 9 | Stock History | High | **🟡 Partial** | Ingredient movements store signed quantity, resulting stock, reason, user, order, and timestamps. Separate finished-product manual movements exist. UI shows recent entries. | A complete retained history: legacy opening ingredient quantities have not been reconciled, movement-history deletion is now blocked and a filtered/paginated screen exists. Archiving is implemented; historical cost/unit/name snapshots still remain. |
| 10 | Supplier Management | Medium | **⬜ Missing** | No supplier model, API, or management screen found. | Supplier records, contact information, active status, notes, and linked purchasing/receiving history. |
| 11 | Purchase Orders | Medium | **⬜ Missing** | No purchase-order or receiving-document models, APIs, or screens found. Generic restocking is available. | Draft/submitted/partially received/received/cancelled orders, ingredient lines, ordered quantities, costs, and partial receipt handling. |
| 12 | Stock Count | Medium | **⬜ Missing** | Staff can manually overwrite a quantity or apply a delta. | A physical count session, expected quantity snapshot, counted quantity, variance, review/posting, and linked adjustment movements. A quantity edit is not a stock-count workflow. |
| 13 | Expiration Tracking | Medium | **⬜ Missing** | No ingredient batch or expiry fields/workflow found. | Batches, received/expiry dates, remaining batch quantities, expiry alerts, and expired-stock handling. |
| 14 | Waste Management | Medium | **⬜ Missing as a dedicated workflow** | A negative adjustment can carry a note such as “Spoilage.” | Structured expired/spilled/damaged waste records, quantities, cost snapshots, optional batch/location, responsible staff, and waste reporting. Generic subtraction alone is not this feature. |
| 15 | Stock Reports | High | **🟡 Partial** | Product availability/sold-out reporting, product sales counts, sales/revenue reports, and recent movement feeds. | Ingredient consumption, stock valuation, stock in/out, adjustments, and waste/cost reports for a selected period. Existing sales revenue reporting does not provide ingredient consumption costs. |

## 3. Your proposed tables compared with the current schema

Names alone do not determine whether a feature exists. Two requested entities already have equivalent tables under different names. The current `stock_movements` table also has a different purpose from a general ingredient movement ledger.

| Requested table | Current equivalent/status | Recommended action |
| --- | --- | --- |
| `inventory_categories` | **No table.** Categories are strings in `inventory_items.category`. Product categories are separate menu categories. | Add an inventory category master and migrate existing category strings into it. Do not merge ingredient categories with menu product categories automatically. |
| `ingredients` | **Equivalent exists:** `inventory_items`. This contains both ingredients and packaging/operating supplies. | Reuse existing records and IDs. Keep the physical name with Prisma mapping, or plan an explicit migration if a rename is required. Preserve the supply types the café already tracks. |
| `ingredient_units` | **No master table.** Units are strings on inventory/recipe items; common unit options are in code. | Add a unit master if units must be centrally managed. |
| `unit_conversions` | **No table.** Code already converts g ↔ kg and ml ↔ L; pcs and custom identical units are supported. | Keep working conversions and add persisted conversion definitions if configurable conversions are required. Product-specific packaging conversions need their own ingredient context. |
| `recipes` | **Exists:** `recipes`. | Extend/reuse. It is linked to a product and optional size. |
| `recipe_ingredients` | **Equivalent exists:** `recipe_items`. | Reuse or map the existing table; preserve recipe and ingredient relationships. |
| `stock_locations` | **⬜ Missing.** Stock currently has one aggregate quantity per item with no location. | Add locations if receiving/counting/batches must distinguish storeroom, bar, or other locations. |
| `stock_movements` | **Name exists, different purpose:** manual finished-product changes use `stock_movements`. Ingredient movements are in **`inventory_movements`**. | Use/extend `inventory_movements` as the ingredient ledger, or migrate naming deliberately. Do not overwrite or combine the product ledger just to match this name. |
| `stock_adjustments` | **⬜ Missing document table.** Generic corrections exist in ingredient movements. | Add adjustment documents linked to posted ingredient movements. |
| `stock_counts` | **⬜ Missing.** | Add physical count session headers. |
| `stock_count_items` | **⬜ Missing.** | Add expected/count/variance lines linked to a count session. |
| `suppliers` | **⬜ Missing.** | Add supplier records and purchasing relationships. |
| `purchase_orders` | **⬜ Missing.** | Add purchase order headers. |
| `purchase_order_items` | **⬜ Missing.** | Add ordered ingredient, unit, quantity, and cost lines. |
| `stock_receipts` | **⬜ Missing.** | Add receiving documents, optionally linked to a purchase order. |
| `stock_receipt_items` | **⬜ Missing.** | Add received quantities, units, costs, and batch creation references. |
| `inventory_batches` | **⬜ Missing.** | Add batch identity, ingredient/location, receipt reference, expiry date, remaining quantity, and cost information. |
| `waste_records` | **⬜ Missing.** | Add structured waste records linked to ingredient ledger entries. |

**Naming recommendation:** reuse `inventory_items`, `recipe_items`, and `inventory_movements` initially. They already underpin APIs, recipes, orders, refunds, and the UI. Display names such as “Ingredients” can change without renaming database tables.

The 18-table list is a good functional starting point. If multiple locations and unpaid-order reservations are introduced, additional persistence may be needed, such as `inventory_balances` per ingredient/location and `inventory_reservations` per order. These are proposed additions, not existing tables.

## 4. High-priority missing work

### A. Ingredient stock dashboard and valuation

Add four ingredient-focused cards:

| Metric | Proposed definition |
| --- | --- |
| Total ingredients | Count ingredient records in scope; distinguish raw ingredients from packaging and operating supplies. |
| Low stock | Positive stock at or below the minimum threshold. Show zero-stock items separately to avoid double counting. |
| Out of stock | Stock quantity is zero. Negative stock should be prevented by posted inventory actions. |
| Stock value | Sum of on-hand base-unit quantities × applicable cost per base unit. If locations/batches exist, aggregate their balances without counting the same stock twice. |

Add a unit-cost field to the ingredient form. `costPerUnit` is now submitted by the consumables form (completed in the first increment). Existing/default zero costs must not be presented as a reliable valuation without identifying missing cost data.

**Acceptance:** adding an ingredient, receiving stock, consuming stock, or posting a correction updates the appropriate metrics. Mixed units are converted before cost calculations.

### B. Explicit stock in and stock out

Replace ambiguity in the generic adjust dialog with actions that clearly express the operation:

| Action | Required information | Inventory effect |
| --- | --- | --- |
| Stock In | Ingredient, received quantity/unit, received date, source/supplier where available, unit cost, reference, staff member | Increase on-hand stock once when posted. |
| Stock Out | Ingredient, used/damaged/wasted quantity/unit, reason, occurrence date, staff member | Decrease on-hand stock once when posted. |
| Adjustment | Ingredient, expected/current quantity, corrected quantity or difference, required reason, staff member | Apply the actual difference and record before/after values. |

✅ The subtraction route now rejects shortages and zero-delta requests. The proposed dedicated actions should reject an excessive subtraction, or explicitly show and confirm the smaller applied quantity; they should not silently record the requested amount as fully used.

**Acceptance:** duplicate submissions do not double-post stock; invalid quantities and missing reasons are rejected; posting the document and movement is one database transaction.

### C. Sale completion and stock reservation

Current flow:

```text
Place order (possibly unpaid)
  -> deduct product stock and recipe ingredients
  -> record ingredient order_deduction movements
Take payment
  -> mark order paid and completed
Cancel/refund
  -> restore the recorded quantities
```

Target flow matching the requested completion trigger:

```text
Place order
  -> validate availability and reserve the required quantities
Complete paid sale
  -> consume the reserved quantities exactly once
  -> record final ingredient consumption movements
Cancel unpaid order
  -> release reservations
Refund paid order
  -> record money reversal and apply the defined stock-return policy
```

Do not simply remove the existing creation-time deduction and add a second deduction in payments. Reservations or an equivalent availability control must prevent concurrent unpaid orders from promising the same last ingredients. Payment completion, stock consumption, and their records must commit atomically.

Capture the ingredient quantities/units required for that order when reserving it. Later recipe edits must not change what an existing order consumes or reverses.

**Acceptance:** unpaid orders reserve without being reported as completed-sale consumption; two orders cannot reserve the same final stock; payment retries do not consume twice; cancellation releases once; a failed payment cannot leave a partially completed stock posting.

**Business decision before implementation:** a financial refund does not necessarily mean a prepared drink's ingredients physically return to stock. The current code restores stock automatically. Define whether refunds return stock, record waste, or require an explicit disposition.

### D. Complete movement history and adjustment reasons

Extend the ingredient ledger to record, where applicable:

- Ingredient ID and stable display/unit snapshots.
- Movement type: opening balance, receipt, manual issue, sale consumption, correction, return, waste, and later location transfer.
- Quantity change in the ingredient's base unit, resulting balance, timestamp, and staff member.
- Reference to the order, receipt, adjustment, count session, or waste record.
- Unit-cost/total-cost snapshot when cost reporting depends on it.
- Location and batch when those modules are enabled.
- A duplicate-posting key or unique source reference.

✅ Opening stock on new ingredients is now journaled. For legacy stock, create an explicitly identified migration/opening balance rather than inventing past receipts or consumption. Keep historical costs unknown when they cannot be established.

Archive ingredients that have movement history instead of cascading their history away. Correct posted records through linked reversal/correction entries rather than silently editing history.

Add a paginated history screen with date, ingredient, movement type, staff, and source filters. ✅ The supplies screen now uses paginated history rather than a latest-30-only feed.

**Acceptance:** opening balance plus all posted changes reconciles to the current stock; deleting/archiving an ingredient cannot erase its movement history; every manual correction has a nonempty recorded reason.

### E. Ingredient stock reports

| Report | Minimum output |
| --- | --- |
| Current stock/value | Ingredient, category, unit, on-hand, threshold/status, unit cost, extended value. |
| Consumption | Ingredient quantities consumed by completed sales in a date range, with linked order/source details. |
| Stock movement | Opening balance, receipts, issues/consumption, adjustments/returns, and closing balance for the period. |
| Waste | Waste quantities by reason, ingredient, period, and cost where known. |
| Purchasing/receipts | Received quantities and costs by supplier/ingredient/period once purchasing is available. |

Document the stock costing rule before implementing historical cost and margin reports. Today there is one mutable `costPerUnit` field and no receipt-cost history. Updating that field must not silently rewrite historical consumption costs.

**Acceptance:** reports reconcile to posted ledger entries, handle unit conversions consistently, and distinguish unpaid reservations from actual completed-sale consumption.

## 5. Medium-priority modules to add

| Module | Minimum workflow and fields | Completion criteria |
| --- | --- | --- |
| Suppliers | Name, contacts, address/notes, active status, linked PO/receipt history. | Staff can select a supplier when purchasing/receiving and view its purchase details. Historical documents remain readable if the supplier becomes inactive. |
| Purchase orders | Unique PO number, supplier, destination, dates, status; ingredient/unit/quantity/cost lines. | Draft orders can be edited; receiving can be partial; received quantities are not counted twice; cancellation does not remove already received stock. |
| Stock receipts | Unique receipt number, PO or manual source, supplier, destination, received date, received lines and staff member. | Posting creates stock and cost records atomically. A receipt can exist without a PO, so basic Stock In need not wait for the full purchasing module. |
| Physical counts | Count session, location, count cutoff/snapshot, expected/count/variance lines, staff/reviewer and posted status. | Posting creates linked adjustment movements exactly once. Intervening receipts/sales must be reconciled; an old snapshot cannot overwrite newer stock silently. |
| Locations | Named active locations and an explicit default for migrated stock. | Ingredient/location balances reconcile with the global total. Transfers create linked out/in records atomically. |
| Batches and expiry | Batch identifier, ingredient/location, receipt reference, received/expiry dates, available quantity and cost. | Staff can find expired/soon-expiring batches. Depletion can select the earliest suitable expiry (FEFO), while preserving exactly which batches were consumed. |
| Waste | Ingredient/location/batch, quantity/unit, waste date, reason (expired/spilled/damaged/other), notes, cost snapshot and staff member. | Posting reduces the relevant stock once and links to a movement. Waste totals reconcile with waste movements. |

Unit master/conversion management should preserve the existing g/kg, ml/L, pcs, and same-custom-unit behavior. A purchase pack conversion such as “one bottle = 750 ml” must be ingredient-specific when bottle sizes differ; it should not become an unsafe global conversion for every ingredient.

## 6. Suggested implementation order

| Phase | Work | Result |
| --- | --- | --- |
| 1 — Complete core controls | Retain movement history; journal opening balances; require correction reasons; separate Stock In/Stock Out with basic posted receipts that do not require POs; expose ingredient costs; add dashboard metrics and complete movement/valuation reports. | Covers the main high-priority gaps without waiting for all purchasing screens. |
| 2 — Align sale timing | Define preparation/refund policy; implement reservations and ingredient snapshots; move final consumption to completed sale; complete consumption reports; verify retries, concurrency, cancellation, and refunds. | Matches the requested deduction trigger without overselling or double deduction. This is a high-priority dependency, not optional cleanup. |
| 3 — Purchasing and counting | Supplier master, purchase orders/lines, posted receipts/lines, locations where needed, and physical count sessions/lines. | Controlled purchasing, receiving, and physical reconciliation. |
| 4 — Batch controls | Batches, expiry alerts/selection, and structured batch-linked waste records/reports. | Traceable expiry and waste management. Basic classified waste/stock-out reasons can be introduced in Phase 1. |

Use additive Prisma migrations. Preserve current IDs and foreign keys, backfill category/unit/location references explicitly, and reconcile stock before switching to a new balance/ledger design. Backfilled metadata must be labeled; missing historical dates, costs, suppliers, or batches cannot be inferred reliably.

## 7. Verification required for the missing work

1. Opening stock, receipts, issues, adjustments, and closing stock reconcile in the same base unit.
2. Recipe size choices and optional extras consume the correct quantities; g/kg and ml/L conversions remain correct.
3. An unpaid order reserves stock; final settlement consumes once; retries and duplicate receipt/waste/count submissions do not post twice.
4. Cancellation, refund, recipe changes, and prepared-product waste follow the agreed stock disposition policy.
5. Concurrent sales, restocking, physical count posting, and location transfers cannot lose updates or produce unexplained negative stock.
6. Supplier/PO partial receipts correctly track outstanding quantities, costs, and stock.
7. Expired batches are identified and excluded from usable stock according to the agreed policy; selected batches are traceable.
8. Archiving ingredients, products, or suppliers preserves relevant audit records.
9. Inventory actions and reports respect staff permissions. Existing `stock` and `reports` grants are the starting point; decide who may post counts and corrections.
10. Dashboard figures and reports reconcile to the ledger and identify missing cost data.

Existing test files already cover ingredient deduction, shortage rollback, cancellation/refund, recipe changes, units, and stock modes. They currently expect deduction at order creation, so changing that business rule also requires updating those expectations. Existing tests are not evidence that the missing supplier, purchasing, count, batch, expiry, or waste workflows are implemented.

## 8. Source evidence

| Area | Reviewed source |
| --- | --- |
| Current database models/tables | [Prisma schema](../backend/prisma/schema.prisma) |
| Ingredient API routes and permission grant | [Inventory controller](../backend/src/inventory/inventory.controller.ts) |
| CRUD, threshold query, corrections, clamped restocking and deletion | [Inventory service](../backend/src/inventory/inventory.service.ts) |
| Stock-in/out request shape; optional reason | [Restock DTO](../backend/src/inventory/dto/restock-inventory-item.dto.ts) |
| Ingredient fields including backend unit cost | [Create ingredient DTO](../backend/src/inventory/dto/create-inventory-item.dto.ts) |
| Ingredient UI, visual warnings, optional note and recent-30 history | [Consumables manager](../frontend/src/components/consumables-manager.tsx) |
| Product-level inventory summary and modes | [Stock page](../frontend/src/app/(staff)/(manage)/stock/page.tsx) |
| Recipe CRUD and ingredient validation | [Recipes service](../backend/src/recipes/recipes.service.ts), [recipe editor](../frontend/src/components/recipe-editor.tsx) |
| Existing unit conversion support | [Backend units](../backend/src/inventory/units.ts), [frontend units](../frontend/src/lib/units.ts) |
| Deduction at creation | [Orders service: create](../backend/src/orders/orders.service.ts) |
| Ingredient journal and reversal behavior | [Order stock service](../backend/src/inventory/order-stock.service.ts) |
| Payment marks paid/completed without a second deduction | [Payments service](../backend/src/payments/payments.service.ts) |
| Separate finished-product movements | [Products service](../backend/src/products/products.service.ts) |
| Existing report scope | [Reports controller](../backend/src/reports/reports.controller.ts), [reports service](../backend/src/reports/reports.service.ts) |
| Existing deduction/recipe tests inspected | [Ingredient deduction](../backend/test/ingredient-deduction.e2e-spec.ts), [recipe stock](../backend/test/recipe-stock.e2e-spec.ts), [recipe units](../backend/test/recipe-units.e2e-spec.ts), [stock modes](../backend/test/stock-mode.e2e-spec.ts) |

**Assessment limits:** repository source and test source were reviewed for this audit. The original audit was source-only. The implementation progress section records subsequent work; no database schema migration was needed for the first increment. “Missing” means no supporting implementation was found in the reviewed application source/schema.
