# Coding Conventions

**Analysis Date:** 2026-03-30

## Naming Patterns

**Files:**
- kebab-case for all files: `product-table.tsx`, `cost-editor.tsx`, `sync-orders.ts`
- Page files: `page.tsx` (Next.js App Router convention)
- Layout files: `layout.tsx`
- Loading files: `loading.tsx`
- Route handlers: `route.ts`
- Type definition files: `database.ts`, `types.ts`

**Components:**
- PascalCase for component names: `ProductTable`, `CostEditor`, `StatsCards`
- One primary export per file, name matches the component
- Internal helper components defined in the same file with no export: `StatusBadge`, `ListingTypeBadge`, `AccountAvatar` in `src/components/products/product-table.tsx`

**Functions:**
- camelCase for all functions: `handleSubmit`, `refreshProducts`, `getValidToken`
- Event handlers prefixed with `handle`: `handleSync`, `handleEditProduct`, `handleSelectAll`
- Callbacks passed as props prefixed with `on`: `onFilterChange`, `onUpdateCosts`, `onSelectionChange`
- Async data fetchers use descriptive verbs: `fetchOrders`, `getAllItemIds`, `syncProducts`

**Variables:**
- camelCase for all variables: `syncingAccountId`, `filteredProducts`, `existingCostsMap`
- Constants use UPPER_SNAKE_CASE: `ML_API_BASE`, `MULTI_GET_BATCH_SIZE`, `SEARCH_PAGE_LIMIT`, `UPSERT_BATCH_SIZE`
- Boolean variables use `is`/`has` prefix: `isActive`, `isSelected`, `hasLinked`, `allSelected`

**Types/Interfaces:**
- PascalCase with descriptive suffixes: `ProductsViewProps`, `CostEditorProps`, `MarginInput`, `MarginResult`
- Props interfaces named `{ComponentName}Props`: `ProductTableProps`, `StatsCardsProps`
- ML API types prefixed with `Ml`: `MlItem`, `MlTokenResponse`, `MlUserResponse`, `MlOrderSearchResponse`
- Database row types are aliases from the `Database` generic: `Product`, `Order`, `MlAccount`
- Insert types referenced as `Database["public"]["Tables"]["products"]["Insert"]`

## Code Style

**Formatting:**
- No Prettier or dedicated formatter configured — relies on ESLint + editor defaults
- Single quotes are NOT enforced; the codebase uses double quotes consistently
- Semicolons are used consistently
- 2-space indentation throughout

**Linting:**
- ESLint 8 with `eslint-config-next@14.2.35`
- No custom ESLint config file detected — uses Next.js defaults
- Lint command: `npm run lint` (runs `next lint`)

**TypeScript:**
- Strict mode enabled in `tsconfig.json`: `"strict": true`
- Path alias `@/*` maps to `./src/*` — use `@/` for all imports
- Non-null assertions (`!`) used for environment variables: `process.env.NEXT_PUBLIC_SUPABASE_URL!`
- `as` type assertions used sparingly, prefer generic type parameters: `mlGet<MlUserResponse>(...)` over casting
- Nullable fields handled with `?? 0` or `?? ""` or `?? null` — never left unchecked

## Import Organization

**Order (observed pattern):**
1. React/Next.js framework imports: `import { useState } from "react"`, `import { NextResponse } from "next/server"`
2. Third-party libraries: `import { toast } from "sonner"`, `import { cva } from "class-variance-authority"`
3. Internal UI components: `import { Button } from "@/components/ui/button"`
4. Internal feature components: `import { ProductTable } from "./product-table"`
5. Internal lib/utils: `import { createClient } from "@/lib/supabase/server"`, `import { cn } from "@/lib/utils"`
6. Types (always with `type` keyword): `import type { Product, MlAccount } from "@/types/database"`

**Path Aliases:**
- `@/components/*` — UI and feature components
- `@/lib/*` — Utilities, Supabase clients, ML API wrappers
- `@/types/*` — Type definitions
- `@/hooks/*` — Custom hooks (directory exists but no hooks yet)
- Relative imports (`./`) used for sibling files within the same feature folder

**Type Import Style:**
- Always use `import type` for type-only imports: `import type { Product } from "@/types/database"`
- Mixed imports separate values and types: `import { ProductTable } from "./product-table"` + `import type { CostData } from "./cost-editor"`

## Component Patterns

