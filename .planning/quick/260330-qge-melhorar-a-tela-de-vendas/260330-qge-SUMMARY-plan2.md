---
phase: 260330-qge
plan: plan2
subsystem: orders
tags: [date-picker, search, sorting, pagination, filters]
key-files:
  created:
    - src/components/orders/order-date-picker.tsx
  modified:
    - src/components/orders/orders-view.tsx
    - src/components/orders/order-table.tsx
    - src/app/api/ml/orders/route.ts
decisions:
  - Used setTimeout/clearTimeout debounce pattern for search instead of external lib
  - Used base-ui Popover with Calendar for date range picker (consistent with project shadcn setup)
  - Server-side sorting via API (sortField/sortDirection params) instead of client-side
  - Smart page number display with ellipsis for large page counts
metrics:
  completed: "2026-03-30"
  tasks: 2
  files: 4
---

# Plan 2: Date range picker, busca, paginacao e ordenacao Summary

Date range picker with custom dates, search field with debounce, server-side column sorting, and pagination controls for the orders table.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add date range picker + search + API params | d8c0416 | order-date-picker.tsx, orders-view.tsx, route.ts |
| 2 | Add column sorting and pagination controls | bd5cabe | order-table.tsx, orders-view.tsx |

## What Was Built

### Task 1: Date Range Picker + Search + API Updates
- **OrderDatePicker component**: Wraps shadcn Calendar (mode="range") in a Popover. Displays selected range as DD/MM/YYYY format with CalendarIcon. Supports Brazilian Portuguese locale via date-fns ptBR.
- **Period preset buttons**: Quick filter buttons for 7d, 30d, 90d with active state highlighting (green border/bg when selected).
- **Search input**: Text input with Search icon, debounced at 400ms, searches by product title or buyer nickname.
- **API route updates**: Added dateFrom/dateTo params (take precedence over period shortcut), search param with ilike on item_title and buyer_nickname, sortField/sortDirection params with allowlist validation.
- **Pagination state**: orders-view now tracks pagination info from API response (page, pageSize, total, totalPages).

### Task 2: Column Sorting + Pagination Controls
- **Sortable column headers**: Date, Qtd, Valor, and Lucro columns are clickable. ArrowUpDown icon when unsorted, ArrowUp/ArrowDown when sorted (highlighted in brand green).
- **Pagination controls**: Renders shadcn Pagination below the table with Previous/Next buttons and page number links. Smart ellipsis for large page counts. Shows "Pagina X de Y -- Z vendas no total".
- **Sort toggle**: Clicking same column toggles asc/desc, clicking new column starts with asc.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all features are fully wired to the API and functional.

## Self-Check: PASSED
