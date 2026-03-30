# Plan: Melhorar sistema de sincronizacao com webhooks ML

**Plans:** 3 sequential plans (wave 1 -> 2 -> 3)
**Estimated effort:** ~30% context per executor

---

## Plan 1: Webhook Robustness (Wave 1)

### Objective

Harden the webhook pipeline: deduplicate events, track error status separately from processed, retry failed events in the existing cron, and make the items webhook processor complete (fees + shipping + margin recalculation).

### Context Files

```
@src/app/api/webhooks/mercadolivre/route.ts
@src/lib/mercadolivre/webhook-processor.ts
@src/app/api/cron/sync-data/route.ts
@src/lib/mercadolivre/sync.ts (reuse fee/shipping fetch patterns)
@src/lib/mercadolivre/api.ts
@src/types/database.ts
@supabase/migrations/001_initial_schema.sql
```

### Task 1: Migration + Types — webhook_events schema upgrade

**Files:**
- `supabase/migrations/005_webhook_events_robustness.sql`
- `src/types/database.ts`

**Action:**

Create migration `005_webhook_events_robustness.sql` that:

1. Add column `ml_notification_id text` to `webhook_events` (nullable for existing rows).
2. Add column `status text not null default 'pending'` to `webhook_events`. Values: `pending`, `processing`, `completed`, `error`.
3. Add column `error_message text` to `webhook_events`.
4. Add column `retry_count integer not null default 0` to `webhook_events`.
5. Add column `processed_at timestamptz` to `webhook_events`.
6. Add unique index on `ml_notification_id` WHERE `ml_notification_id IS NOT NULL` (partial unique index — allows nulls for old rows).
7. Add index on `(status, retry_count)` for the cron retry query.
8. Migrate existing data: `UPDATE webhook_events SET status = 'completed' WHERE processed = true; UPDATE webhook_events SET status = 'pending' WHERE processed = false;`
9. Drop column `processed` (replaced by `status`).

Update `src/types/database.ts` — `webhook_events` table types:
- Row: add `ml_notification_id: string | null`, `status: string`, `error_message: string | null`, `retry_count: number`, `processed_at: string | null`. Remove `processed: boolean`.
- Insert: add `ml_notification_id?: string | null`, `status?: string`, `error_message?: string | null`, `retry_count?: number`, `processed_at?: string | null`. Remove `processed?: boolean`.
- Update: same pattern. Remove `processed?: boolean`.

**Verify:**
```
npx supabase db reset --linked 2>&1 | tail -5
# OR: Confirm migration SQL is syntactically valid by reviewing it
npm run build 2>&1 | grep -i error | head -20
```

**Done:** Migration file exists with all columns, types updated, build passes with no type errors.

---

### Task 2: Dedup + Error Status + Complete Item Processing + Cron Retry

**Files:**
- `src/app/api/webhooks/mercadolivre/route.ts`
- `src/lib/mercadolivre/webhook-processor.ts`
- `src/app/api/cron/sync-data/route.ts`

**Action:**

**A) Webhook endpoint (`route.ts`):**

Update the `MlWebhookPayload` interface to include `_id: string` (optional — some old events may not have it).

On insert, add `ml_notification_id: payload._id ?? null` and `status: 'pending'`. Use `.upsert()` with `onConflict: 'ml_notification_id'` and `ignoreDuplicates: true` — if `ml_notification_id` already exists, skip (dedup). If `_id` is missing from payload, fall back to normal insert (no dedup for those).

Remove the `processed: false` field from insert (column no longer exists).

Only call `processWebhookEvent()` if the upsert actually inserted (check `data` is not null). Keep fire-and-forget pattern. Still return 200 in <500ms.

**B) Webhook processor (`webhook-processor.ts`):**

Replace `markProcessed()` with `markStatus(supabase, eventId, status: 'completed' | 'error', errorMessage?: string)` that updates `status`, `error_message`, and `processed_at` (set to `new Date().toISOString()` for completed/error).

At the start of `processWebhookEvent`, set `status = 'processing'` on the event row.

In the catch block: call `markStatus(supabase, eventId, 'error', err.message)` instead of marking as processed. This preserves the event for retry.

