# Codebase Concerns

**Analysis Date:** 2026-03-30

## Tech Debt

**No Input Validation Library:**
- Issue: All API routes validate request bodies manually with ad-hoc `if` checks instead of using a schema validation library (e.g., Zod). This is error-prone and inconsistent across endpoints.
- Files: `src/app/api/ml/products/[id]/edit/route.ts`, `src/app/api/ml/products/bulk/route.ts`, `src/app/api/ml/products/[id]/costs/route.ts`
- Impact: Potential for unexpected input shapes to slip through; validation logic is duplicated and easy to miss edge cases.
- Fix approach: Add Zod (already in node_modules as a transitive dependency). Create shared schemas in `src/types/` and validate at the top of each route handler.

**Duplicated Margin Calculation Logic:**
- Issue: Margin calculation exists in two places with slightly different implementations -- `src/lib/utils/calculations.ts` (the canonical `calculateMargin`) and an inline duplicate in `src/app/api/ml/products/[id]/costs/route.ts` (lines 93-106). The inline version recalculates manually instead of calling the shared utility.
- Files: `src/lib/utils/calculations.ts`, `src/app/api/ml/products/[id]/costs/route.ts`
- Impact: If the margin formula changes (e.g., new cost components), the costs endpoint would silently diverge from the sync logic.
- Fix approach: Replace the inline calculation in the costs route with a call to `calculateMargin()`.

**Duplicated Order Mapping Logic:**
- Issue: The order-to-DB-row mapping is duplicated between `src/lib/mercadolivre/sync-orders.ts` (lines 90-126) and `src/lib/mercadolivre/webhook-processor.ts` (lines 101-154). Both construct `OrderInsert` objects with identical field mappings.
- Files: `src/lib/mercadolivre/sync-orders.ts`, `src/lib/mercadolivre/webhook-processor.ts`
- Impact: Bug fixes or new fields must be updated in two places.
- Fix approach: Extract a shared `mapOrderToRow()` utility function.

**Net Profit Calculation Ignores Packaging/Shipping/Taxes:**
- Issue: In both `sync-orders.ts` and `webhook-processor.ts`, net profit is calculated as `paid_amount - ml_fee - cost_price`. This ignores packaging_cost, other_costs, shipping_cost, and tax_percent, which are included in the product margin calculation.
- Files: `src/lib/mercadolivre/sync-orders.ts` (lines 98-100), `src/lib/mercadolivre/webhook-processor.ts` (lines 127-129)
- Impact: Order-level profit figures are overstated compared to product-level margins, creating inconsistent financial data for users.
- Fix approach: Use the full margin formula (or `calculateMargin()`) when computing order net profit.

**Only First Item Per Order Is Tracked:**
- Issue: Orders with multiple items only store the first item's data (`order.order_items[0]`). Multi-item orders lose data for subsequent items.
- Files: `src/lib/mercadolivre/sync-orders.ts` (line 91), `src/lib/mercadolivre/webhook-processor.ts` (line 109)
- Impact: Revenue and cost attribution is inaccurate for multi-item orders.
- Fix approach: Either create an `order_items` table for line-level detail, or sum fees/quantities across all items.

**Password Change Does Not Verify Current Password:**
- Issue: The settings page collects "current password" but never sends it to the backend. `supabase.auth.updateUser({ password })` does not require re-authentication, so any session with a valid token can change the password without knowing the old one.
- Files: `src/components/settings/settings-view.tsx` (lines 30-68)
- Impact: If a session is hijacked (e.g., XSS, shared computer), the attacker can change the password without knowing the original.
- Fix approach: Call `supabase.auth.signInWithPassword()` with the current password first to re-verify, or use Supabase's `reauthenticate()` method.

## Security Considerations

**Webhook Endpoint Has No Authentication:**
- Risk: The POST `/api/webhooks/mercadolivre` endpoint accepts any request without verifying that it originates from Mercado Livre. There is no signature validation, IP allowlist, or shared secret.
- Files: `src/app/api/webhooks/mercadolivre/route.ts`
- Current mitigation: Payload is validated for required fields, and the ML account lookup provides a weak filter (ml_user_id must exist). But any attacker who knows a valid ml_user_id can inject fake webhook events.
- Recommendations: Implement webhook signature verification if ML supports it, or at minimum validate the `application_id` field matches the app's `ML_APP_ID`.

