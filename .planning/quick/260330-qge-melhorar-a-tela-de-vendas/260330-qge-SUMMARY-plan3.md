---
phase: 260330-qge
plan: plan3
subsystem: orders
tags: [grouping, saved-filters, localStorage, UX]
key-files:
  created:
    - src/components/orders/saved-filters.tsx
  modified:
    - src/components/orders/orders-view.tsx
    - src/components/orders/order-table.tsx
decisions:
  - Used client-side grouping with useMemo for performance
  - Extracted OrderRow component for reuse in flat and grouped rendering
  - Used localStorage keys prefixed with "avansa:" to avoid collisions
  - Max 10 saved filters to prevent localStorage bloat
metrics:
  tasks: 2
  completed: "2026-03-30"
---

# Phase 260330-qge Plan 3: Agrupamento opcional e filtros salvos Summary

Client-side order grouping by day/product/account with collapsible sections, plus localStorage-persisted saved filter presets with last-used filter restoration on page load.

## Task Summary

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Optional grouping (day, product, account) | ee18d22 | Added groupBy Select, GroupHeader with collapse, OrderRow extraction, useMemo grouping |
| 2 | Saved filters with localStorage | 6073189 | SavedFilters component, loadLastFilter/saveLastFilter helpers, mount restore, persist on change |

## Implementation Details

### Task 1: Optional Grouping

- Added `groupBy` field to `OrderFilters` type (values: null, "day", "product", "account")
- Added shadcn Select dropdown in filter row with options: "Sem agrupamento", "Por dia", "Por produto", "Por conta"
- Extracted `OrderRow` component from inline row rendering for reuse in both flat and grouped modes
- Created `buildGroups()` function that groups orders client-side by date (DD/MM/YYYY), item_title, or ml_account_id
- Group headers are collapsible (ChevronDown/ChevronRight) with order count and total amount summary
- All groups start expanded; toggling is tracked via `collapsedGroups` Set state
- Account grouping resolves account IDs to nicknames via the `accounts` prop

### Task 2: Saved Filters with localStorage

- Created `saved-filters.tsx` with `SavedFilters` component and exported helpers (`loadLastFilter`, `saveLastFilter`)
- `SavedFilterValues` interface captures all filter dimensions (account, period, dates, status, search, groupBy, sort)
- localStorage keys: `avansa:orders:savedFilters` (SavedFilter[]) and `avansa:orders:lastFilter` (current state)
- On mount, `orders-view.tsx` reads last filter from localStorage and restores it (including search input text)
- Every `updateFilter` call persists current filter state to localStorage
- Save UI: inline name input appears on click, Enter to save, Escape to cancel
- Saved filters rendered as outline buttons with hover-visible delete (X) button
- Max 10 saved filters enforced (oldest trimmed on overflow)
- Duplicate names overwrite existing filter with same name

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all features are fully wired with real data sources.

## Self-Check: PASSED

- [x] src/components/orders/saved-filters.tsx exists
- [x] src/components/orders/orders-view.tsx modified with groupBy + saved filters
- [x] src/components/orders/order-table.tsx modified with grouping support
- [x] Commit ee18d22 exists
- [x] Commit 6073189 exists
- [x] Build passes with no TypeScript errors