**Complete item processing** — Replace `processItemEvent` to match the full sync pattern from `sync.ts`:
1. Fetch item via `mlGet<MlItem>(accountId, resource)` (already done).
2. Fetch ML fees via `getListingPrices(accountId, item.price, item.listing_type_id, item.category_id)`. Wrap in try/catch, default to 0 on error.
3. Fetch shipping via `getShippingOptions(accountId, item.id)`. Extract `list_cost` from standard option (same logic as `sync.ts` lines 89-96). Default to 0 on error.
4. Fetch existing product costs from DB: `select cost_price, packaging_cost, other_costs, tax_percent from products where ml_account_id = accountId and ml_item_id = item.id`.
5. Call `calculateMargin()` from `@/lib/utils/calculations` with all values.
6. Update product with ALL fields: title, thumbnail, category_id, status, listing_type, price, available_quantity, sold_quantity, permalink, sku, condition, catalog_product_id, catalog_listing, ml_fee, shipping_cost, net_margin, margin_percent, last_synced_at.

Import `getListingPrices`, `getShippingOptions` from `./api` and `calculateMargin` from `@/lib/utils/calculations`.

**C) Cron retry (`sync-data/route.ts`):**

After the existing account sync loop (after the `for (const account of accounts)` block ends), add a new section: "Retry failed webhook events".

1. Query: `select * from webhook_events where status = 'error' and retry_count < 3 order by received_at asc limit 50`.
2. For each event, increment `retry_count` and set `status = 'processing'`.
3. Call `processWebhookEvent(event.id)` (await it — cron is not time-constrained like the webhook endpoint).
4. Log results: `[cron/sync-data] Webhook retry: {N} events reprocessed, {M} succeeded, {K} failed.`

Import `processWebhookEvent` from `@/lib/mercadolivre/webhook-processor`.

**Verify:**
```
npm run build
```

**Done:**
- Duplicate webhook events (same `_id`) are ignored on insert.
- Failed events get `status: 'error'` with error message preserved.
- Cron retries failed events up to 3 times.
- Item webhook updates fees, shipping, and margin (not just basic fields).
- Webhook endpoint still responds 200 within 500ms (fire-and-forget maintained).

---

## Plan 2: Sync Incremental + Sync Status API (Wave 2)

### Objective

Make manual sync incremental (only fetch changed items/orders) and create an API endpoint to query sync status per account.

### Context Files

```
@src/lib/mercadolivre/sync.ts
@src/lib/mercadolivre/sync-orders.ts
@src/lib/mercadolivre/api.ts
@src/app/api/ml/sync/route.ts
@src/types/database.ts
```

### Task 1: Incremental Sync for Products and Orders

**Files:**
- `src/lib/mercadolivre/sync.ts`
- `src/lib/mercadolivre/sync-orders.ts`

**Action:**

**A) Incremental product sync (`sync.ts`):**

Add an optional `incremental?: boolean` parameter to `syncProducts(accountId, mlUserId, options?: { incremental?: boolean })`.

When `incremental = true`:
1. Query `sync_logs` for the latest completed products sync for this account: `select completed_at from sync_logs where ml_account_id = accountId and sync_type = 'products' and status = 'completed' order by completed_at desc limit 1`.
2. If found, set `lastSyncDate = completed_at`.
3. Still fetch ALL item IDs (this is fast, just IDs). Use existing `getAllItemIds()`.
4. Query existing products from DB: `select ml_item_id, last_synced_at from products where ml_account_id = accountId`.
5. Build a `Set` of existing ml_item_ids and a `Map<ml_item_id, last_synced_at>`.
6. Filter `itemIds` to only those that are: (a) NOT in the existing set (new items), or (b) all items if there's no `lastSyncDate` (first sync). Since ML API doesn't support `last_updated.from` on items search, we must multi-get ALL items but can skip the fee/shipping fetch for items whose `last_synced_at` is recent (within 1 hour). This is the pragmatic approach.
7. Actually, simpler approach: fetch all items via multi-get (already batched), but only fetch fees/shipping for items where `price` or `listing_type_id` or `category_id` differs from DB values. Compare fetched item data with existing DB data. If no changes to price/listing/category, reuse existing ml_fee/shipping_cost/margin values.

To implement this efficiently:
- After fetching items via `getItems()`, load existing products: `select ml_item_id, price, listing_type, category_id, ml_fee, shipping_cost, net_margin, margin_percent from products where ml_account_id = accountId`.
- Build a `Map<string, ExistingProduct>`.
- For each item, check if `price === existing.price && listing_type_id === existing.listing_type && category_id === existing.category_id`. If yes, reuse `existing.ml_fee`, `existing.shipping_cost`, `existing.net_margin`, `existing.margin_percent` — skip fee/shipping API calls for that item.
- Only call `getListingPrices` and `getShippingOptions` for items with changed price/listing/category or new items.