**SQL Injection via ilike Search:**
- Risk: The products API route interpolates user-provided `search` directly into an ilike filter: `query.or(\`title.ilike.%${search}%,sku.ilike.%${search}%\`)`. While Supabase's PostgREST escapes values, the pattern construction does not escape special ilike characters (`%`, `_`).
- Files: `src/app/api/ml/products/route.ts` (line 77)
- Current mitigation: PostgREST parameterizes the value, so SQL injection is not possible. However, a user could craft a search like `%` to match everything or use `_` as single-char wildcards.
- Recommendations: Escape `%` and `_` in the search input before interpolation, or sanitize special characters.

**Access Tokens Stored in Supabase Without Encryption:**
- Risk: ML access_token and refresh_token are stored as plain text in the `ml_accounts` table. If the database is compromised, all ML tokens are exposed.
- Files: `src/app/api/auth/mercadolivre/callback/route.ts` (lines 68-82), `src/lib/mercadolivre/api.ts` (lines 25-79)
- Current mitigation: Supabase RLS ensures users can only see their own accounts. The service_role_key is only used server-side.
- Recommendations: Consider encrypting tokens at rest using an application-level encryption key (e.g., AES-256-GCM with a key from env vars).

**OAuth State Parameter Missing:**
- Risk: The OAuth authorize flow does not include a `state` parameter. While PKCE mitigates CSRF for the token exchange, a `state` parameter provides defense-in-depth and is an OAuth 2.0 best practice.
- Files: `src/lib/mercadolivre/oauth.ts` (lines 37-50), `src/app/api/auth/mercadolivre/authorize/route.ts`
- Current mitigation: PKCE code_verifier in HttpOnly cookie provides CSRF protection for the token exchange.
- Recommendations: Add a random `state` parameter, store it alongside the code_verifier cookie, and verify it in the callback.

**Admin Client Usage Pattern:**
- Risk: Several routes create an admin Supabase client (bypassing RLS) after manually verifying ownership. Any future developer forgetting the ownership check while using `createAdminClient()` would expose all data.
- Files: `src/app/api/ml/products/[id]/edit/route.ts`, `src/app/api/ml/products/bulk/route.ts`, `src/app/api/ml/products/[id]/costs/route.ts`, `src/app/api/ml/accounts/[id]/disconnect/route.ts`
- Current mitigation: Ownership is checked before admin operations in all current routes.
- Recommendations: Prefer using the RLS-enabled client wherever possible. Consider a wrapper that enforces ownership verification before returning the admin client.

## Performance Bottlenecks

**Full Order Sync Fetches All Historical Orders:**
- Problem: `syncOrders()` paginates through ALL orders for a seller with no date filter. For a seller with thousands of historical orders, this makes every sync increasingly slow.
- Files: `src/lib/mercadolivre/sync-orders.ts` (lines 58-71)
- Cause: No `date_created_from` filter is applied to the ML API search. On every sync, all orders ever created are re-fetched and re-upserted.
- Improvement path: Add a date filter using the last sync timestamp (e.g., `date_created_from` = last sync time minus a small buffer). Only sync new/updated orders incrementally.

**Sequential ML API Calls During Product Sync:**
- Problem: Fee lookups in `syncProducts()` are done sequentially for each unique price/listing_type/category combination. For sellers with diverse catalogs, this can result in hundreds of sequential HTTP requests.
- Files: `src/lib/mercadolivre/sync.ts` (lines 61-76)
- Cause: The fee cache loop iterates items one-by-one with `await` inside the loop.
- Improvement path: Batch the unique fee lookups using `Promise.allSettled()` with a concurrency limiter (e.g., 5-10 concurrent requests).

**Cron Sync Processes All Accounts Sequentially:**
- Problem: The `sync-data` cron processes each ML account one after another. With many accounts, this could exceed Vercel's function timeout (typically 10s for hobby, 60s for pro).
- Files: `src/app/api/cron/sync-data/route.ts` (line 87)
- Cause: Sequential `for` loop over accounts, each performing full product + order + inventory sync.
- Improvement path: Process accounts in parallel with a concurrency limit. Consider splitting into per-account cron jobs or using a queue system.

**No API Response Caching:**
- Problem: No caching layer exists for ML API responses or Supabase queries. Repeated page loads trigger fresh database queries and potentially fresh ML API calls.
- Files: All API routes under `src/app/api/ml/`
- Cause: `next: { revalidate: 0 }` is explicitly set on ML API fetch calls, and no caching headers are returned from API routes.
- Improvement path: Add `Cache-Control` headers for read-only endpoints (products list, orders list). Consider SWR/stale-while-revalidate patterns on the client side.

## Reliability Concerns

**No Retry Logic for ML API Calls:**
- Problem: All ML API requests use a single attempt. Transient failures (network blips, 429 rate limits, 5xx from ML) cause immediate errors.
- Files: `src/lib/mercadolivre/api.ts` (lines 88-106, 111-135)
- Impact: Sync operations fail entirely on a single transient error. Webhook processing fails and marks events as "processed" even on transient errors (preventing retry).
- Fix approach: Add exponential backoff retry logic (2-3 attempts) to `mlGet`/`mlPut`/`mlPost`, with special handling for 429 (rate limit) responses.

**Webhook "Fire and Forget" May Lose Events:**
- Problem: The webhook handler processes events asynchronously with `processWebhookEvent(eventId).catch(...)`. If the serverless function instance is recycled before processing completes, the event is lost despite being marked as saved.
- Files: `src/app/api/webhooks/mercadolivre/route.ts` (lines 72-79)
- Impact: Events can be saved to `webhook_events` but never processed, and there is no background worker to pick up unprocessed events.
- Fix approach: Either process synchronously (ML allows a few seconds before timeout), or implement a separate cron/worker that picks up unprocessed webhook_events.

**Webhook Error Handling Marks Failed Events as Processed:**
- Problem: When `processWebhookEvent` fails, it catches the error and marks the event as `processed: true` anyway (line 87-93 of webhook-processor.ts). This prevents any retry mechanism.
- Files: `src/lib/mercadolivre/webhook-processor.ts` (lines 82-94)
- Impact: Permanently lost data for any event that fails due to transient issues.
- Fix approach: Add a `processing_error` column or separate `status` field. Mark as "error" instead of "processed". Add a retry worker for errored events.

**Token Refresh Race Condition:**
- Problem: Multiple concurrent requests for the same ML account can trigger simultaneous token refreshes. If two requests both detect the token is expired and both call `refreshAccessToken()`, the second refresh invalidates the first's new token.
- Files: `src/lib/mercadolivre/api.ts` (lines 25-79)
- Impact: One of the concurrent requests will fail with an invalid token error.
- Fix approach: Implement a per-account mutex/lock for token refresh (e.g., using a database advisory lock or in-memory lock with a Map).

**Sync Deletes Products Not Returned by ML:**
- Problem: After syncing, `syncProducts()` deletes all products from the DB that were not in the current sync batch. If the ML API returns a partial result due to an error or pagination bug, legitimate products get deleted.
- Files: `src/lib/mercadolivre/sync.ts` (lines 184-191)
- Impact: Data loss -- products and their associated costs/inventory data are permanently deleted.
- Fix approach: Soft-delete (mark as "inactive" or "not_found") instead of hard delete. Or add a safety check: only delete if the sync fetched items successfully and the count is within an expected range.

## Scalability Concerns

**Vercel Function Timeout Risk for Large Syncs:**
- Problem: Product sync involves fetching all item IDs, then multi-getting details in batches of 20, then fetching fees one-by-one, then fetching shipping in batches of 5. For a seller with 1000+ items, this can easily take 2-5+ minutes.
- Files: `src/lib/mercadolivre/sync.ts`, `src/app/api/ml/sync/route.ts`, `src/app/api/cron/sync-data/route.ts`
- Current capacity: Works for small sellers (< 200 items). Likely times out for sellers with 500+ items.
- Limit: Vercel Serverless functions have a 10s (hobby) or 60s (pro) timeout. Even with Vercel Pro, a full sync of 1000 items is borderline.
- Scaling path: Move sync to a background job system (e.g., Vercel Edge Functions with streaming, Inngest, QStash, or a dedicated worker). Break large syncs into chunks.

**No Database Pagination for Large Datasets:**
- Problem: `syncInventoryStatus()` fetches ALL products for an account in a single query (`select("id, ml_item_id, available_quantity").eq("ml_account_id", accountId)`) without pagination.
- Files: `src/lib/mercadolivre/inventory.ts` (lines 146-149)
- Current capacity: Fine for < 1000 products.
- Limit: Supabase has a default row limit (1000). Large accounts may silently get truncated results.
- Scaling path: Add pagination to the products query, or increase the Supabase `limit` explicitly.

## Missing Infrastructure

**No Automated Tests:**
- Problem: Zero test files exist in the `src/` directory. No test framework is configured (no jest.config, vitest.config, or test scripts in package.json).
- Files: `package.json` (only has `dev`, `build`, `start`, `lint` scripts)
- Impact: Any change can introduce regressions undetected. Margin calculations, token refresh logic, sync operations, and ownership checks are all critical business logic with no test coverage.
- Priority: High. At minimum, add unit tests for `src/lib/utils/calculations.ts`, `src/lib/mercadolivre/api.ts` (token refresh), and integration tests for API route authorization checks.

**No Error Monitoring/Observability:**
- Problem: All error handling uses `console.error()` / `console.warn()`. There is no error tracking service (Sentry, Datadog, etc.) and no structured logging.
- Files: All files -- every catch block logs to console.
- Impact: Errors in production are invisible unless someone checks Vercel logs. No alerting, no error grouping, no user-impact tracking.
- Priority: High. Add Sentry or similar. Critical for a SaaS handling financial data.

**No Request Logging or Audit Trail:**
- Problem: Mutations (price changes, stock updates, bulk actions) are not logged beyond the database update. There is no audit trail showing who changed what and when.
- Files: `src/app/api/ml/products/[id]/edit/route.ts`, `src/app/api/ml/products/bulk/route.ts`
- Impact: Cannot debug user-reported issues ("my price changed unexpectedly") or detect abuse.
- Priority: Medium. Add an activity_log table or structured logging for all write operations.

**No Health Check Endpoint:**
- Problem: No `/api/health` or similar endpoint exists for monitoring uptime and service health.
- Files: N/A
- Impact: Cannot set up external monitoring (UptimeRobot, etc.) with granularity beyond "is the site up."
- Priority: Low.

## Fragile Areas

**Middleware Route Protection:**
- Files: `src/lib/supabase/middleware.ts` (lines 38-43)
- Why fragile: Protected routes are hardcoded as individual string checks (`pathname.startsWith("/dashboard")`, `/products`, `/orders`, `/accounts`, `/settings`). Adding a new dashboard route (e.g., `/reports`) without updating the middleware leaves it unprotected. Additionally, the boolean logic has a potential operator precedence issue: `!user && pathname.startsWith("/dashboard") || !user && pathname.startsWith("/products")` -- the `||` has lower precedence than `&&`, but the intent relies on each `!user &&` being checked separately.
- Safe modification: Refactor to use a single prefix check (e.g., check if path is under the `(dashboard)` group) or maintain an array of protected prefixes. Add parentheses for clarity.
- Test coverage: None.

**Product Grouping Logic:**
- Files: `src/components/products/product-table.tsx` (lines 129-179, `groupProducts` function)
- Why fragile: Complex logic that pairs catalog and traditional listings by `catalog_product_id`. Has a bug at line 152: when the first product seen is not `catalog_listing`, it is assigned to both `catalog` and `traditional` fields of the map entry (`catalog: product` when `!product.catalog_listing`).
- Safe modification: Add unit tests before modifying. The function should be extracted to a utility file.
- Test coverage: None.

## Dependencies at Risk

**Next.js 14 is Outdated:**
- Risk: `next@14.2.35` while Next.js 15 has been stable. Next.js 14 will eventually stop receiving security patches.
- Impact: Missing performance improvements, new features (React 19 support), and eventually security fixes.
- Migration plan: Upgrade to Next.js 15. Review breaking changes (async params, which this codebase already handles). Update React to v19.

**No Dependency Lock Review Process:**
- Risk: No `npm audit` step in CI/CD. No Dependabot or Renovate configured.
- Impact: Vulnerable dependencies go undetected.
- Migration plan: Add `npm audit` to CI. Configure Dependabot.

## Test Coverage Gaps

**Zero Test Coverage:**
- What's not tested: Everything. Specifically critical untested areas:
  - Margin/profit calculations (`src/lib/utils/calculations.ts`)
  - Token refresh and expiry logic (`src/lib/mercadolivre/api.ts`)
  - Ownership/authorization checks in all API routes
  - OAuth PKCE flow (`src/lib/mercadolivre/oauth.ts`)
  - Webhook event processing (`src/lib/mercadolivre/webhook-processor.ts`)
  - Product sync with deletion logic (`src/lib/mercadolivre/sync.ts`)
  - Bulk action processing (`src/app/api/ml/products/bulk/route.ts`)
- Files: Entire `src/` directory
- Risk: Any refactor or feature addition can break core business logic (financial calculations, data sync, auth) without detection.
- Priority: High. Start with pure function unit tests (calculations, data mapping) and API route integration tests (auth, ownership).

---

*Concerns audit: 2026-03-30*
