---
phase: "260330-rqr"
plan: "plan2"
subsystem: "sync"
tags: [incremental-sync, sync-status-api, performance]
dependency_graph:
  requires: [plan1-webhook-robustness]
  provides: [incremental-sync, sync-status-endpoint]
  affects: [sync.ts, sync-orders.ts, sync/route.ts]
tech_stack:
  patterns: [incremental-sync-with-fee-caching, parallel-query-batching]
key_files:
  created:
    - src/app/api/ml/sync-status/route.ts
  modified:
    - src/lib/mercadolivre/sync.ts
    - src/lib/mercadolivre/sync-orders.ts
    - src/app/api/ml/sync/route.ts
decisions:
  - "Incremental product sync compares price/listing_type/category to skip fee/shipping API calls for unchanged items"
  - "Incremental order sync uses ML API date_created.from filter with last sync timestamp"
  - "Sync status endpoint uses admin client for webhook_events queries to avoid RLS complexity"
  - "sync_type distinguishes full vs incremental: products vs products_incremental, orders vs orders_incremental"
metrics:
  duration: "~4 min"
  completed: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
---

# Plan 2: Sync Incremental + Sync Status API Summary

Incremental product/order sync reduces ML API calls by skipping fee/shipping fetches for unchanged items and filtering orders by date; new sync-status endpoint exposes per-account sync health.

## Tasks Completed

### Task 1: Incremental Sync for Products and Orders
**Commit:** `25faa03`

**Products (`sync.ts`):**
- Added `SyncProductsOptions` with `incremental?: boolean` parameter
- When incremental, loads existing product data and compares `price`, `listing_type`, `category_id` for each fetched item
- Items with unchanged price/listing/category reuse existing `ml_fee`, `shipping_cost`, `net_margin`, `margin_percent` — no fee/shipping API calls needed
- Only items with changed pricing attributes or new items trigger `getListingPrices` and `getShippingOptions`
- Product deletion step skipped during incremental sync (only full sync removes stale items)
- Sync log tagged as `products_incremental` to distinguish from full syncs

**Orders (`sync-orders.ts`):**
- Added `OrderSyncOptions` with `incremental?: boolean` parameter
- When incremental, queries `sync_logs` for last completed orders sync timestamp
- Appends `&order.date_created.from={lastSyncDate}` to ML API search query
- Sync log tagged as `orders_incremental`

**Manual sync route (`sync/route.ts`):**
- Now passes `{ incremental: true }` to `syncProducts()` for manual trigger
- Cron route unchanged (full sync every 6h)

### Task 2: Sync Status API Endpoint
**Commit:** `b270c15`

Created `GET /api/ml/sync-status` with:
- Authentication via Supabase (401 for unauthenticated)
- Optional `?accountId` query param filter
- Per-account response with:
  - `lastSync.products` and `lastSync.orders` (completedAt, itemsSynced, status)
  - `webhookHealth` (eventsLast24h, errorsLast24h, mode: automatic/manual)
  - `syncInProgress` boolean (true if any sync_log has status='running')
- All queries per account run in parallel via `Promise.all` for efficiency
- Uses admin client for webhook_events count queries

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED
