# POSCAFE — UI/UX Design Prompts

Ready-to-paste prompts for generating UI mockups (Claude, v0, or any AI design tool).
Each prompt is self-contained and reflects the app's **current** UI structure, real values, and brand system.

**Brand conventions to keep consistent across all screens:**

- **Primary action color:** espresso brown `#2A1D15` (light mode) / amber `#F59E0B` (dark mode) — admin-customizable via Settings
- **Money/hero KPI cards:** solid deep-green gradient `#059669 → #052e16` with white text
- **Status colors:** Pending amber `#F59E0B` · Preparing blue `#3B82F6` · Ready violet `#7C5CFC` · Completed green `#22C55E` · Cancelled stone `#A8A29E`
- **Surfaces:** frosted-glass white/80 cards, rounded-2xl, on light-gray `#F5F5F6` page (stone-950 in dark mode)
- **Typography:** Geist Sans everywhere; Fraunces serif display only on the public customer menu

**Known issues worth fixing in redesigns:** Pay screen buttons lack dark mode; discounted *sized* products never show a struck-through original price; the public product-detail page has no dark mode.

---

## 1. Login

```
Design a coffee-shop POS "Login" page UI mockup with the following structure:

Layout: split screen — left hero panel (coffee photography with dark espresso wash, app logo, big serif app name "POSCAFE", tagline "Point of sale, brewed for your counter"), right centered login card
Sections: logo + app name → username field → password field (show/hide toggle, caps-lock hint) → full-width submit button → footer "POSCAFE · Coffee shop point of sale"
Components: text inputs with icon prefixes, primary button (espresso brown #2A1D15, cream text), input focus rings in brand color
Color palette: primary espresso brown #2A1D15, cream #FFF7ED, page white / stone-950 dark, amber #F59E0B dark-mode accent
Typography: Geist Sans, bold tracking-tight headings, hero name in large display serif
Style/mood: warm artisanal café meets modern minimal SaaS, subtle iOS-style entrance animations
Framework/library reference: shadcn/ui, Tailwind CSS
Responsive: mobile-first (hero hides on mobile, card fills screen)
Reference: Linear login + Square POS warmth
```

## 2. Admin Dashboard

```
Design a coffee-shop POS "Admin Dashboard" UI mockup with the following structure:

Layout: collapsible left sidebar (glass, 64px collapsed / 256px expanded) + main content on light gray #F5F5F6 page
Sections top to bottom: greeting hero card "Hi, Admin — Admin command center for today's cafe operations" → 4 KPI stat cards in a row → 2-column row (revenue chart 2/3 + order status donut 1/3) → "Popular Categories" horizontal bar list → "Recent Orders" table (6 rows)
Components:
- KPI cards: "Revenue $242.60" as HERO card with solid deep-green gradient (#059669 → #052e16, white text, frosted white icon chip); "Total Orders 34", "Active Orders 4", "Products 57" as glass cards with soft color tints (brand brown, amber, blue) + tinted icon chips
- Revenue card section: Bar/Line/Area pill toggle, period dropdown ("This Week" with calendar icon + chevron, glass pop-in menu with checkmarks), total pill "$6.75 total"; green bars with day labels "Mon $3.25"
- Donut chart: center "34 Orders", legend rows Pending amber / Preparing blue / Ready violet / Completed green / Cancelled gray with counts
- Popular Categories: color-dot + name + "MOST POPULAR" amber pill on top item + progress bars + "11 · 58%" values
Color palette: espresso #2A1D15 primary, deep green #059669 hero, status colors amber #F59E0B / blue #3B82F6 / violet #7C5CFC / green #22C55E / stone #A8A29E, frosted glass white/80 cards on #F5F5F6
Typography: Geist Sans, 2xl-3xl bold tracking-tight headings, tabular numbers for stats
Style/mood: iOS-inspired frosted-glass SaaS dashboard, rounded-2xl, staggered rise-in animations
Framework/library reference: shadcn/ui, Tailwind CSS
Responsive: desktop-first, cards stack 2-col → 1-col on mobile
Reference: Apple Health cards + Stripe dashboard
```

