import { Header } from "@/components/layout/header";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-muted/50 ${className ?? ""}`}
    />
  );
}

export default function OrdersLoading() {
  return (
    <>
      <Header title="Vendas" />

      <div className="flex flex-col gap-5 p-6">
        {/* Sync buttons */}
        <div className="flex gap-2">
          <Skeleton className="h-8 w-52" />
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-36" />
        </div>

        {/* Summary */}
        <Skeleton className="h-5 w-24" />

        {/* Table */}
        <div className="rounded-xl border border-border">
          <Skeleton className="h-10 w-full rounded-b-none" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-t border-border px-4 py-3"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
