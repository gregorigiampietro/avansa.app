# Technology Stack

**Analysis Date:** 2026-03-30

## Languages

**Primary:**
- TypeScript ^5 - All application code (`src/**/*.ts`, `src/**/*.tsx`)
- SQL - Database migrations (`supabase/migrations/*.sql`)

**Secondary:**
- JavaScript (ESM) - Config files only (`next.config.mjs`, `postcss.config.mjs`)

## Runtime

**Environment:**
- Node.js v20.x (v20.19.5 detected locally)
- Deployed as serverless functions on Vercel

**Package Manager:**
- npm v10.x (v10.8.2 detected locally)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 14.2.35 - App Router, React Server Components, Route Handlers
  - Config: `next.config.mjs` (empty/default config)
  - Middleware: `src/middleware.ts` (Supabase auth session refresh)

**UI:**
- React ^18 - Component rendering
- Tailwind CSS ^4.2.2 (v4) - Utility-first styling via PostCSS plugin
  - PostCSS plugin: `@tailwindcss/postcss` ^4.2.2
  - Config: `postcss.config.mjs`
- shadcn/ui ^4.1.0 - Pre-built component primitives (CLI tool for component generation)
- @base-ui/react ^1.3.0 - Unstyled UI primitives

**Testing:**
- Not configured (no test runner, no test files detected)

**Build/Dev:**
- Next.js built-in bundler (Turbopack/Webpack)
- ESLint ^8 with `eslint-config-next` 14.2.35
- TypeScript compiler (strict mode) - `tsconfig.json`

## Key Dependencies

**Critical:**
- `@supabase/ssr` ^0.9.0 - Server-side Supabase client with cookie-based auth
- `@supabase/supabase-js` ^2.100.0 - Supabase JavaScript client (admin operations)
- `next` 14.2.35 - Application framework (pinned minor version)

**UI Libraries:**
- `lucide-react` ^1.6.0 - Icon library
- `sonner` ^2.0.7 - Toast notifications
- `class-variance-authority` ^0.7.1 - Component variant management (shadcn pattern)
- `clsx` ^2.1.1 - Conditional class names
- `tailwind-merge` ^3.5.0 - Tailwind class deduplication
- `tailwindcss-animate` ^1.0.7 - Animation utilities
- `tw-animate-css` ^1.4.0 - CSS animation presets

**Dev Dependencies:**
- `@types/node` ^20 - Node.js type definitions
- `@types/react` ^18 - React type definitions
- `@types/react-dom` ^18 - React DOM type definitions
- `postcss` ^8 - CSS processing
- `typescript` ^5 - Type checker

## Configuration

**TypeScript** (`tsconfig.json`):
- `strict: true` - Full strict mode enabled
- `module: "esnext"` with `moduleResolution: "bundler"`
- Path alias: `@/*` maps to `./src/*`
- JSX: `preserve` (handled by Next.js)
- Incremental compilation enabled

**ESLint:**
- Uses `eslint-config-next` (extends Next.js recommended rules)
- No custom `.eslintrc` file; config via `eslint-config-next` package

**Prettier:**
- Not configured (no `.prettierrc` or Prettier dependency detected)

**Environment Variables** (`.env.local` present - contents not read):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (client-side)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (client-side)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (server-only)
- `ML_APP_ID` - Mercado Livre OAuth application ID
- `ML_CLIENT_SECRET` - Mercado Livre OAuth client secret (server-only)
- `ML_REDIRECT_URI` - OAuth callback URL
- `NEXT_PUBLIC_APP_URL` - Application public URL
- `CRON_SECRET` - Bearer token for Vercel Cron job authorization

**Build:**
- `next.config.mjs` - Default/empty configuration
- `postcss.config.mjs` - Tailwind CSS v4 via `@tailwindcss/postcss` plugin

## Database

**Provider:** Supabase (managed PostgreSQL)

**Client Libraries:**
- `@supabase/ssr` - Browser client (`src/lib/supabase/client.ts`) and server client (`src/lib/supabase/server.ts`)
- `@supabase/supabase-js` - Admin client with `service_role` key (`src/lib/supabase/admin.ts`)

**Schema Management:**
- Raw SQL migrations in `supabase/migrations/`
- 4 migration files: `001_initial_schema.sql`, `002_inventory_status.sql`, `003_inventory_condition_details.sql`, `004_products_catalog_fields.sql`
- No ORM (direct Supabase client queries)

**Type Safety:**
- Manually maintained `Database` type in `src/types/database.ts`
- All Supabase clients are typed: `createBrowserClient<Database>(...)`, `createServerClient<Database>(...)`, `createClient<Database>(...)`
- Convenience row types exported: `MlAccount`, `Product`, `Order`, `WebhookEvent`, `InventoryStatus`, `SyncLog`

**Tables:**
- `ml_accounts` - Connected Mercado Livre seller accounts
- `products` - Synced ML listings with cost/margin data
- `orders` - Synced ML orders with profit calculations
- `webhook_events` - Incoming ML webhook event log
- `inventory_status` - Fulfillment/stock breakdown per product
- `sync_logs` - Sync operation audit trail

**Row Level Security:** Enabled on all tables. Users access data only through their own `ml_accounts` (join-based policies).

## Platform Requirements

**Development:**
- Node.js >= 20
- npm
- Supabase project (for database + auth)
- Mercado Livre developer application (for OAuth + API access)

**Production:**
- Vercel (serverless deployment)
- Vercel Cron Jobs (`vercel.json`):
  - `/api/cron/refresh-tokens` - Hourly (token refresh)
  - `/api/cron/sync-data` - Every 6 hours (full data sync)
- Domain: `avansa.app`

---

*Stack analysis: 2026-03-30*
