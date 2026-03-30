# External Integrations

**Analysis Date:** 2026-03-30

## APIs & External Services

### Mercado Livre API

**Base URLs:**
- API: `https://api.mercadolibre.com` (used in `src/lib/mercadolivre/api.ts`)
- Auth: `https://auth.mercadolibre.com` (used in `src/lib/mercadolivre/oauth.ts`)
- Site ID: `MLB` (Brazil)

**Authentication:** OAuth 2.0 Bearer token
- Header: `Authorization: Bearer {access_token}`
- Tokens expire in 6 hours (21600s)
- Auto-refresh with 5-minute buffer before expiry (`TOKEN_REFRESH_BUFFER_MS` in `src/lib/mercadolivre/api.ts`)

**HTTP Client:** Native `fetch` API (no Axios or other HTTP libraries)
- Generic helpers: `mlGet<T>()`, `mlPut<T>()`, `mlPost<T>()` in `src/lib/mercadolivre/api.ts`
- All requests use `next: { revalidate: 0 }` to bypass Next.js cache

**Endpoints consumed:**

| Purpose | Method | Endpoint | Used in |
|---------|--------|----------|---------|
| User info | GET | `/users/me` | `api.ts` → `getMlUser()` |
| Search items by seller | GET | `/users/{id}/items/search?status={s}&offset={o}&limit=50` | `api.ts` → `fetchItemIdsByStatus()` |
| Multi-get items (batch 20) | GET | `/items?ids={csv}` | `api.ts` → `getItems()` |
| Commission calculation | GET | `/sites/MLB/listing_prices?price={p}&listing_type_id={t}&category_id={c}` | `api.ts` → `getListingPrices()` |
| Shipping options | GET | `/items/{id}/shipping_options?zip_code=01310100` | `api.ts` → `getShippingOptions()` |
| Update item (price/stock/status) | PUT | `/items/{id}` | `api.ts` → `updateItemPrice()`, `updateItemStock()`, `pauseItem()`, `activateItem()` |
| Search orders | GET | `/orders/search?seller={id}&sort=date_desc&offset={o}&limit=50` | `sync-orders.ts` |
| Order detail | GET | `/orders/{id}` | `webhook-processor.ts` |
| Item detail | GET | `/items/{id}` | `webhook-processor.ts` |
| Inventory status (basic) | GET | `/inventory/status?item_id={id}` | `inventory.ts` |
| Fulfillment stock (detailed) | GET | `/inventories/{id}/stock/fulfillment?include_attributes=conditions` | `inventory.ts` |
| Exchange code for token | POST | `/oauth/token` (grant_type=authorization_code) | `oauth.ts` |
| Refresh token | POST | `/oauth/token` (grant_type=refresh_token) | `oauth.ts` |

**Rate Limit Handling:**
- Sequential batch processing for multi-get (20 items per batch) in `src/lib/mercadolivre/api.ts`
- Shipping options fetched in batches of 5 with 200ms delay between batches (`src/lib/mercadolivre/sync.ts`)
- Inventory fetched in batches of 5 with 200ms delay (`src/lib/mercadolivre/inventory.ts`)
- No retry logic on rate limit errors (requests throw on non-200)

**ML API Types:** `src/lib/mercadolivre/types.ts`
- `MlTokenResponse`, `MlUserResponse`, `MlItem`, `MlItemsSearchResponse`
- `MlOrder`, `MlOrderItem`, `MlPayment`, `MlOrderSearchResponse`
- `MlInventoryStatusResponse`, `MlFulfillmentStockResponse`
- `MlShippingOptionsResponse`, `MlListingPrice`, `MlApiError`

## OAuth Flow

**Provider:** Mercado Livre (custom OAuth 2.0 + PKCE)
- Implementation: `src/lib/mercadolivre/oauth.ts`

**Flow:**
1. **Authorize** (`src/app/api/auth/mercadolivre/authorize/route.ts`):
   - Generate PKCE `code_verifier` (48 random bytes, base64url) and `code_challenge` (SHA-256)
   - Store `code_verifier` in cookie for callback
   - Redirect to `https://auth.mercadolibre.com/authorization` with `response_type=code`, `client_id`, `redirect_uri`, `code_challenge`, `code_challenge_method=S256`

2. **Callback** (`src/app/api/auth/mercadolivre/callback/route.ts`):
   - Receive `?code=TG-xxxxx` from ML
   - Exchange code for tokens via POST to `/oauth/token` with `code_verifier`
   - Response: `{ access_token, refresh_token, expires_in: 21600, user_id }`
   - Fetch user info via `/users/me`
   - Upsert `ml_accounts` row with tokens and user data

3. **Token Refresh:**
   - Automatic on API calls when token expires within 5 minutes (`src/lib/mercadolivre/api.ts` → `getValidToken()`)
   - Hourly Vercel Cron job as backup (`src/app/api/cron/refresh-tokens/route.ts`)
   - On refresh failure: account status set to `expired`

**Env vars:**
- `ML_APP_ID` - OAuth client ID
- `ML_CLIENT_SECRET` - OAuth client secret (server-only)
- `ML_REDIRECT_URI` - Callback URL (`https://avansa.app/api/auth/mercadolivre/callback`)

## Data Storage