**Server Components (default):**
- Pages (`page.tsx`) and layouts (`layout.tsx`) are Server Components
- Fetch data directly with `await createClient()` and Supabase queries
- Pass data to client components via props: `<ProductsView initialProducts={products} accounts={mlAccounts} />`
- Auth check pattern in pages:
```typescript
const supabase = await createClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) { redirect("/login"); }
```

**Client Components:**
- Marked with `"use client"` directive at the top of the file
- Used for interactive UI: forms, tables with selection, filter controls, sheets/modals
- All components in `src/components/products/`, `src/components/orders/`, `src/components/layout/sidebar.tsx` are client components
- `src/components/dashboard/stats-cards.tsx` is a Server Component (no `"use client"`)

**Props Pattern:**
- Props interface defined above component, exported only when needed by other files
- Callback props use `Promise<void>` for async operations: `onUpdateCosts: (id: string, costs: CostData) => Promise<void>`
- Initial data passed as `initialX` prop: `initialProducts`, `initialOrders`
- Selection state lifted to parent: `selectedIds` + `onSelectionChange`

**View Component Pattern:**
- Feature views follow a consistent pattern (see `src/components/products/products-view.tsx`, `src/components/orders/orders-view.tsx`):
  1. Accept `initialData` + `accounts` props
  2. Copy initial data into local state: `useState<Product[]>(initialProducts)`
  3. Manage filters, selection, and sync state locally
  4. Compose child components: filters, table, action bars, sheets

## State Management

**No external state library.** All state is managed via:
- React `useState` for local component state
- Props drilling for parent-child communication
- `useCallback` wrapping all event handlers
- `useMemo` for derived/filtered data
- Server-side data fetching in page components passed as initial props

**Data Refresh Pattern:**
- After mutations (sync, cost save, edit), fetch fresh data from API: `await fetch("/api/ml/products")`
- Update local state with response: `setProducts(data ?? [])`
- Show toast for success/error: `toast.success("...")` / `toast.error("...")`

## API Route Patterns