This reduces API calls dramatically for incremental syncs where most items haven't changed price.

When `incremental = false` (default): keep current behavior unchanged.

Do NOT change the deletion logic (removing products not in ML) — that should still run on full sync only. When incremental, skip the delete step.

Update `sync_logs` entry with `sync_type: 'products_incremental'` when incremental (or keep 'products' — either way is fine, but mark it so the sync-status API can distinguish).

**B) Incremental order sync (`sync-orders.ts`):**

Add an optional `incremental?: boolean` parameter to `syncOrders(accountId, mlUserId, options?: { incremental?: boolean })`.

When `incremental = true`:
1. Query `sync_logs` for latest completed orders sync: same pattern as products.
2. If `lastSyncDate` exists, add `&date_created.from={lastSyncDate}` to the ML API search query. This IS supported by the orders API.
3. Also add `&sort=date_desc` (already present).
4. This naturally returns only new orders since the last sync.

When `incremental = false`: keep current full sync behavior.

**C) Update manual sync route (`sync/route.ts`):**

Pass `{ incremental: true }` to `syncProducts()` when called from the manual sync button. The cron (full sync every 6h) keeps using `incremental: false`.

**Verify:**
```
npm run build
```

**Done:**
- Manual sync only fetches fee/shipping for items with changed price/listing/category.
- Manual order sync only fetches orders created since last sync.
- Full sync (cron) behavior unchanged.
- Build passes with no errors.

---

### Task 2: Sync Status API Endpoint

**Files:**
- `src/app/api/ml/sync-status/route.ts` (new)

**Action:**

Create `GET /api/ml/sync-status` endpoint. Authenticated via Supabase (same pattern as `sync/route.ts`).

Query params: `?accountId={id}` (optional — if omitted, return status for all user accounts).

Response shape:
```typescript
{
  accounts: Array<{
    accountId: string;
    nickname: string;
    lastSync: {
      products: { completedAt: string | null; itemsSynced: number; status: string } | null;
      orders: { completedAt: string | null; itemsSynced: number; status: string } | null;
    };
    webhookHealth: {
      eventsLast24h: number;
      errorsLast24h: number;
      mode: 'automatic' | 'manual';  // 'automatic' if eventsLast24h > 0
    };
    syncInProgress: boolean;  // true if any sync_log has status='running' for this account
  }>
}
```

Implementation:
1. Auth check (get user, 401 if not authenticated).
2. Fetch user's ml_accounts (filtered by accountId if provided).
3. For each account, run 3 queries:
   - Latest completed sync_log per sync_type (`products`, `orders`): `select sync_type, status, items_synced, completed_at from sync_logs where ml_account_id = ? and status = 'completed' order by completed_at desc limit 1` — do two queries or use `distinct on`.
   - Webhook health: `select count(*) filter (where status = 'completed') as completed, count(*) filter (where status = 'error') as errors from webhook_events where ml_user_id = ? and received_at > now() - interval '24 hours'`. Use the admin client since webhook_events doesn't join well with RLS from server client. Actually, use the authenticated supabase client — RLS policy exists for webhook_events via ml_user_id join. But the count queries with filters may be complex — use raw SQL via `.rpc()` or just two separate count queries.
   - Simpler approach: `select count(*) from webhook_events where ml_user_id = ? and received_at > now() - interval '24 hours'` (total) and `select count(*) from webhook_events where ml_user_id = ? and received_at > now() - interval '24 hours' and status = 'error'` (errors).
   - Running sync: `select count(*) from sync_logs where ml_account_id = ? and status = 'running'`.

Since we're using the server-side Supabase client with RLS, and webhook_events has a policy based on ml_user_id, we need to know the ml_user_id for each account. Get it from the ml_accounts query.

For efficiency, batch queries where possible. Use `Promise.all` for parallel queries per account.

Return JSON response.

**Verify:**
```
npm run build
```

**Done:**
- `GET /api/ml/sync-status` returns last sync info, webhook health, and running status per account.
- Authenticated — returns 401 for unauthenticated requests.
- Build passes.

---

## Plan 3: Feedback Visual na UI (Wave 3)

### Objective

Show sync status in the UI: a SyncStatusIndicator component in the header, "ultima sincronizacao" per page, and automatic/manual badge per account.

### Context Files

```
@src/components/layout/header.tsx
@src/app/(dashboard)/products/page.tsx
@src/app/(dashboard)/orders/page.tsx
@src/app/api/ml/sync-status/route.ts (created in Plan 2)
```

