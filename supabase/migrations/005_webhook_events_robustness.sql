-- ============================================================
-- Migration 005: webhook_events robustness
-- Adds deduplication, status tracking, error handling, and retry support
-- ============================================================

-- 1. Add new columns
alter table public.webhook_events
  add column ml_notification_id text,
  add column status text not null default 'pending',
  add column error_message text,
  add column retry_count integer not null default 0,
  add column processed_at timestamptz;

-- 2. Migrate existing data from boolean `processed` to `status`
update public.webhook_events set status = 'completed' where processed = true;
update public.webhook_events set status = 'pending' where processed = false;

-- 3. Drop the old `processed` column (replaced by `status`)
alter table public.webhook_events drop column processed;

-- 4. Drop the old index on `processed` (column no longer exists)
drop index if exists idx_webhook_events_processed;

-- 5. Partial unique index for deduplication (allows nulls for old rows)
create unique index idx_webhook_events_ml_notification_id
  on public.webhook_events (ml_notification_id)
  where ml_notification_id is not null;

-- 6. Index for cron retry query
create index idx_webhook_events_status_retry
  on public.webhook_events (status, retry_count);
