# Codebase Structure

**Analysis Date:** 2026-03-30

## Directory Layout

```
avansa-app/
├── src/
│   ├── app/                    # Next.js App Router (pages + API routes)
│   │   ├── (auth)/             # Auth route group (login, register)
│   │   ├── (dashboard)/        # Dashboard route group (protected)
│   │   ├── api/                # API Route Handlers
│   │   ├── fonts/              # Local font files (Geist)
│   │   ├── globals.css         # Global styles + Tailwind config
│   │   ├── layout.tsx          # Root layout (HTML, font, Toaster)
│   │   └── page.tsx            # Landing page (/)
│   ├── components/             # React components by domain
│   │   ├── accounts/           # ML account management components
│   │   ├── dashboard/          # Dashboard-specific components
│   │   ├── inventory/          # Inventory management components
│   │   ├── layout/             # Shared layout (sidebar, header)
│   │   ├── orders/             # Order display components
│   │   ├── products/           # Product management components
│   │   ├── settings/           # Settings components
│   │   └── ui/                 # shadcn/ui primitives
│   ├── lib/                    # Shared libraries and utilities
│   │   ├── mercadolivre/       # ML API integration layer
│   │   ├── supabase/           # Supabase client factories
│   │   ├── utils/              # Business logic utilities
│   │   └── utils.ts            # Tailwind cn() helper
│   ├── types/                  # TypeScript type definitions
│   └── middleware.ts           # Next.js middleware (auth + session)
├── supabase/
│   └── migrations/             # SQL migration files
├── docs/                       # Documentation
├── .planning/                  # GSD planning documents
│   └── codebase/               # Codebase analysis docs
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript config (strict, @/* alias)
├── next.config.mjs             # Next.js config (empty/default)
├── vercel.json                 # Vercel cron job definitions
├── postcss.config.mjs          # PostCSS config for Tailwind
├── components.json             # shadcn/ui configuration
├── CLAUDE.md                   # AI assistant instructions
└── PRD.md                      # Product requirements document
```

## Directory Purposes

**`src/app/(auth)/`:**
- Purpose: Authentication pages (login, register)
- Contains: `layout.tsx` (centered card layout), `login/page.tsx`, `register/page.tsx`
- Key files: `layout.tsx` provides a centered branding layout with no sidebar

**`src/app/(dashboard)/`:**
- Purpose: All protected dashboard pages
- Contains: `layout.tsx` (auth guard + sidebar layout), page directories for each feature
- Key files: `layout.tsx` checks auth server-side and redirects to `/login` if unauthenticated
- Pages: `dashboard/`, `products/`, `inventory/`, `orders/`, `accounts/`, `settings/`
- Each page has a `page.tsx` (Server Component) and most have a `loading.tsx` skeleton

**`src/app/api/auth/mercadolivre/`:**
- Purpose: ML OAuth 2.0 flow endpoints
- Contains: `authorize/route.ts` (generates PKCE, redirects to ML), `callback/route.ts` (exchanges code for tokens, saves account)

**`src/app/api/ml/`:**
- Purpose: API endpoints for ML data operations
- Contains: Products CRUD, orders CRUD, sync triggers, inventory, account management
- Sub-routes:
  - `products/route.ts` (GET: list with pagination/filters)
  - `products/[id]/edit/route.ts` (PUT: edit price/stock/status on ML + local DB)
  - `products/[id]/costs/route.ts` (PUT: update cost fields + recalculate margin)
  - `products/bulk/route.ts` (POST: bulk operations on multiple products)
  - `orders/route.ts` (GET: list with filters; POST: trigger sync)
  - `inventory/route.ts` (GET: list inventory; POST: trigger sync)
  - `sync/route.ts` (POST: trigger product + inventory sync)
  - `accounts/[id]/disconnect/route.ts` (POST: disconnect ML account, clean up data)

**`src/app/api/cron/`:**
- Purpose: Vercel Cron job handlers (protected by CRON_SECRET)
- Contains: `refresh-tokens/route.ts` (hourly), `sync-data/route.ts` (every 6 hours)

**`src/app/api/webhooks/`:**
- Purpose: Incoming webhook receiver from Mercado Livre
- Contains: `mercadolivre/route.ts` (POST handler with async processing)

**`src/components/accounts/`:**
- Purpose: ML account management UI
- Contains: `account-card.tsx`, `accounts-list.tsx`, `connect-button.tsx`

**`src/components/dashboard/`:**
- Purpose: Dashboard-specific widgets
- Contains: `stats-cards.tsx`, `revenue-chart.tsx`, `recent-orders.tsx`, `date-range-picker.tsx`

**`src/components/inventory/`:**
- Purpose: Inventory/fulfillment stock views
- Contains: `inventory-view.tsx` (main view), `inventory-table.tsx`, `inventory-stats-cards.tsx`, `inventory-chart.tsx`

**`src/components/products/`:**
- Purpose: Product listing, filtering, editing, bulk actions
- Contains: `products-view.tsx` (main orchestrator), `product-table.tsx`, `product-filters.tsx`, `product-edit-sheet.tsx`, `cost-editor.tsx`, `bulk-actions.tsx`

