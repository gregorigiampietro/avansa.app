# Architecture

**Analysis Date:** 2026-03-30

## Pattern Overview

**Overall:** Server-rendered Next.js monolith (App Router) with Supabase BaaS backend, deployed on Vercel as a serverless application.

**Key Characteristics:**
- Server Components fetch data directly from Supabase, passing props to client components
- API Route Handlers serve as the backend layer for mutations and external API interactions
- Three-tier Supabase client strategy: browser client (anon), server client (cookie-based), admin client (service_role)
- Mercado Livre integration via REST API wrapper with automatic token management
- No client-side state management library; state lives in `useState` within "view" components
- Data synchronization via cron jobs (Vercel Cron) and webhooks (fire-and-forget async processing)

## Layers

**Presentation Layer (Pages + Components):**
- Purpose: Render UI, handle user interactions
- Location: `src/app/` (pages) and `src/components/` (reusable components)
- Contains: Server Components (pages) that fetch data, Client Components ("use client" views) that handle interactivity
- Depends on: Supabase server client, database types, UI components
- Used by: End users via browser

**API Layer (Route Handlers):**
- Purpose: Handle mutations, proxy external API calls, enforce auth/ownership
- Location: `src/app/api/`
- Contains: REST endpoints for CRUD operations, sync triggers, webhook receiver, cron jobs
- Depends on: Supabase server/admin clients, ML API wrapper, sync/inventory libs
- Used by: Client components via `fetch()`, Vercel Cron scheduler, ML webhook system

**Business Logic Layer (lib/mercadolivre/):**
- Purpose: Encapsulate all Mercado Livre API interaction and data sync logic
- Location: `src/lib/mercadolivre/`
- Contains: OAuth flow (`oauth.ts`), API wrapper (`api.ts`), sync engines (`sync.ts`, `sync-orders.ts`, `inventory.ts`), webhook processing (`webhook-processor.ts`)
- Depends on: Supabase admin client, ML external API
- Used by: API route handlers, cron jobs

**Data Access Layer (lib/supabase/):**
- Purpose: Provide typed Supabase clients for different contexts
- Location: `src/lib/supabase/`
- Contains: `client.ts` (browser), `server.ts` (Server Components/Route Handlers), `admin.ts` (service_role for background jobs), `middleware.ts` (session refresh)
- Depends on: `@supabase/ssr`, `@supabase/supabase-js`, `src/types/database.ts`
- Used by: All other layers

**Utilities Layer:**
- Purpose: Shared formatting, calculation, and CSS helpers
- Location: `src/lib/utils.ts`, `src/lib/utils/`
- Contains: `calculations.ts` (margin formula), `formatters.ts` (currency/date/percent), `utils.ts` (Tailwind `cn()` helper)
- Used by: Components, sync logic, API routes

## Data Flow

**Page Load (Server Component):**

1. Browser requests `/products`
2. Middleware (`src/middleware.ts`) intercepts, refreshes Supabase session cookie via `updateSession()`
3. Dashboard layout (`src/app/(dashboard)/layout.tsx`) creates server Supabase client, verifies `auth.getUser()`, redirects to `/login` if unauthenticated
4. Page Server Component (`src/app/(dashboard)/products/page.tsx`) fetches ML accounts and products from Supabase using RLS-enabled server client
5. Data passed as `initialProducts` props to client component (`ProductsView`)
6. Client component renders with local state for filtering/sorting/selection

**User-Initiated Sync:**

1. User clicks "Sincronizar" in `ProductsView`
2. Client component POSTs to `/api/ml/sync` with `{ accountId }`
3. Route handler authenticates user, verifies account ownership via Supabase RLS query
4. Calls `syncProducts(accountId, mlUserId)` which:
   - Creates `sync_logs` entry (status: "running")
   - Fetches all item IDs from ML API (paginated, active + paused)
   - Multi-gets item details in batches of 20
   - Fetches ML fees (deduplicated by price/listing_type/category)
   - Fetches shipping costs (batched with concurrency limit of 5)
   - Preserves existing user-entered costs (cost_price, packaging_cost, etc.)
   - Recalculates margins using `calculateMargin()`
   - Upserts products in batches of 100
   - Deletes products no longer in ML
   - Updates `sync_logs` (status: "completed")
5. Then calls `syncInventoryStatus(accountId)` for detailed fulfillment data
6. Returns JSON result to client

**Product Edit (ML API + Local DB):**

1. User edits price/stock/status in `ProductEditSheet`
2. Client PUTs to `/api/ml/products/[id]/edit`
3. Route handler authenticates, verifies ownership via admin client join
4. Calls ML API mutation (`updateItemPrice`, `updateItemStock`, `pauseItem`, or `activateItem`)
5. On success, updates local DB via admin client (bypasses RLS since ownership already verified)
6. Returns updated product to client, which updates local state

**Webhook Processing:**

1. ML sends POST to `/api/webhooks/mercadolivre`
2. Handler immediately returns 200 (ML requirement)
3. Saves event to `webhook_events` table (processed: false)
4. Fires `processWebhookEvent(eventId)` asynchronously (no await)
5. Processor fetches event, finds associated ML account by `ml_user_id`
6. Based on topic (`orders_v2`, `items`), fetches resource from ML API and upserts into DB
7. Marks event as processed

**Cron Jobs (Vercel Cron):**

1. `refresh-tokens` runs hourly: finds accounts with tokens expiring within 1 hour, refreshes via ML OAuth, marks failed accounts as "expired"
2. `sync-data` runs every 6 hours: for each active account, syncs products, orders, and inventory sequentially

**State Management:**
- No global state library (no Redux, Zustand, or Context)
- Pages fetch data server-side and pass as props
- Client "view" components (`ProductsView`, `OrdersView`, `InventoryView`) manage local state with `useState`
- After mutations, client components update local state optimistically or refetch by reloading

## Key Abstractions

**Supabase Client Hierarchy:**
- Purpose: Enforce security boundaries between contexts
- `createClient()` in `src/lib/supabase/client.ts`: Browser-side, anon key, RLS-enforced
- `createClient()` in `src/lib/supabase/server.ts`: Server Components/Route Handlers, cookie-based auth, RLS-enforced
- `createAdminClient()` in `src/lib/supabase/admin.ts`: Service role, bypasses RLS, for cron/webhooks/background tasks
- Pattern: Verify ownership with RLS client first, then use admin client for mutations if needed

**ML API Wrapper (`src/lib/mercadolivre/api.ts`):**
- Purpose: Authenticated HTTP client for Mercado Livre API
- Provides generic `mlGet<T>`, `mlPut<T>`, `mlPost<T>` with auto token management
- `getValidToken()` checks expiry (5-minute buffer), refreshes if needed, marks account as "expired" on failure
- Domain helpers: `getAllItemIds`, `getItems`, `updateItemPrice`, `updateItemStock`, `pauseItem`, `activateItem`, `getListingPrices`, `getShippingOptions`

**Sync Engines:**
- Purpose: Full data synchronization from ML API to local Supabase DB
- `syncProducts()` in `src/lib/mercadolivre/sync.ts`: Products + fees + shipping costs
- `syncOrders()` in `src/lib/mercadolivre/sync-orders.ts`: Orders with cost/profit calculation
- `syncInventoryStatus()` in `src/lib/mercadolivre/inventory.ts`: Fulfillment stock breakdown
- Pattern: Create sync_log -> fetch from ML -> upsert to DB -> update sync_log. All return `{ syncLogId, itemsSynced, status, errorMessage? }`

**Database Types (`src/types/database.ts`):**
- Purpose: Type-safe database access throughout the app
- Manually maintained (matches Supabase `gen types` output format)
- Provides `Row`, `Insert`, `Update` types for each table
- Convenience aliases exported: `MlAccount`, `Product`, `Order`, `WebhookEvent`, `InventoryStatus`, `SyncLog`

## Entry Points

**Root Layout (`src/app/layout.tsx`):**
- Triggers: All page renders
- Responsibilities: Sets HTML lang, loads Inter font, renders Toaster (sonner) for notifications

**Middleware (`src/middleware.ts`):**
- Triggers: Every request matching the path pattern (excludes static files)
- Responsibilities: Refreshes Supabase session, redirects unauthenticated users from dashboard routes, redirects authenticated users from auth routes

**Dashboard Layout (`src/app/(dashboard)/layout.tsx`):**
- Triggers: All dashboard page renders
- Responsibilities: Server-side auth check via `supabase.auth.getUser()`, renders Sidebar + main content area

**Webhook Endpoint (`src/app/api/webhooks/mercadolivre/route.ts`):**
- Triggers: ML webhook notifications (POST)
- Responsibilities: Immediate 200 response, event persistence, async processing

**Cron Endpoints:**
- `src/app/api/cron/refresh-tokens/route.ts`: Hourly token refresh (protected by CRON_SECRET)
- `src/app/api/cron/sync-data/route.ts`: 6-hourly full data sync (protected by CRON_SECRET)

## Error Handling

**Strategy:** Try/catch at every layer with Portuguese error messages for user-facing responses. No centralized error handler or error boundary components.

**Patterns:**
- API routes: Wrap entire handler in try/catch, return `{ error: string }` with appropriate HTTP status
- ML API wrapper: Throws on non-OK responses with status code and error body in message
- Sync engines: Catch errors, update sync_log with error status and message, return error result (never throw to caller)
- Webhook processor: Never throws; catches all errors, logs them, marks event as processed to prevent retry loops
- Token refresh failures: Mark ML account as "expired" so user sees they need to reconnect
- Client components: Use `toast.error()` (sonner) for user-facing error notifications

## Cross-Cutting Concerns

**Logging:**
- `console.log/info/warn/error` throughout (no structured logging library)
- Prefixed with context tags: `[webhook]`, `[cron/refresh-tokens]`, `[cron/sync-data]`, `[webhook-processor]`, `[ML OAuth Authorize]`, `[ML OAuth Callback]`

**Validation:**
- Manual validation in API route handlers (check required fields, validate types/ranges)
- No validation library (no Zod, Yup, etc.)
- Body types declared as TypeScript interfaces with `as` assertions

**Authentication:**
- Supabase Auth (email/password) via `@supabase/ssr`
- Session managed via cookies (middleware refreshes automatically)
- Server-side auth check: `supabase.auth.getUser()` in layouts and route handlers
- Client-side logout: `supabase.auth.signOut()` in Sidebar

**Authorization:**
- RLS policies on all tables enforce `auth.uid() = user_id` (direct or via ml_accounts join)
- API routes additionally verify account ownership before mutations
- Cron/webhook routes use admin client (service_role) to bypass RLS
- Cron routes protected by `CRON_SECRET` Bearer token

**Database Schema Relationships:**
```
auth.users (Supabase managed)
  |
  v  (user_id FK)
ml_accounts
  |
  v  (ml_account_id FK, CASCADE)
products ---------> inventory_status (product_id FK, CASCADE)
  |
  v  (ml_account_id FK, CASCADE)
orders

ml_accounts (ml_user_id lookup)
  |
  v
webhook_events (ml_user_id, no FK)

ml_accounts
  |
  v  (ml_account_id FK, CASCADE)
sync_logs
```

**Caching:** None. No in-memory cache, no Redis. ML API calls use `next: { revalidate: 0 }` to disable Next.js fetch cache.

---

*Architecture analysis: 2026-03-30*
