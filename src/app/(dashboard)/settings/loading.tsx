import { Header } from "@/components/layout/header";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-muted/50 ${className ?? ""}`}
    />
  );
}

export default function SettingsLoading() {
  return (
    <>
      <Header title="Configurações" />

      <div className="mx-auto max-w-2xl space-y-8 p-6">
        {/* Profile */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-24" />
          <div className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        <Skeleton className="h-px w-full" />

        {/* Password */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-36" />
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>

        <Skeleton className="h-px w-full" />

        {/* Sync info */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-36" />
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>
    </>
  );
}
