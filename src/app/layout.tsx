import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Avansa — Gestao para vendedores do Mercado Livre",
  description:
    "Conecte suas contas do Mercado Livre, gerencie estoque, calcule margem de lucro e faca edicoes em massa com o Avansa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={cn("font-sans", inter.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
