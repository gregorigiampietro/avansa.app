import { SyncStatusIndicator } from "@/components/sync/sync-status-indicator";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-lg font-medium text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        <SyncStatusIndicator />
      </div>
    </header>
  );
}