## 3. Point of Sale (POS)

```
Design a coffee-shop "Point of Sale" screen UI mockup with the following structure:

Layout: sidebar + two-pane workspace — left product area (scrollable) + right fixed cart panel "Current Order"
Sections (left): search bar with icon + clear button → horizontal category pill row ("All", "Espresso", "Tea", "Pastries"; active = espresso brown pill) → responsive product card grid
Sections (right cart): header "Current Order" + item-count pill → cart line items (name, size chip, qty stepper − / 2 / +, line total) → dashed divider → "Total $12.50" large → full-width "Charge / Checkout" button → after checkout: success banner "ORD-000034 · $12.50" with "Pay now →" and "View in Orders →" links
Components: product cards with image (or ☕ placeholder), name, "from $3.50" price, red "−20%" discount badge, stock badge "12 / 20 sold" (emerald, turns amber when low, "Out of stock" overlay), per-size buttons "S $3.00 · M $3.50 · L $4.00" with "out" tags; qty steppers; sticky total
Color palette: espresso #2A1D15 buttons with cream text, white cards, #F5F5F6 page, emerald/amber stock states, red discount badges
Typography: Geist Sans, semibold product names, bold 3xl total
Style/mood: fast tactile cashier tool, big touch targets, press-scale feedback, minimal chrome
Framework/library reference: shadcn/ui, Tailwind CSS
Responsive: desktop/tablet-first (cart becomes bottom sheet on mobile)
Reference: Square Register / Toast POS
```

## 4. Orders Queue

```
Design a coffee-shop POS "Orders" queue page UI mockup with the following structure:

Layout: sidebar + main content, glass header card + vertical order card list
Sections: header "Orders — 4 active · 34 total · live" → status filter tabs (All / Pending / Preparing / Ready / Completed / Cancelled; active tab espresso-brown pill) → order cards
Components per order card: "ORD-000034" + colored status pill (Pending amber / Preparing blue / Ready violet / Completed green / Cancelled gray) + timestamp + cashier name → item rows "2× Espresso — $7.00" → footer "Total $12.50" + one-tap advance button ("Start preparing" / "Mark ready" / "Complete") + text "Cancel" button on pending/preparing only
Color palette: espresso #2A1D15 primary buttons, status pill colors above, glass white cards on #F5F5F6
Typography: Geist Sans, mono-ish tabular order numbers, semibold totals
Style/mood: operational, scannable list, clear status color language
Framework/library reference: shadcn/ui, Tailwind CSS
Responsive: mobile-first (cards full-width)
Reference: Toast KDS order list
```

## 5. Kitchen Board

```
Design a fullscreen coffee-shop "Kitchen Display" board UI mockup with the following structure:

Layout: fullscreen (no sidebar), top header bar + 3 equal kanban columns
Sections: header "👨‍🍳 Kitchen" + live-status pill ("Live" green dot / "Offline" red) + theme toggle → columns "New", "Preparing", "Ready" each with count badge
Components: ticket cards (oldest first) showing "ORD-000034", time "14:32", item list "2× Latte, 1× Croissant", full-width advance button per column ("Start" → "Ready" → "Complete"); completing removes the ticket
Color palette: page follows brand background, tickets white/stone-900 cards, columns subtly separated; advance buttons espresso brown / amber in dark mode
Typography: Geist Sans, large readable ticket text (viewed from a distance), bold order numbers
Style/mood: high-contrast operational kanban, glanceable at 2 meters, dark-mode friendly
Framework/library reference: shadcn/ui, Tailwind CSS
Responsive: landscape screen-first (columns stack on mobile)
Reference: Toast / Fresh KDS kitchen screens
```

## 6. Take Payment