**`src/components/orders/`:**
- Purpose: Order listing and display
- Contains: `orders-view.tsx` (main view), `order-table.tsx`

**`src/components/layout/`:**
- Purpose: Shared layout chrome
- Contains: `sidebar.tsx` (navigation + logout), `header.tsx` (page title bar)

**`src/components/ui/`:**
- Purpose: shadcn/ui primitives (auto-generated, do not edit manually)
- Contains: `avatar.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `separator.tsx`, `sheet.tsx`, `tabs.tsx`

**`src/lib/mercadolivre/`:**
- Purpose: All Mercado Livre API interaction logic
- Contains:
  - `api.ts`: Authenticated HTTP helpers (mlGet, mlPut, mlPost) + domain helpers
  - `oauth.ts`: PKCE generation, authorization URL, token exchange, token refresh
  - `sync.ts`: Full product sync engine
  - `sync-orders.ts`: Full order sync engine
  - `inventory.ts`: Fulfillment inventory sync engine
  - `webhook-processor.ts`: Async webhook event handler
  - `types.ts`: ML API response type definitions

**`src/lib/supabase/`:**
- Purpose: Supabase client factories for different contexts
- Contains:
  - `client.ts`: Browser client (createBrowserClient with anon key)
  - `server.ts`: Server client (createServerClient with cookies)
  - `admin.ts`: Admin client (createClient with service_role key)
  - `middleware.ts`: Session refresh logic for Next.js middleware

**`src/lib/utils/`:**
- Purpose: Shared business logic and formatting utilities
- Contains:
  - `calculations.ts`: Margin calculation formula
  - `formatters.ts`: Currency (BRL), date, percentage, truncate formatters

**`src/types/`:**
- Purpose: Shared TypeScript type definitions
- Contains: `database.ts` (Supabase Database type with all tables + convenience Row aliases)

**`supabase/migrations/`:**
- Purpose: SQL migration files for database schema
- Contains: `001_initial_schema.sql` (core tables + RLS), `002_inventory_status.sql`, `003_inventory_condition_details.sql`, `004_products_catalog_fields.sql`
- Not auto-generated; written manually

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout (HTML shell, font, Toaster)
- `src/app/page.tsx`: Landing page
- `src/middleware.ts`: Request interceptor (auth redirects, session refresh)
- `src/app/(dashboard)/layout.tsx`: Dashboard auth guard + sidebar layout

**Configuration:**
- `package.json`: Dependencies, scripts (dev, build, start, lint)
- `tsconfig.json`: TypeScript strict mode, `@/*` path alias to `./src/*`
- `next.config.mjs`: Next.js config (currently empty)
- `vercel.json`: Cron job schedule definitions
- `components.json`: shadcn/ui component config
- `postcss.config.mjs`: PostCSS with Tailwind plugin
- `.eslintrc.json`: ESLint with next config

**Core Logic:**
- `src/lib/mercadolivre/api.ts`: ML API wrapper with auto-refresh tokens
- `src/lib/mercadolivre/sync.ts`: Product sync engine (most complex file)
- `src/lib/mercadolivre/sync-orders.ts`: Order sync engine
- `src/lib/mercadolivre/inventory.ts`: Inventory sync engine
- `src/lib/mercadolivre/webhook-processor.ts`: Webhook event processing
- `src/lib/utils/calculations.ts`: Margin calculation formula

**Database:**
- `src/types/database.ts`: Database type definitions (Row/Insert/Update for all tables)
- `supabase/migrations/001_initial_schema.sql`: Core schema (ml_accounts, products, orders, webhook_events, sync_logs + RLS)
- `supabase/migrations/002_inventory_status.sql`: Inventory table with computed total_stock column

## Naming Conventions

**Files:**
- Components: `kebab-case.tsx` (e.g., `product-table.tsx`, `stats-cards.tsx`)
- Route handlers: `route.ts` (Next.js convention)
- Pages: `page.tsx` (Next.js convention)
- Loading skeletons: `loading.tsx` (Next.js convention)
- Lib modules: `kebab-case.ts` (e.g., `sync-orders.ts`, `webhook-processor.ts`)
- Types: `kebab-case.ts` (e.g., `database.ts`)
- SQL migrations: `NNN_description.sql` (e.g., `001_initial_schema.sql`)

**Directories:**
- Route groups: `(group-name)` (e.g., `(auth)`, `(dashboard)`)
- Dynamic routes: `[param]` (e.g., `[id]`)
- Domain folders: `kebab-case` (e.g., `mercadolivre`, `products`)

**Exports:**
- Components: Named PascalCase exports (e.g., `export function ProductTable`)
- Utility functions: Named camelCase exports (e.g., `export function calculateMargin`)
- Types: Named PascalCase exports (e.g., `export type Product`, `export interface MlItem`)

## Route Structure

**Pages (App Router):**
| Path | File | Type |
|------|------|------|
| `/` | `src/app/page.tsx` | Landing |
| `/login` | `src/app/(auth)/login/page.tsx` | Auth |
| `/register` | `src/app/(auth)/register/page.tsx` | Auth |
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` | Dashboard |
| `/products` | `src/app/(dashboard)/products/page.tsx` | Dashboard |
| `/inventory` | `src/app/(dashboard)/inventory/page.tsx` | Dashboard |
| `/orders` | `src/app/(dashboard)/orders/page.tsx` | Dashboard |
| `/accounts` | `src/app/(dashboard)/accounts/page.tsx` | Dashboard |
| `/settings` | `src/app/(dashboard)/settings/page.tsx` | Dashboard |

**API Routes:**
| Method | Path | File | Purpose |
|--------|------|------|---------|
| GET | `/api/auth/mercadolivre/authorize` | `src/app/api/auth/mercadolivre/authorize/route.ts` | Start OAuth flow |
| GET | `/api/auth/mercadolivre/callback` | `src/app/api/auth/mercadolivre/callback/route.ts` | OAuth callback |
| GET | `/api/ml/products` | `src/app/api/ml/products/route.ts` | List products |
| PUT | `/api/ml/products/[id]/edit` | `src/app/api/ml/products/[id]/edit/route.ts` | Edit product on ML |
| PUT | `/api/ml/products/[id]/costs` | `src/app/api/ml/products/[id]/costs/route.ts` | Update costs |
| POST | `/api/ml/products/bulk` | `src/app/api/ml/products/bulk/route.ts` | Bulk operations |
| GET | `/api/ml/orders` | `src/app/api/ml/orders/route.ts` | List orders |
| POST | `/api/ml/orders` | `src/app/api/ml/orders/route.ts` | Trigger order sync |
| GET | `/api/ml/inventory` | `src/app/api/ml/inventory/route.ts` | List inventory |
| POST | `/api/ml/inventory` | `src/app/api/ml/inventory/route.ts` | Trigger inventory sync |
| POST | `/api/ml/sync` | `src/app/api/ml/sync/route.ts` | Trigger product sync |
| POST | `/api/ml/accounts/[id]/disconnect` | `src/app/api/ml/accounts/[id]/disconnect/route.ts` | Disconnect account |
| POST | `/api/webhooks/mercadolivre` | `src/app/api/webhooks/mercadolivre/route.ts` | Receive ML webhooks |
| GET | `/api/cron/refresh-tokens` | `src/app/api/cron/refresh-tokens/route.ts` | Hourly token refresh |
| GET | `/api/cron/sync-data` | `src/app/api/cron/sync-data/route.ts` | 6-hourly full sync |

## Where to Add New Code

**New Dashboard Page:**
1. Create directory: `src/app/(dashboard)/{page-name}/`
2. Add `page.tsx` (Server Component): fetch data from Supabase, pass to view component
3. Add `loading.tsx`: skeleton UI for Suspense
4. Add nav item to `src/components/layout/sidebar.tsx` in the `navItems` array
5. Add view component: `src/components/{page-name}/{page-name}-view.tsx` ("use client")
6. If page needs auth middleware protection, add the path to `src/lib/supabase/middleware.ts`

**New API Route:**
1. Create directory: `src/app/api/ml/{resource}/`
2. Add `route.ts` with exported HTTP method handlers (GET, POST, PUT, DELETE)
3. Always authenticate: `const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();`
4. Verify ownership before mutations
5. Use admin client for background/elevated operations

**New ML API Integration:**
1. Add response types to `src/lib/mercadolivre/types.ts`
2. Add API helper functions to `src/lib/mercadolivre/api.ts` using `mlGet<T>`, `mlPut<T>`, or `mlPost<T>`
3. If sync needed, create `src/lib/mercadolivre/sync-{entity}.ts` following the pattern in `sync.ts`

**New Component:**
1. Place in `src/components/{domain}/` (e.g., `src/components/products/`)
2. Name file: `kebab-case.tsx`
3. Export component: `export function PascalCaseName()`
4. Add "use client" directive only if using hooks or browser APIs
5. Import UI primitives from `src/components/ui/`

**New Database Table:**
1. Create migration: `supabase/migrations/NNN_description.sql`
2. Add table with RLS policies following the pattern in `001_initial_schema.sql`
3. Add types to `src/types/database.ts` under `Database["public"]["Tables"]`
4. Add convenience type alias at bottom of `database.ts`

**New Utility Function:**
- Business logic: `src/lib/utils/calculations.ts` or new file in `src/lib/utils/`
- Formatting: `src/lib/utils/formatters.ts`
- Tailwind/CSS: `src/lib/utils.ts`

## Special Directories

**`src/components/ui/`:**
- Purpose: shadcn/ui component primitives
- Generated: Yes (via `npx shadcn add`)
- Committed: Yes
- Do not edit directly; customize via `components.json` or wrapper components

**`supabase/migrations/`:**
- Purpose: SQL schema migrations
- Generated: No (hand-written)
- Committed: Yes
- Apply manually or via Supabase CLI

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No (gitignored)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No (gitignored)

---

*Structure analysis: 2026-03-30*
