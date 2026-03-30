interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-background px-6">
      <h1 className="text-lg font-medium text-foreground">{title}</h1>
    </header>
  );
}
