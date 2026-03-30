---
phase: 260330-rqr
plan: plan1
subsystem: webhooks
tags: [webhook, dedup, retry, margin-calculation, robustness]
dependency-graph:
  requires: []
  provides: [webhook-dedup, webhook-error-tracking, webhook-complete-processing, cron-retry]
  affects: [webhook_events-schema, webhook-processor, cron-sync-data]
tech-stack:
  added: []
  patterns: [status-based-tracking, partial-unique-index, fire-and-forget-async]
key-files:
  created:
    - supabase/migrations/005_webhook_events_robustness.sql
  modified:
    - src/types/database.ts
    - src/app/api/webhooks/mercadolivre/route.ts
    - src/lib/mercadolivre/webhook-processor.ts
    - src/app/api/cron/sync-data/route.ts
decisions:
  - Used partial unique index on ml_notification_id for dedup (allows null for legacy rows)
  - Status-based tracking (pending/processing/completed/error) replaces boolean processed
  - Cron retries up to 3 times with max 50 events per run to avoid overloading
metrics:
  duration: 210s
  completed: 2026-03-30
  tasks: 2/2
---

# Phase 260330-rqr Plan 1: Webhook Robustness Summary

Hardened webhook pipeline with dedup via ml_notification_id, status-based error tracking replacing boolean processed, complete item processing (fees + shipping + margin), and cron-based retry for failed events.

## Task Results

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Migration + Types -- webhook_events schema upgrade | 5900342 | Done |
| 2 | Dedup + Error Status + Complete Item Processing + Cron Retry | 01883a5 | Done |

## Key Changes

### Task 1: Migration + Types
- Created migration `005_webhook_events_robustness.sql` with 5 new columns: `ml_notification_id`, `status`, `error_message`, `retry_count`, `processed_at`
- Added partial unique index on `ml_notification_id` for deduplication (WHERE NOT NULL)
- Added composite index on `(status, retry_count)` for efficient cron retry queries
- Migrated existing data from `processed` boolean to `status` text, then dropped `processed` column
- Updated TypeScript types in `database.ts` to match new schema

### Task 2: Dedup + Error Status + Complete Item Processing + Cron Retry
- **Webhook endpoint**: Uses `payload._id` as `ml_notification_id` for dedup via upsert with `ignoreDuplicates: true`. Falls back to normal insert when `_id` is absent.
- **Webhook processor**: Replaced `markProcessed()` with `markStatus()` supporting pending/processing/completed/error states. Failed events preserve error message for debugging.
- **Complete item processing**: `processItemEvent` now fetches ML fees via `getListingPrices`, shipping via `getShippingOptions`, existing product costs from DB, and recalculates margin using `calculateMargin` -- matching the full sync pattern from `sync.ts`.
- **Cron retry**: After account sync loop, queries up to 50 events with `status='error' AND retry_count < 3`, increments retry_count, and reprocesses via `processWebhookEvent`.
- Fire-and-forget async pattern maintained for <500ms webhook response time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed references to removed `processed` column in webhook-processor.ts and route.ts**
- **Found during:** Task 1
- **Issue:** After removing `processed` column from types, existing code in `webhook-processor.ts` (lines 50, 88-90) and `route.ts` (line 53) still referenced `processed: true/false`, causing build failure.
- **Fix:** Updated references to use new `status` field. This was minimal to unblock the build; full rewrite happened in Task 2.
- **Files modified:** `src/lib/mercadolivre/webhook-processor.ts`, `src/app/api/webhooks/mercadolivre/route.ts`
- **Commit:** 5900342

## Known Stubs

None -- all functionality is fully wired.

## Self-Check: PASSED