```
Design a coffee-shop POS "Take Payment" page UI mockup with the following structure:

Layout: centered card on page background (max-w-3xl), no distractions
Sections (flow): unpaid order picker list ("ORD-000034 · 3 items · $12.50") → payment screen: order summary (item rows + "Total due $12.50") → method selector (Cash / QR / Card segmented buttons) → cash view: "Cash received" display + numeric keypad + quick buttons "Exact / $5 / $10 / $20 / $50" + "Change $2.50" in green → full-width confirm button "Confirm cash payment · $12.50" → success screen: big green check, "ORD-000034 · Cash paid $12.50", "Change due $2.50" callout, "Next payment" button
Components: large touch keypad, segmented control, summary rows, success state
Color palette: espresso #2A1D15 primary, green for change/success, white card on #F5F5F6 (ensure dark-mode variant of confirm button)
Typography: Geist Sans, huge tabular amount displays
Style/mood: calm focused checkout, large numerals, cashier-speed
Framework/library reference: shadcn/ui, Tailwind CSS
Responsive: tablet-first
Reference: Square checkout / SumUp
```

## 7. Reports

```
Design a coffee-shop POS "Reports" page UI mockup with the following structure:

Layout: sidebar + main content, glass section cards stacked
Sections: header card "Reports — Completed order revenue and product performance" with period dropdown ("This Week", calendar icon, glass pop-in menu) + dark "Export Excel" button with download icon → 4 KPI cards → "Daily Sales · This Week" chart card → "Best Products" table → "Cup Stock by Size" section
Components:
- KPI cards: "Today Revenue $3.50" as HERO solid deep-green gradient card (#059669 → #052e16, white text, $ icon chip); "Today Orders 1" (brand-tint), "All Revenue $83.00" (soft green tint), "All Orders 12" (brand tint) — all with icon chips
- Chart card: Bar/Line/Area pill toggle, "$6.75 from 2 orders" caption, bars with "Jul 20 $3.25" labels
- Best Products table: columns PRODUCT / SOLD / REVENUE
- Stock section: pill "57 in stock · 3 out of stock", per-size cards ("Small — 20 cups"), red out-of-stock chips "Latte · Small"
Color palette: espresso #2A1D15, deep green #059669 hero, glass white/80 cards on #F5F5F6, red for out-of-stock
Typography: Geist Sans, bold tabular KPI numbers, uppercase table headers
Style/mood: clean analytics, frosted glass, generous whitespace
Framework/library reference: shadcn/ui, Tailwind CSS
Responsive: desktop-first, KPIs 2×2 on mobile
Reference: Stripe reports + Notion tables
```

## 8. Stock Management

```
Design a coffee-shop POS "Stock" page UI mockup with the following structure:

Layout: sidebar + main content
Sections: page header "Stock — Manage cup sizes and how many cups are in stock" → 3 summary cards → "Sizes" manager card (add/rename/delete size chips) → "Cup stock" section header with search input + "Out of stock only" checkbox → per-product stock rows
Components:
- Summary cards: "Cups in stock 57" HERO solid deep-green gradient (white text); "Products out 2" red-tinted card with red value; "Sizes out 3" green/red tinted by state
- Product rows: thumbnail + name + sold/capacity summary "12 / 20 sold · 8 in" + per-size lines with colored status dot (green in-stock / amber low / red out), inline qty inputs, capacity bars, Edit/Save buttons
Color palette: espresso #2A1D15, deep green #059669 hero, red #EF4444 / green #22C55E status, white cards on #F5F5F6
Typography: Geist Sans, tabular numbers everywhere
Style/mood: dense but calm inventory tool, inline editing
Framework/library reference: shadcn/ui, Tailwind CSS
Responsive: desktop-first
Reference: Shopify inventory
```

## 9. Product Management

```
Design a coffee-shop POS "Product Management" page UI mockup with the following structure:

Layout: sidebar + main content, glass header + toolbar + data table + right slide-over drawer for create/edit
Sections: header "Product Management — Manage products, prices, stock, sizes, and discounts" + "New product" button → toolbar: search "Search product, category, or size…" + custom category dropdown ("All categories (57)", glass pop-in menu with checkmarks, scrollable) + "Clear" → products table
Components:
- Table columns: product (thumbnail + name), category, price ("from $3.00"), stock cell (mini per-size bars with color dots, low-stock amber under 5), discount ("10%" or "—"), visible/hidden badge, row actions (edit / delete)
- Slide-over drawer form: image upload + gallery thumbnails, name, searchable category select, price, discount %, per-size rows (size select + $ price + stock + remove), availability toggle, Save/Cancel
Color palette: espresso #2A1D15 accents and focus rings, white/glass surfaces on #F5F5F6, amber low-stock, red delete
Typography: Geist Sans, medium-weight table text
Style/mood: modern admin CRUD, drawer-based editing, rounded-2xl
Framework/library reference: shadcn/ui, Tailwind CSS
Responsive: desktop-first
Reference: Shopify products + Linear side panel
```

