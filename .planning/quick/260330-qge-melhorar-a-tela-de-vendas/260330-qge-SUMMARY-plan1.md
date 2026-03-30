---
phase: 260330-qge
plan: plan1
subsystem: orders
tags: [orders, badges, metrics, ml-status]
key-files:
  created:
    - src/components/orders/order-stats-cards.tsx
    - src/components/ui/calendar.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/select.tsx
    - src/components/ui/pagination.tsx
  modified:
    - src/components/orders/orders-view.tsx
    - src/components/orders/order-table.tsx
    - package.json
decisions:
  - Added Status column before Payment column to show order-level status separately from payment status
metrics:
  duration: 125s
  completed: 2026-03-30T22:24:49Z
  tasks: 2/2
  files-created: 6
  files-modified: 3
---

# Plan 1: Status ML corretos, badges e metricas Summary

Fixed ML order status mapping to use real API values, added color-coded OrderStatusBadge, installed 4 shadcn components, and added 3 metrics cards (vendas, faturamento, lucro) to the orders page.

## Tasks Completed

### Task 1: Install shadcn components + fix ML status mapping + add OrderStatusBadge
**Commit:** `c7d6d57`

- Installed shadcn calendar, popover, select, pagination components (needed by Plans 2-3)
- Replaced incorrect STATUS_OPTIONS (removed fake "confirmed") with 6 real ML API statuses: payment_required, payment_in_process, partially_paid, paid, cancelled, invalid
- Created OrderStatusBadge component with brand colors (#CDFF00 for paid, #FF9F0A for pending states, #FF453A for cancelled/invalid)
- Added "Status" column to orders table between Lucro and Pagamento columns

### Task 2: Add metrics cards to orders page
**Commit:** `6bce78a`

- Created OrderStatsCards client component following stats-cards.tsx pattern
- 3 cards: Total de vendas (count), Faturamento total (sum), Lucro liquido (sum) -- all computed from paid orders only
- Profit card color-coded: #CDFF00 if positive, #FF453A if negative
- Cards use filtered orders state so they react to filter changes

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- All 6 created files exist on disk
- Commits c7d6d57 and 6bce78a verified in git log
- Build passes with no TypeScript errors
