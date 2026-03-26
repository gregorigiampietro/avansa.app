import { Header } from "@/components/layout/header";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-muted/50 ${className ?? ""}`}
    />
  );
}

export default function DashboardLoading() {
  return (
    <>
      <Header title="Dashboard" />

      <div className="space-y-6 p-6">
        {/* Date range picker skeleton */}
        <Skeleton className="h-9 w-64" />

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-5"
            >
              <Skeleton className="mb-3 h-4 w-24" />
              <Skeleton className="h-7 w-32" />
            </div>
          ))}
        </div>

        {/* Chart + Recent orders */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <Skeleton className="mb-4 h-5 w-40" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-border bg-card p-6">
              <Skeleton className="mb-4 h-5 w-32" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