## 10. Settings (Branding & Staff)

```
Design a coffee-shop POS "Settings" page UI mockup with the following structure:

Layout: sidebar + two-column: left section nav (220px, "General — App name & logo" / "Staff — Accounts & access"), right content card
Sections (General): "App branding" — logo upload with rounded preview + Change/Remove, app name input → "Theme colors" — Light mode / Dark mode segmented tab (sun/moon icons) + 4 color fields in 2×2 grid (Button color, Background color, Sidebar background, Sidebar active item) each with color swatch picker, hex input "#2a1d15 (default)", Reset link, and 8 preset swatch dots → "Save changes" button
Sections (Staff): staff list rows (avatar, name "(you)", @username, Admin/Cashier role pill, ⋮ menu: Edit / Permissions / Delete) + "Add user" button + modals: create user (name/username/password/role/page-access checkboxes), permissions grid of sidebar pages
Color palette: espresso #2A1D15, amber admin pills / blue cashier pills, white cards on #F5F5F6
Typography: Geist Sans, semibold section titles with muted hints
Style/mood: clean settings panel, instant live-preview feel for colors
Framework/library reference: shadcn/ui, Tailwind CSS
Responsive: mobile-first (nav becomes horizontal chips)
Reference: Vercel project settings
```

## 11. QR Code Page

```
Design a coffee-shop POS "Menu QR Code" page UI mockup with the following structure:

Layout: sidebar + main content, glass header + one content card
Sections: header "Menu QR Code — Print or share the public customer menu link" with outlined "Download QR" button (download icon) + solid "Print QR" button → card: large QR code (272px, white padded frame) left + right column: "Customer destination" pill, URL box "http://localhost:3000/menu", helper text "This admin page is for staff management only. The QR still opens the customer-facing menu at /menu."
Components: QR image card, pill badge, URL display box, primary/secondary button pair
Color palette: espresso #2A1D15 primary button, white card on #F5F5F6
Typography: Geist Sans
Style/mood: simple utility page, print-friendly
Framework/library reference: shadcn/ui, Tailwind CSS
Responsive: mobile-first (QR stacks above link)
Reference: Linktree QR share
```

## 12. Public Customer Menu

```
Design a public coffee-shop "Customer Menu" (scan-to-view, no ordering) UI mockup with the following structure:

Layout: mobile-first single column — pinned rich header + scrollable menu body
Sections: header (emerald/green gradient #047857→#14532d): logo chip + serif app name "POSCAFE" + tagline "Freshly brewed, made to order" + theme toggle + white search bar "Search a drink, pastry, or category…" + horizontal category chips ("All" active) → promo banner (red-orange gradient, shimmer): "TODAY ONLY — 20% OFF — On selected items, ask our staff" + 🍰 → category sections "Espresso (8)" with 2→5 column product card grid → footer "Prices in USD · Ask our staff to place your order"
Components: product cards — photo, red "−20%" badge, name in warm serif, 2-line description, price "from $3.50" in red with struck-through original; product detail page — image gallery with thumbnails, category pill, name, price, size list "S $3.00 / M $3.50 / L $4.00", description
Color palette: deep emerald header, amber-50 cream page, red price/discount accents, dark mode: stone-950 with amber accents
Typography: Fraunces serif display for names/headings (artisanal), Geist Sans body
Style/mood: warm food-delivery menu (Uber Eats-like) with artisanal café character
Framework/library reference: shadcn/ui, Tailwind CSS
Responsive: mobile-first (customers scan QR on phones)
Reference: Uber Eats menu + artisan café sites
```
