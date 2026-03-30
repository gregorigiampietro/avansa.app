# Testing Patterns

**Analysis Date:** 2026-03-30

## Test Framework

**Runner:**
- No test framework is installed or configured
- No `jest`, `vitest`, `playwright`, or `cypress` in `package.json`
- No test configuration files detected (`jest.config.*`, `vitest.config.*`, `playwright.config.*`)
- No test scripts in `package.json` (only `dev`, `build`, `start`, `lint`)

**Assertion Library:**
- None installed

**Run Commands:**
```bash
npm run lint              # Only available quality check (next lint)
npm run build             # Type-checking happens during build
```

## Test File Organization

**Location:**
- No test files exist anywhere in the codebase
- No `*.test.*`, `*.spec.*`, or `__tests__/` directories found
- No `tests/`, `e2e/`, or `cypress/` directories exist

**Naming:**
- No convention established

## Test Coverage

**Current State: Zero test coverage.** The entire codebase has no automated tests of any kind.

**No coverage tooling** is configured (no `c8`, `istanbul`, `nyc`, or framework-native coverage).

## What Should Be Tested

Based on codebase analysis, these are the critical areas that need test coverage, ordered by risk:

### High Priority

**1. Margin Calculation Logic — `src/lib/utils/calculations.ts`**
- Pure function `calculateMargin()` with clear input/output
- Business-critical: incorrect margins directly impact user pricing decisions
- Easy to unit test — no external dependencies
- Edge cases: zero price, null fields, negative margins, large tax percentages

**2. ML API Client — `src/lib/mercadolivre/api.ts`**
- Token refresh logic (`getValidToken`): expiry detection, refresh flow, error marking account as expired
- HTTP helpers (`mlGet`, `mlPut`, `mlPost`): error handling on non-OK responses
- Pagination logic (`getAllItemIds`): correct offset handling, multi-status aggregation
- Batch processing (`getItems`): batching into groups of 20, handling failed items

**3. Product Sync — `src/lib/mercadolivre/sync.ts`**
- Complex orchestration: ID fetch -> item details -> fee calculation -> shipping costs -> upsert
- Preserves user-entered costs during re-sync
- Handles sync log lifecycle (running -> completed/error)
- Cleanup of removed products

**4. API Route Handlers — `src/app/api/ml/products/route.ts`, `src/app/api/ml/products/[id]/costs/route.ts`**
- Auth enforcement (401 on unauthenticated)
- Ownership verification (403 on unauthorized)
- Input validation (400 on bad requests)
- Query building with filters, pagination, sorting

### Medium Priority

**5. Webhook Processing — `src/app/api/webhooks/mercadolivre/route.ts`, `src/lib/mercadolivre/webhook-processor.ts`**
- Always returns 200 regardless of processing errors
- Payload validation
- Async fire-and-forget processing

**6. Token Refresh Cron — `src/app/api/cron/refresh-tokens/route.ts`**
- CRON_SECRET validation
- Batch token refresh with proper error isolation per account
- Account status marking on failure

**7. Middleware Auth — `src/lib/supabase/middleware.ts`**
- Redirect unauthenticated users from dashboard routes to login
- Redirect authenticated users from auth routes to dashboard
- Session cookie refresh

### Lower Priority

**8. Formatter Functions — `src/lib/utils/formatters.ts`**
- `formatCurrency`, `formatDate`, `formatDateTime`, `formatPercent`, `truncate`
- Pure functions, easy to test, but lower business risk

**9. Client Components**
- Filter logic in `ProductsView`, `OrdersView`
- Selection logic in `ProductTable`
- Product grouping logic (`groupProducts` in `src/components/products/product-table.tsx`)

## Recommended Test Setup

**Framework:** Vitest (recommended for Next.js 14 projects)

**Suggested Configuration:**
```bash
# Install
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Suggested `vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/app/api/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

**Suggested File Locations:**
- Unit tests co-located: `src/lib/utils/calculations.test.ts`
- API route tests co-located: `src/app/api/ml/products/route.test.ts`
- Component tests co-located: `src/components/products/product-table.test.tsx`
- Test utilities: `tests/setup.ts`, `tests/helpers/`
- Fixtures: `tests/fixtures/`

**Suggested `package.json` Scripts:**
```json
{
  "test": "vitest",
  "test:watch": "vitest --watch",
  "test:coverage": "vitest run --coverage",
  "test:ci": "vitest run --reporter=verbose"
}
```

## Mocking Patterns (Recommended)

**Supabase Client Mocking:**
```typescript
// Mock the admin client for lib functions
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    }),
  }),
}));
```

**Fetch Mocking (for ML API calls):**
```typescript
// Mock global fetch for ML API tests
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
  text: () => Promise.resolve(''),
}));
```

**What to Mock:**
- Supabase clients (admin, server, browser)
- Global `fetch` for external API calls (ML API)
- `next/headers` cookies for server client tests
- Environment variables via `vi.stubEnv()`

**What NOT to Mock:**
- Pure utility functions (`calculateMargin`, `formatCurrency`)
- Type definitions
- Component rendering logic (use Testing Library instead)

## CI/CD Integration

**Current State:**
- No CI/CD pipeline configured for testing
- `vercel.json` defines cron jobs but no test step
- Build command (`next build`) performs type checking but no tests

**Recommended Addition to Vercel/GitHub:**
```yaml
# .github/workflows/test.yml
- run: npm run test:ci
- run: npm run lint
```

## E2E Tests

**Current State:** Not present

**Recommended Framework:** Playwright (if added later)

**Critical User Flows to Cover:**
1. Login -> Dashboard redirect
2. Connect ML account via OAuth
3. Sync products and view in table
4. Edit product costs and verify margin recalculation
5. Bulk actions (pause/activate)

## Summary of Gaps

| Area | Files | Risk | Priority |
|------|-------|------|----------|
| No test framework | Project-wide | Critical | Immediate |
| Margin calculation untested | `src/lib/utils/calculations.ts` | High | High |
| ML API client untested | `src/lib/mercadolivre/api.ts` | High | High |
| Product sync untested | `src/lib/mercadolivre/sync.ts` | High | High |
| API routes untested | `src/app/api/ml/**/*.ts` | High | High |
| Auth middleware untested | `src/lib/supabase/middleware.ts` | Medium | Medium |
| Webhook handler untested | `src/app/api/webhooks/mercadolivre/route.ts` | Medium | Medium |
| Formatters untested | `src/lib/utils/formatters.ts` | Low | Low |
| Component logic untested | `src/components/**/*.tsx` | Medium | Low |

---

*Testing analysis: 2026-03-30*
