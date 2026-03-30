# Research: Melhorar a tela de vendas

**Date:** 2026-03-30
**Task:** Improve orders/sales page with metrics, filters, table UX, and ML status mapping

## 1. Mercado Livre Order Statuses (from API docs)

The ML API returns these order statuses via `GET /orders/search?seller={user_id}`:

| Status | Meaning | Badge Color Suggestion |
|--------|---------|----------------------|
| `payment_required` | Pagamento pendente — aguardando confirmação | Orange |
| `payment_in_process` | Pagamento em processamento — não creditado ainda | Yellow/Orange |
| `partially_paid` | Parcialmente pago — valor insuficiente | Yellow |
| `paid` | Pago — pagamento creditado | Green |
| `cancelled` | Cancelado — não foi concluído | Red |
| `invalid` | Inválido — comprador malicioso | Red/Gray |

### Cancellation Reasons
- Stockout during payment approval → payment returned
- Auto-cancelled due to non-payment within deadline
- Seller banned from site after transaction

### API Filter
The `order.status` query parameter accepts: `paid`, `cancelled`, `payment_required`, `payment_in_process`, `partially_paid`, `invalid`.

### Current Codebase Gap
The current `orders-view.tsx` only filters by: `paid`, `confirmed`, `cancelled`. Missing: `payment_required`, `payment_in_process`, `partially_paid`, `invalid`. The `confirmed` status doesn't exist in the ML API — should be removed or mapped.

### Date Filtering via API
The ML API supports date range filtering directly:
- `date_created.from` / `date_created.to`
- `last_updated.from` / `last_updated.to`
- Formats: `yyyy-MM-dd`, `yyyy-MM-ddThh:mm:ss`

This means date range filtering can be done server-side for accuracy.

## 2. Date Range Picker — shadcn Approach

**Current state:** Project does NOT have `calendar`, `popover`, or `date-picker` shadcn components installed. Also missing `react-day-picker` and `date-fns` dependencies.

**Recommended approach:**
1. Install shadcn `calendar` and `popover` components: `npx shadcn@latest add calendar popover`
2. This pulls in `react-day-picker` and `date-fns` automatically
3. Use `Calendar` in `mode="range"` with a `Popover` trigger
4. Combine with existing preset buttons (7d, 30d, 90d) + "Personalizado" option

**Code pattern** from shadcn docs:
```tsx
import { type DateRange } from "react-day-picker"
import { Calendar } from "@/components/ui/calendar"

// mode="range" gives from/to date selection
<Calendar mode="range" selected={dateRange} onSelect={setDateRange} />
```

## 3. Table Features — Build vs Library

**Option A: @tanstack/react-table** — Full-featured headless table with sorting, pagination, grouping, filtering built-in. Overkill if grouping isn't complex.

**Option B: Custom implementation** — The codebase already has a custom table. Adding sorting (click header), pagination (page controls), and search (input filter) is straightforward without a library.

**Recommendation: Option B (custom)** for sorting + pagination + search. These are simple patterns. Consider @tanstack/react-table only if grouping requirements become complex. Keep the existing table structure and enhance incrementally.

**Grouping approach:** Client-side grouping with collapsible sections. Group orders by a key (date string, product title, account name), render group headers with summary, toggle expand/collapse. This avoids server-side complexity.

## 4. Saved Filters

**Options:**
- **localStorage** — Simple, instant, no API calls. Drawback: per-device only.
- **Supabase table** — Cross-device, but adds schema + API complexity.

**Recommendation: localStorage first.** For a SaaS, this covers 90% of use cases. Structure:

```ts
interface SavedFilter {
  name: string
  filters: {
    accountId?: string
    period?: string
    dateFrom?: string
    dateTo?: string
    status?: string[]
    search?: string
    groupBy?: string
  }
}
// Key: "avansa:orders:savedFilters"
// Key: "avansa:orders:activeFilter" (last used filter name)
```

Can migrate to Supabase later if multi-device becomes a requirement.

## 5. Missing shadcn Components to Install

The following components are needed and not yet installed:
- `calendar` — for date range picker
- `popover` — for date picker popup
- `select` — for improved dropdowns (currently using raw HTML selects)
- `input` — for search field (check if exists)
- `pagination` — for table pagination controls

Install command: `npx shadcn@latest add calendar popover select input pagination`

## 6. Implementation Priorities

Given scope, recommended order:
1. **ML status mapping + badges** — Quick fix, high value (fixes incorrect status display)
2. **Metrics cards** — High visibility improvement
3. **Date range picker** — Needs new components installed
4. **Search + pagination + sorting** — Table UX core
5. **Improved filter selects** — Better UX with shadcn Select
6. **Grouping** — Most complex, do last
7. **Saved filters** — localStorage persistence, can be added alongside grouping
