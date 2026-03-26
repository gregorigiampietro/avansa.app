import { Header } from "@/components/layout/header";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-muted/50 ${className ?? ""}`}
    />
  );
}

export default function ProductsLoading() {
  return (
    <>
      <Header title="Produtos" />

      <div className="flex flex-col gap-5 p-6">
        {/* Sync buttons */}
        <div className="flex gap-2">
          <Skeleton className="h-8 w-48" />
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>

        {/* Summary */}
        <Skeleton className="h-5 w-28" />

        {/* Table */}
        <div className="rounded-xl border border-border">
          <Skeleton className="h-10 w-full rounded-b-none" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-t border-border px-4 py-3"
            >
              <Skeleton className="size-4 shrink-0 rounded" />
              <Skeleton className="size-10 shrink-0 rounded-md" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
