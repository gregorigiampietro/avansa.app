# Plan: Melhorar a tela de vendas

## Plan 1 — Status ML corretos, badges e metricas (Wave 1)

### Objective
Fix incorrect ML order status mapping, improve badge visuals, add metrics cards to orders page, and install missing shadcn components needed by all plans.

### Context
- `src/components/orders/orders-view.tsx` — current filter/view (has wrong status: "confirmed" not real ML status)
- `src/components/orders/order-table.tsx` — current table with PaymentStatusBadge and ShippingBadge
- `src/components/dashboard/stats-cards.tsx` — reference pattern for metrics cards
- `src/app/(dashboard)/orders/page.tsx` — server component that fetches orders
- `src/app/api/ml/orders/route.ts` — API with pagination support (already supports `status` filter)
- `src/types/database.ts` — Order type (has `status`, `payment_status`, `shipping_status` fields)
- `src/lib/utils/formatters.ts` — formatCurrency, formatPercent utilities

### Tasks

<task type="auto">
  <name>Task 1: Install shadcn components + fix ML status mapping + add OrderStatusBadge</name>
  <files>
    src/components/ui/calendar.tsx (new — shadcn)
    src/components/ui/popover.tsx (new — shadcn)
    src/components/ui/select.tsx (new — shadcn)
    src/components/ui/pagination.tsx (new — shadcn)
    src/components/orders/order-table.tsx
    src/components/orders/orders-view.tsx
  </files>
  <action>
    1. Install shadcn components: `npx shadcn@latest add calendar popover select pagination` — this will also install react-day-picker and date-fns as dependencies.

    2. In `orders-view.tsx`, replace STATUS_OPTIONS with correct ML API statuses from RESEARCH.md:
       - `payment_required` → "Pagamento pendente" (orange)
       - `payment_in_process` → "Em processamento" (yellow/orange)
       - `partially_paid` → "Parcialmente pago" (yellow)
       - `paid` → "Pago" (green)
       - `cancelled` → "Cancelado" (red)
       - `invalid` → "Invalido" (red/gray)
       Remove the non-existent "confirmed" status.

    3. In `order-table.tsx`, add a new `OrderStatusBadge` component (alongside existing PaymentStatusBadge) that renders the order-level `status` field with the correct colors per the mapping above. Use the existing badge pattern: `inline-flex items-center rounded-full bg-[color]/15 px-2 py-0.5 text-xs font-medium text-[color]` with brand colors (#CDFF00 for paid/positive, #FF9F0A for pending states, #FF453A for cancelled/invalid).

    4. Add a new "Status" column to the table (between "Envio" and existing columns, or replace if more appropriate) that shows the OrderStatusBadge using `order.status`. Keep PaymentStatusBadge and ShippingBadge as they are — they show different dimensions of the order.
  </action>
  <verify>
    npm run build
  </verify>
  <done>
    - shadcn calendar, popover, select, pagination components exist in src/components/ui/
    - STATUS_OPTIONS uses real ML API statuses (no "confirmed")
    - OrderStatusBadge renders correct labels/colors for all 6 ML order statuses
    - Table shows order status column with colored badges
    - Build passes with no TypeScript errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Add metrics cards to orders page</name>
  <files>
    src/components/orders/order-stats-cards.tsx (new)
    src/components/orders/orders-view.tsx
  </files>
  <action>
    1. Create `src/components/orders/order-stats-cards.tsx` as a client component following the pattern from `src/components/dashboard/stats-cards.tsx`. The component receives `orders: Order[]` and computes:
       - **Total de vendas**: count of orders (only those with status === "paid")
       - **Faturamento total**: sum of `total_amount` for paid orders
       - **Lucro liquido**: sum of `net_profit` for paid orders (color-coded: #CDFF00 if positive, #FF453A if negative)

       Use icons from lucide-react: ShoppingCart for sales count, DollarSign for revenue, TrendingUp for profit.
       Use the same card layout: `rounded-lg border border-border bg-card p-5` with `grid grid-cols-1 gap-4 sm:grid-cols-3`.
       Use formatCurrency from `@/lib/utils/formatters`.

    2. In `orders-view.tsx`, import and render `<OrderStatsCards orders={orders} />` between the filters section and the table. The cards must react to the current filtered orders (use the `orders` state, not `initialOrders`).
  </action>
  <verify>
    npm run build
  </verify>
  <done>
    - OrderStatsCards component renders 3 metric cards (vendas, faturamento, lucro)
    - Cards compute values from filtered orders (status === "paid")
    - Cards are visible above the orders table
    - Profit card shows green/red color based on value
    - Build passes
  </done>
</task>

---

## Plan 2 — Date range picker, busca, paginacao e ordenacao (Wave 2, depends on Plan 1)

### Objective
Add date range picker with custom dates, search field, client-side pagination with controls, and column sorting to the orders table.

### Context
- Plan 1 installed shadcn calendar, popover, select, pagination components
- `src/components/orders/orders-view.tsx` — will be updated with new filter state
- `src/components/orders/order-table.tsx` — will add sorting + pagination
- `src/app/api/ml/orders/route.ts` — already supports `page`, `pageSize`, `period` params; will add `dateFrom`/`dateTo` and `search` params

### Tasks

<task type="auto">
  <name>Task 1: Add date range picker + search + API params for dateFrom/dateTo/search</name>
  <files>
    src/components/orders/order-date-picker.tsx (new)
    src/components/orders/orders-view.tsx
    src/app/api/ml/orders/route.ts
  </files>
  <action>
    1. Update API route `src/app/api/ml/orders/route.ts`:
       - Add `dateFrom` and `dateTo` query params. When present, use `.gte("date_created", dateFrom)` and `.lte("date_created", dateTo)` on the Supabase query. These take precedence over the `period` shortcut.
       - Add `search` query param. When present, use `.or('item_title.ilike.%${search}%,buyer_nickname.ilike.%${search}%')` to search by product title or buyer nickname.

    2. Create `src/components/orders/order-date-picker.tsx` — a "use client" component that wraps shadcn Calendar (mode="range") in a Popover. Props: `dateRange: { from?: Date; to?: Date } | undefined`, `onDateRangeChange: (range) => void`. Display the selected range formatted as "DD/MM/YYYY - DD/MM/YYYY" in the trigger button, or "Selecionar periodo" when no range selected. Use CalendarIcon from lucide-react as button icon.

    3. In `orders-view.tsx`:
       - Expand OrderFilters type to add: `dateFrom: string | null`, `dateTo: string | null`, `search: string | null`, `page: number`, `pageSize: number`.
       - Replace the period `<select>` with a row that has: preset buttons (7d, 30d, 90d as `<Button variant="outline" size="sm">`) + the OrderDatePicker for custom range. When a preset is clicked, set period and clear dateFrom/dateTo. When custom range is selected, set dateFrom/dateTo and clear period.
       - Add a search `<Input>` (from shadcn) with placeholder "Buscar por produto ou comprador..." with a debounce of 400ms before triggering fetchOrders. Use a simple setTimeout/clearTimeout pattern (no external debounce lib).
       - Update `fetchOrders` to pass all new params: dateFrom, dateTo, search, page, pageSize.
       - Store pagination response (`total`, `totalPages`, `page`) in state.
  </action>
  <verify>
    npm run build
  </verify>
  <done>
    - Date range picker opens calendar popup for custom date selection
    - Preset buttons (7d, 30d, 90d) work as quick filters
    - Search input filters by product title or buyer nickname with debounce
    - API route accepts dateFrom, dateTo, search params
    - Pagination state tracked from API response
    - Build passes
  </done>
</task>

<task type="auto">
  <name>Task 2: Add column sorting and pagination controls to order table</name>
  <files>
    src/components/orders/order-table.tsx
    src/components/orders/orders-view.tsx
  </files>
  <action>
    1. In `orders-view.tsx`:
       - Add sort state: `sortField: string | null` (column key), `sortDirection: "asc" | "desc"`.
       - Update `fetchOrders` to pass `sortField` and `sortDirection` to the API.
       - Update API route to accept `sortField` (allowed: "date_created", "total_amount", "net_profit", "quantity") and `sortDirection` ("asc"/"desc"). Apply `.order(sortField, { ascending: sortDirection === "asc" })` — default remains "date_created" desc.

    2. In `order-table.tsx`:
       - Add props: `sortField`, `sortDirection`, `onSort: (field: string) => void`, `pagination: { page, pageSize, total, totalPages }`, `onPageChange: (page: number) => void`.
       - Make sortable column headers clickable (Date, Valor, Lucro, Qtd). Show ArrowUpDown icon from lucide when unsorted, ArrowUp/ArrowDown when sorted. Use `cursor-pointer select-none` on sortable headers. On click, call `onSort(fieldKey)`. Toggle direction if same field clicked again.
       - Below the table, render pagination using shadcn Pagination components: PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink. Show "Pagina X de Y" text and "Z vendas no total". Disable prev on page 1, disable next on last page.

    3. In `orders-view.tsx`, wire up:
       - `handleSort` callback: if same field, toggle direction; if new field, set asc. Then call fetchOrders.
       - `handlePageChange` callback: update page in filters, call fetchOrders.
       - Pass sort/pagination props to OrderTable.
  </action>
  <verify>
    npm run build
  </verify>
  <done>
    - Clicking sortable column headers sorts the table (toggles asc/desc)
    - Sort icons reflect current state (up/down/neutral)
    - Pagination controls appear below table with page numbers
    - Clicking page numbers fetches correct page from API
    - "Pagina X de Y" and total count displayed
    - Build passes
  </done>
</task>

---

## Plan 3 — Agrupamento opcional e filtros salvos (Wave 3, depends on Plan 2)

### Objective
Add optional order grouping (by day, product, or account) and localStorage-persisted saved filters.

### Context
- Plans 1-2 built the enhanced filter/sort/pagination system
- `src/components/orders/orders-view.tsx` — will add groupBy selector and saved filters
- `src/components/orders/order-table.tsx` — will add grouped rendering mode

### Tasks

<task type="auto">
  <name>Task 1: Add optional grouping (by day, product, account)</name>
  <files>
    src/components/orders/order-table.tsx
    src/components/orders/orders-view.tsx
  </files>
  <action>
    1. In `orders-view.tsx`:
       - Add `groupBy: string | null` to OrderFilters (values: null, "day", "product", "account").
       - Add a shadcn Select (from @/components/ui/select) for grouping: "Sem agrupamento", "Por dia", "Por produto", "Por conta". Place it next to the existing filters row.
       - Pass `groupBy` to OrderTable.

    2. In `order-table.tsx`:
       - Add prop `groupBy: string | null` and `accounts?: MlAccount[]` (for account name lookup).
       - When groupBy is not null, group orders client-side:
         - "day": group by `formatDate(order.date_created)` (DD/MM/YYYY)
         - "product": group by `order.item_title ?? "Sem titulo"`
         - "account": group by `order.ml_account_id` (display account nickname from accounts prop)
       - Render grouped view: for each group, show a collapsible header row spanning all columns with group name + summary (count of orders, sum of total_amount for that group). Use a disclosure pattern with ChevronRight/ChevronDown icon from lucide. All groups start expanded.
       - When groupBy is null, render the flat table as before (no change).
       - Use `useMemo` for the grouping computation.
  </action>
  <verify>
    npm run build
  </verify>
  <done>
    - GroupBy selector appears in filters with 4 options
    - Selecting "Por dia" groups orders by date with collapsible sections
    - Selecting "Por produto" groups by product title
    - Selecting "Por conta" groups by ML account
    - "Sem agrupamento" shows flat table
    - Group headers show order count and total amount
    - Groups are collapsible (click to expand/collapse)
    - Build passes
  </done>
</task>

<task type="auto">
  <name>Task 2: Add saved filters with localStorage persistence</name>
  <files>
    src/components/orders/saved-filters.tsx (new)
    src/components/orders/orders-view.tsx
  </files>
  <action>
    1. Create `src/components/orders/saved-filters.tsx` — a "use client" component for managing saved filter presets.
       - Define types:
         ```ts
         interface SavedFilter {
           name: string
           filters: {
             accountId?: string | null
             period?: string | null
             dateFrom?: string | null
             dateTo?: string | null
             status?: string | null
             search?: string | null
             groupBy?: string | null
             sortField?: string | null
             sortDirection?: "asc" | "desc"
           }
         }
         ```
       - localStorage keys: `"avansa:orders:savedFilters"` (SavedFilter[]) and `"avansa:orders:lastFilter"` (filter state to restore on mount).
       - Props: `currentFilters`, `onApplyFilter: (filters) => void`.
       - UI: A row with a shadcn Select showing saved filter names + "Salvar filtro atual" button. When "Salvar" clicked, prompt for a name (use a simple inline Input that appears). Show a small X button on each saved filter to delete it.
       - Max 10 saved filters.

    2. In `orders-view.tsx`:
       - On mount, check `"avansa:orders:lastFilter"` in localStorage. If exists, parse and apply as initial filter state (instead of all-null defaults).
       - On every filter change (in updateFilter), save current filters to `"avansa:orders:lastFilter"`.
       - Render `<SavedFilters>` component above the filter row.
       - Wire `onApplyFilter` to set all filter state and trigger fetchOrders.
  </action>
  <verify>
    npm run build
  </verify>
  <done>
    - User can save current filter configuration with a name
    - Saved filters appear in a dropdown and can be applied with one click
    - Saved filters persist in localStorage across sessions
    - Last used filter state is restored on page load
    - Saved filters can be deleted
    - Maximum 10 saved filters enforced
    - Build passes
  </done>
</task>