**Database:** Supabase (managed PostgreSQL)
- Connection: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client/server)
- Admin connection: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)

**Three Supabase client patterns:**

1. **Browser client** (`src/lib/supabase/client.ts`):
   - `createBrowserClient<Database>()` from `@supabase/ssr`
   - Used in client components for user-scoped queries (RLS enforced)

2. **Server client** (`src/lib/supabase/server.ts`):
   - `createServerClient<Database>()` from `@supabase/ssr` with cookie access
   - Used in Server Components and Route Handlers for user-scoped queries (RLS enforced)

3. **Admin client** (`src/lib/supabase/admin.ts`):
   - `createClient<Database>()` from `@supabase/supabase-js` with `service_role` key
   - `autoRefreshToken: false`, `persistSession: false`
   - Used in: webhooks, cron jobs, sync operations, token management
   - Bypasses RLS - use only in server-side code

**File Storage:** Not used (thumbnails referenced by ML URL)

**Caching:** None (no Redis, no in-memory cache beyond request scope)

## Authentication & Identity

**Auth Provider:** Supabase Auth (email/password)
- Implementation: `src/lib/supabase/middleware.ts`
- Middleware: `src/middleware.ts` - refreshes session on every request

**Session Management:**
- Cookie-based sessions via `@supabase/ssr`
- Middleware checks `supabase.auth.getUser()` on every request
- Protected routes: `/dashboard`, `/products`, `/orders`, `/accounts`, `/settings`
- Auth routes: `/login`, `/register` (redirect to `/dashboard` if already authenticated)

**Route Protection Pattern:**
```
Unauthenticated + dashboard route → redirect to /login
Authenticated + auth route → redirect to /dashboard
```

## Monitoring & Observability

**Error Tracking:** None (no Sentry, Datadog, etc.)

**Logging:** `console.log` / `console.error` / `console.warn` / `console.info`
- Prefixed with module tags: `[webhook]`, `[webhook-processor]`, `[cron/refresh-tokens]`, `[cron/sync-data]`
- Vercel captures these as serverless function logs

**Audit Trail:** `sync_logs` table tracks:
- Sync type (products, orders, inventory)
- Status (running, completed, error)
- Items synced count
- Error messages
- Start/completion timestamps

## CI/CD & Deployment

**Hosting:** Vercel
- Serverless functions for API routes
- Edge middleware for auth

**CI Pipeline:** Not detected (no GitHub Actions, no `.github/workflows/`)

**Cron Jobs** (`vercel.json`):
- `/api/cron/refresh-tokens` - Every hour (`0 */1 * * *`)
  - Refreshes ML tokens expiring within 1 hour
  - Protected by `CRON_SECRET` Bearer token
- `/api/cron/sync-data` - Every 6 hours (`0 */6 * * *`)
  - Full sync: products, orders, inventory for all active accounts
  - Protected by `CRON_SECRET` Bearer token

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhooks/mercadolivre` (`src/app/api/webhooks/mercadolivre/route.ts`)
  - Receives notifications from Mercado Livre for topics: `orders_v2`, `items`, `questions`
  - Always responds 200 immediately (ML requirement)
  - Saves event to `webhook_events` table
  - Processes asynchronously (fire-and-forget via `processWebhookEvent()`)
  - Processor: `src/lib/mercadolivre/webhook-processor.ts`
    - `orders_v2`: Fetches order from ML API, upserts into `orders` table
    - `items`: Fetches item from ML API, updates `products` table
    - `questions`: Logged but not processed (future feature)

**Outgoing:** None

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (safe for browser)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (server-only, bypasses RLS)
- `ML_APP_ID` - Mercado Livre OAuth app ID
- `ML_CLIENT_SECRET` - Mercado Livre OAuth secret (server-only)
- `ML_REDIRECT_URI` - OAuth callback URL
- `NEXT_PUBLIC_APP_URL` - App public URL
- `CRON_SECRET` - Vercel Cron authorization token

**Secrets location:**
- `.env.local` file (present, gitignored)
- Vercel environment variables (production)

## API Routes Summary

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/auth/mercadolivre/authorize` | GET | Start ML OAuth flow | Supabase session |
| `/api/auth/mercadolivre/callback` | GET | Complete ML OAuth flow | Supabase session |
| `/api/ml/products` | GET | List user's products | Supabase session |
| `/api/ml/products/[id]/edit` | PUT | Edit a product on ML | Supabase session |
| `/api/ml/products/[id]/costs` | PUT | Update product costs | Supabase session |
| `/api/ml/products/bulk` | PUT | Bulk edit products | Supabase session |
| `/api/ml/orders` | GET | List user's orders | Supabase session |
| `/api/ml/sync` | POST | Trigger manual sync | Supabase session |
| `/api/ml/inventory` | GET | Get inventory status | Supabase session |
| `/api/ml/accounts/[id]/disconnect` | DELETE | Disconnect ML account | Supabase session |
| `/api/webhooks/mercadolivre` | POST | ML webhook receiver | None (public) |
| `/api/cron/refresh-tokens` | GET | Refresh expiring tokens | CRON_SECRET |
| `/api/cron/sync-data` | GET | Full data sync | CRON_SECRET |

---

*Integration audit: 2026-03-30*
