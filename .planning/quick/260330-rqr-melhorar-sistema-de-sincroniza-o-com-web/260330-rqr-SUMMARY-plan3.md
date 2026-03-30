---
phase: 260330-rqr
plan: plan3
subsystem: ui/sync-feedback
tags: [sync-status, polling, ui-indicator, header, products, orders]
dependency-graph:
  requires: [260330-rqr-plan2]
  provides: [sync-status-ui, webhook-health-indicator]
  affects: [header, products-view, orders-view]
tech-stack:
  added: []
  patterns: [polling-hook, compact-expanded-variants, relative-time-formatter]
key-files:
  created:
    - src/hooks/use-sync-status.ts
    - src/components/sync/sync-status-indicator.tsx
  modified:
    - src/components/layout/header.tsx
    - src/components/products/products-view.tsx
    - src/components/orders/orders-view.tsx
decisions:
  - "Used polling (60s) instead of websocket for simplicity"
  - "Placed expanded indicators inside client view components rather than server page components to access filter state"
  - "Aggregate mode in header shows worst-case status across all accounts"
  - "Built custom relative time formatter to avoid adding date-fns dependency"
metrics:
  duration: 121s
  completed: 2026-03-30T23:20:47Z
  tasks: 1/1
  files-created: 2
  files-modified: 3
---

# Phase 260330-rqr Plan 3: Feedback Visual na UI Summary

Sync status indicators with 60s polling, compact header dot with relative time, expanded per-page view with last sync date/item count/Automatico-Manual badge, and spinning icon during active sync.

## What Was Built

### useSyncStatus Hook (`src/hooks/use-sync-status.ts`)
- Client-side hook calling `GET /api/ml/sync-status` with optional `accountId` filter
- Polls every 60 seconds via `setInterval`, refetches on `accountId` change
- Returns `{ data, isLoading, error, refetch }`
- Typed with `AccountSyncStatus` interface matching the API response

### SyncStatusIndicator - Compact (`src/components/sync/sync-status-indicator.tsx`)
- Shows a color-coded dot (green=automatic, yellow=manual, red=errors) + "Atualizado ha X min"
- Aggregate mode: shows worst status across all accounts
- Spinning `RefreshCw` icon when any sync is in progress
- Loading skeleton with pulse animation

### SyncStatusExpanded (`src/components/sync/sync-status-indicator.tsx`)
- Accepts `syncType` (products/orders) and optional `accountId` props
- Shows last sync date (DD/MM/YYYY HH:mm in America/Sao_Paulo), items synced count
- Badge: "Automatico" (green) or "Manual" (yellow) based on webhook activity in last 24h
- Spinning icon during active sync, contextual loading skeleton

### Header Integration (`src/components/layout/header.tsx`)
- Added `SyncStatusIndicator` (compact) as client child component in header right section
- Replaces the empty placeholder with functional sync health display

### Products View Integration (`src/components/products/products-view.tsx`)
- Added `SyncStatusExpanded` with `syncType="products"` above sync buttons
- Passes current `accountId` filter to scope status to selected account

### Orders View Integration (`src/components/orders/orders-view.tsx`)
- Added `SyncStatusExpanded` with `syncType="orders"` above sync buttons
- Passes current `accountId` filter to scope status to selected account

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused function `getDotColor`**
- **Found during:** Task 1 verification (build)
- **Issue:** Per-account `getDotColor` function was defined but not used (only aggregate version was needed)
- **Fix:** Removed the unused function to pass lint
- **Files modified:** `src/components/sync/sync-status-indicator.tsx`
- **Commit:** 8e8f48c

## Known Stubs

None. All components are wired to the live `/api/ml/sync-status` endpoint created in Plan 2.

## Verification

- `npm run build` passes with no errors
- All text in Portuguese (pt-BR)
- TypeScript strict mode satisfied

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8e8f48c | feat(260330-rqr-plan3): add sync status UI indicators |

## Self-Check: PASSED
