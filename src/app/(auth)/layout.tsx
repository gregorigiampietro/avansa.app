export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          Avansa
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestao para vendedores do Mercado Livre
        </p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
