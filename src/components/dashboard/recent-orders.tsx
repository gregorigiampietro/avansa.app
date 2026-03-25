import Link from "next/link";
import type { Order } from "@/types/database";
import { formatCurrency, formatDateTime, truncate } from "@/lib/utils/formatters";

interface RecentOrdersProps {
  orders: Order[];
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-medium text-foreground">Vendas Recentes</h3>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">
            Nenhuma venda recente
          </p>
        </div>
      ) : (
        <div className="flex-1 divide-y divide-border">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {truncate(order.item_title, 35)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(order.date_created)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">
                  {formatCurrency(order.total_amount)}
                </p>
                {order.net_profit != null && (
                  <p
                    className={`text-xs ${
                      order.net_profit >= 0
                        ? "text-[#CDFF00]"
                        : "text-[#FF453A]"
                    }`}
                  >
                    {order.net_profit >= 0 ? "+" : ""}
                    {formatCurrency(order.net_profit)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border px-5 py-3">
        <Link
          href="/orders"
          className="text-xs font-medium text-[#CDFF00] hover:underline"
        >
          Ver todas as vendas
        </Link>
      </div>
    </div>
  );
}