**Route Handler Structure (consistent across all routes in `src/app/api/`):**
```typescript
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
    }
    // 2. Validate ownership (account belongs to user)
    // 3. Execute business logic
    // 4. Return JSON response
    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno do servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Response Format:**
- Success: `{ data: T }` or `{ data: T, pagination: { page, pageSize, total, totalPages } }`
- Error: `{ error: string }` with appropriate HTTP status code
- Webhook: `{ received: true }` with status 200 (always, even on errors)

**Auth Patterns in API Routes:**
- User-facing routes: `createClient()` from `@/lib/supabase/server` (RLS-enabled, cookie-based)
- Background/admin routes: `createAdminClient()` from `@/lib/supabase/admin` (service role, bypasses RLS)
- Cron routes: Validate `Authorization: Bearer {CRON_SECRET}` header
- Webhook routes: No auth (ML sends without auth), but validate payload structure

**Ownership Verification:**
- Fetch user's `ml_accounts` by `user_id`
- Verify requested `accountId` is in the user's account list
- For product operations: verify product's `ml_account_id` belongs to user

## Client-Side API Calls

**Pattern:** Direct `fetch()` to internal API routes. No wrapper library.
```typescript
const response = await fetch("/api/ml/products");
if (response.ok) {
  const { data } = await response.json();
  setProducts(data ?? []);
}
```

**Mutation calls:**
```typescript
const response = await fetch(`/api/ml/products/${productId}/costs`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(costs),
});
if (!response.ok) {
  const data = await response.json();
  toast.error(data.error ?? "Erro ao salvar custos");
}
```

## Error Handling

**Server-side (API routes & lib functions):**
- Top-level `try/catch` wrapping entire route handler
- Catch block extracts message: `err instanceof Error ? err.message : "Erro interno do servidor"`
- Errors returned as JSON with appropriate status codes
- Console logging for background processes: `console.error("[webhook] ...", error.message)`

**Client-side:**
- `try/catch` around `fetch` calls
- Errors displayed via `toast.error()` from Sonner
- Loading states managed with `useState<boolean>` and `finally` blocks
- Empty `catch {}` blocks when parent handles errors: `catch { // Error is handled by parent }`

**ML API Error Handling:**
- `mlGet`/`mlPut`/`mlPost` in `src/lib/mercadolivre/api.ts` throw on non-OK responses with status + body
- Token refresh failures mark account as `status: "expired"` in the database
- Sync operations log errors to `sync_logs` table with `status: "error"`

## Logging

**Framework:** `console` (no structured logging library)

**Patterns:**
- Prefix with bracket tags for context: `[webhook]`, `[cron/refresh-tokens]`
- `console.error` for errors with contextual message
- `console.info` for operational events (cron completions, sync results)
- `console.warn` for non-critical issues (missing refresh token)
- Error messages in Portuguese (matching UI language)

## Styling Patterns

**Framework:** Tailwind CSS v4 with `tailwindcss-animate`

**Component Styling:**
- `cn()` utility from `src/lib/utils.ts` for conditional classes: `cn("base-class", isActive && "active-class")`
- shadcn/ui components via `@/components/ui/` with `class-variance-authority` for variants
- shadcn style: `base-nova` (configured in `components.json`)
- CSS variables for theming: `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`

**Design System Colors (hardcoded brand colors):**
- Primary accent: `#CDFF00` (lime green) — used for positive values, selections, active states
- Negative/error: `#FF453A` (red)
- Warning: `#FF9F0A` (orange) — used for paused items, low stock
- Info/catalog: `#64D2FF` (light blue) — used for catalog badges
- Background: Dark theme with `#1A1A1F` toast background

**Common Class Patterns:**
- Cards: `rounded-lg border border-border bg-card p-5`
- Table headers: `px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground`
- Badge-like spans: `inline-flex items-center rounded-full bg-[color]/15 px-2 py-0.5 text-xs font-medium text-[color]`
- Empty states: `flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center`
- Page layout: `flex flex-col gap-5 p-6`

**Icon Usage:**
- Lucide React icons: `import { Package, RefreshCw } from "lucide-react"`
- Standard size: `size-4` (16px)
- In buttons: `<RefreshCw />` (inherits size from button variant)

## UI Language

**All user-facing text is in Brazilian Portuguese (pt-BR).**
- Error messages: `"Usuário não autenticado"`, `"Erro ao salvar custos"`
- Button labels: `"Sincronizar"`, `"Salvar"`, `"Entrar"`
- Empty states: `"Nenhum produto encontrado com os filtros aplicados."`
- Toast messages: `toast.success("Produtos sincronizados com sucesso")`
- HTML lang: `<html lang="pt-BR">`
- Number/currency formatting: `toLocaleString("pt-BR")`, `Intl.NumberFormat("pt-BR")`

**Exception:** Code comments and console logs sometimes use English: `"Error fetching ML accounts:"`

## Comments

**When to Comment:**
- JSDoc-style `/** */` on exported functions in lib code: `src/lib/mercadolivre/api.ts`, `src/lib/mercadolivre/sync.ts`
- Section separators using `// ============` blocks in longer files
- Inline comments for non-obvious logic: `// Small delay between batches to avoid rate limits`
- `// CASCADE on inventory_status.product_id will clean up inventory too`

**JSDoc Pattern:**
```typescript
/**
 * Brief one-line description.
 * Optional multi-line explanation of behavior.
 */
export async function functionName(...): Promise<T> {
```

**No TSDoc `@param` or `@returns` tags are used.** Descriptions are prose-only.

## Module Design

**Exports:**
- Named exports for everything (no default exports except Next.js pages)
- Pages use `export default function PageName()`
- Components use `export function ComponentName()`
- Utility functions use `export function functionName()`
- Types use `export type` or `export interface`

**Barrel Files:**
- No barrel files (`index.ts`) are used
- All imports reference the specific file: `@/components/ui/button`, not `@/components/ui`

**Supabase Client Pattern (three-tier):**
- Browser client: `src/lib/supabase/client.ts` — `createBrowserClient<Database>()` for client components
- Server client: `src/lib/supabase/server.ts` — `createServerClient<Database>()` with cookies for server components/route handlers
- Admin client: `src/lib/supabase/admin.ts` — `createClient<Database>()` with service role for background jobs
- All three are typed with `Database` generic from `@/types/database.ts`

## Function Design

**Size:** Functions tend to be focused but can be long in sync/data-processing files (e.g., `syncProducts` in `src/lib/mercadolivre/sync.ts` is ~200 lines).

**Parameters:** Most functions accept 1-3 parameters. Complex inputs use typed objects (`MarginInput`, `CostData`).

**Return Values:**
- API wrappers return typed generics: `mlGet<T>(...): Promise<T>`
- Route handlers return `NextResponse.json()`
- Sync functions return result objects: `Promise<SyncResult>`
- Void callbacks for UI handlers

**Async/Await:**
- Always use `async/await`, never `.then()` chains
- `Promise.allSettled` for batch operations where partial failure is acceptable (shipping cost fetches)
- Sequential processing for rate-limited APIs (ML multi-get batches)

---

*Convention analysis: 2026-03-30*