### Task 1: SyncStatusIndicator Component + Integration

**Files:**
- `src/components/sync/sync-status-indicator.tsx` (new)
- `src/hooks/use-sync-status.ts` (new)
- `src/components/layout/header.tsx`
- `src/app/(dashboard)/products/page.tsx`
- `src/app/(dashboard)/orders/page.tsx`

**Action:**

**A) Custom hook `use-sync-status.ts`:**

Create a client-side hook `useSyncStatus(accountId?: string)` that:
1. Calls `GET /api/ml/sync-status?accountId={accountId}` on mount and every 60 seconds (polling — simpler than websocket, per discretion).
2. Returns `{ data, isLoading, error, refetch }`.
3. Uses `useState` + `useEffect` with `setInterval`. No external library needed.
4. When `accountId` changes, refetch immediately.
5. Expose `refetch()` so the sync button can trigger immediate refresh after sync completes.

**B) SyncStatusIndicator component (`sync-status-indicator.tsx`):**

A "use client" component that uses `useSyncStatus`. Props: `accountId?: string`, `syncType?: 'products' | 'orders'`.

Display:
- If loading: small skeleton pulse (Tailwind `animate-pulse` on a small rounded div).
- If data:
  - Show a small dot indicator: green if webhook mode is "automatic" (events in last 24h), yellow if "manual" (no recent webhook events), red if there are errors.
  - Text: "Atualizado ha X min" using `formatDistanceToNow` — implement a simple relative time formatter (avoid adding date-fns just for this). Use a helper that returns "agora", "ha 1 min", "ha X min", "ha X h", "ha X dias" based on the diff in seconds.
  - If `syncInProgress`: show a spinning sync icon (use Lucide `RefreshCw` with `animate-spin` class).

Compact variant for header: just the dot + "Atualizado ha X min" inline.
Expanded variant for page sections: includes sync type label ("Produtos" / "Vendas"), last sync date formatted as "DD/MM/YYYY HH:mm", items synced count, and the automatic/manual badge.

Badge: `<span className="...">Automatico</span>` (green bg) or `<span className="...">Manual</span>` (yellow bg). Use Tailwind badges pattern: `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium`.

All text in Portuguese (pt-BR).

**C) Header integration (`header.tsx`):**

Make Header a client component (add "use client") OR keep it server and pass sync data as props. Simpler: keep Header as server component, add SyncStatusIndicator as a client child.

Add `<SyncStatusIndicator />` (no accountId — shows aggregate status) in the header's right section, before the existing placeholder div. It should be subtle — small text, muted colors.

Actually, the header doesn't know the selected account. Two approaches:
1. SyncStatusIndicator fetches ALL accounts status (no accountId param) and shows the "worst" status (if any has errors, show red).
2. Pass selectedAccountId from page context.

Go with option 1 for the header (aggregate) — show the most recent sync across all accounts and overall webhook health.

**D) Products page integration (`products/page.tsx`):**

The products page is a server component. Add a client wrapper or insert `<SyncStatusIndicator syncType="products" />` at the top of the page content, below the header. Since it needs to know the selected account (the page has account filtering), pass the `accountId` if one is selected, or omit for all.

Look at how the page currently handles account selection. If there's an account filter dropdown, the selected accountId should be passed to SyncStatusIndicator.

Add the expanded SyncStatusIndicator variant between the Header and the ProductsView component. Show: "Ultima sincronizacao de produtos: DD/MM/YYYY HH:mm — X itens | Automatico/Manual".

**E) Orders page integration (`orders/page.tsx`):**

Same pattern as products page but with `syncType="orders"`.

**Verify:**
```
npm run build
```

**Done:**
- Header shows aggregate sync health indicator (dot + relative time).
- Products page shows last product sync time, item count, and automatic/manual badge.
- Orders page shows last order sync time, item count, and automatic/manual badge.
- Spinning icon appears when sync is in progress.
- All text in Portuguese (pt-BR).
- Build passes with no errors.

---

## Summary

| Plan | Wave | Focus | Key Files Modified |
|------|------|-------|-------------------|
| 1 | 1 | Webhook robustness: dedup, error status, complete item processing, cron retry | migration, database.ts, route.ts, webhook-processor.ts, cron/sync-data |
| 2 | 2 | Incremental sync + sync-status API | sync.ts, sync-orders.ts, sync/route.ts, new sync-status/route.ts |
| 3 | 3 | UI feedback: SyncStatusIndicator, header, products/orders pages | new components, header.tsx, page files |
