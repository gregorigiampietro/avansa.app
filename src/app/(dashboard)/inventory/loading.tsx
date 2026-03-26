import { Header } from "@/components/layout/header";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-muted/50 ${className ?? ""}`}
    />
  );
}

export default function InventoryLoading() {
  return (
    <>
      <Header title="Estoque" />

      <div className="space-y-6 p-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-5"
            >
              <Skeleton className="mb-3 h-4 w-20" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-xl border border-border bg-card p-6">
          <Skeleton className="mb-4 h-5 w-44" />
          <Skeleton className="mx-auto h-56 w-56 rounded-full" />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border">
          <Skeleton className="h-10 w-full rounded-b-none" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-t border-border px-4 py-3"
            >
              <Skeleton className="size-4 shrink-0" />
              <Skeleton className="size-10 shrink-0 rounded-md" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
