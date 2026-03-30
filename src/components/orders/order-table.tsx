"use client";

import type { Order } from "@/types/database";
import { formatCurrency, formatDateTime, truncate } from "@/lib/utils/formatters";
import { Package } from "lucide-react";

interface OrderTableProps {
  orders: Order[];
}

function PaymentStatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center rounded-full bg-[#CDFF00]/15 px-2 py-0.5 text-xs font-medium text-[#CDFF00]">
          Aprovado
        </span>
      );
    case "pending":
    case "in_process":
      return (
        <span className="inline-flex items-center rounded-full bg-[#FF9F0A]/15 px-2 py-0.5 text-xs font-medium text-[#FF9F0A]">
          Pendente
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center rounded-full bg-[#FF453A]/15 px-2 py-0.5 text-xs font-medium text-[#FF453A]">
          Rejeitado
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {status ?? "\u2014"}
        </span>
      );
  }
}

function OrderStatusBadge({ status }: { status: string | null }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    payment_required: {
      label: "Pagamento pendente",
      className: "bg-[#FF9F0A]/15 text-[#FF9F0A]",
    },
    payment_in_process: {
      label: "Em processamento",
      className: "bg-[#FF9F0A]/15 text-[#FF9F0A]",
    },
    partially_paid: {
      label: "Parcialmente pago",
      className: "bg-[#FF9F0A]/15 text-[#FF9F0A]",
    },
    paid: {
      label: "Pago",
      className: "bg-[#CDFF00]/15 text-[#CDFF00]",
    },
    cancelled: {
      label: "Cancelado",
      className: "bg-[#FF453A]/15 text-[#FF453A]",
    },
    invalid: {
      label: "Inválido",
      className: "bg-[#FF453A]/15 text-[#FF453A]",
    },
  };

  const config = statusConfig[status ?? ""] ?? {
    label: status ?? "\u2014",
    className: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function ShippingBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">{"\u2014"}</span>;

  const labels: Record<string, { label: string; className: string }> = {
    shipped: {
      label: "Enviado",
      className: "bg-[#30D158]/15 text-[#30D158]",
    },
    delivered: {
      label: "Entregue",
      className: "bg-[#CDFF00]/15 text-[#CDFF00]",
    },
    ready_to_ship: {
      label: "Pronto p/ envio",
      className: "bg-[#FF9F0A]/15 text-[#FF9F0A]",
    },
    not_delivered: {
      label: "Não entregue",
      className: "bg-[#FF453A]/15 text-[#FF453A]",
    },
  };

  const config = labels[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export function OrderTable({ orders }: OrderTableProps) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
        <Package className="mb-3 size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Nenhuma venda encontrada com os filtros aplicados.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[1250px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pedido
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Data
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Produto
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Comprador
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Qtd
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Valor
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Comissão
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Lucro
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pagamento
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Envio
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const profitPositive =
              order.net_profit != null && order.net_profit > 0;
            const profitNegative =
              order.net_profit != null && order.net_profit < 0;

            return (
              <tr
                key={order.id}
                className="border-b border-border transition-colors hover:bg-[#242429]"
              >
                {/* Order ID */}
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {order.ml_order_id}
                  </span>
                </td>

                {/* Date */}
                <td className="px-4 py-3 text-foreground">
                  {formatDateTime(order.date_created)}
                </td>

                {/* Product */}
                <td className="px-4 py-3">
                  <span
                    className="font-medium text-foreground"
                    title={order.item_title ?? undefined}
                  >
                    {truncate(order.item_title, 35)}
                  </span>
                </td>

                {/* Buyer */}
                <td className="px-4 py-3 text-muted-foreground">
                  {order.buyer_nickname ?? "\u2014"}
                </td>

                {/* Quantity */}
                <td className="px-4 py-3 text-right text-foreground">
                  {order.quantity ?? "\u2014"}
                </td>

                {/* Total Amount */}
                <td className="px-4 py-3 text-right font-medium text-foreground">
                  {formatCurrency(order.total_amount)}
                </td>

                {/* ML Fee */}
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {formatCurrency(order.ml_fee)}
                </td>

                {/* Net Profit */}
                <td className="px-4 py-3 text-right">
                  {order.net_profit != null ? (
                    <span
                      className={
                        profitPositive
                          ? "font-medium text-[#CDFF00]"
                          : profitNegative
                            ? "font-medium text-[#FF453A]"
                            : "text-muted-foreground"
                      }
                    >
                      {formatCurrency(order.net_profit)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </td>

                {/* Order Status */}
                <td className="px-4 py-3 text-center">
                  <OrderStatusBadge status={order.status} />
                </td>

                {/* Payment Status */}
                <td className="px-4 py-3 text-center">
                  <PaymentStatusBadge status={order.payment_status} />
                </td>

                {/* Shipping Status */}
                <td className="px-4 py-3 text-center">
                  <ShippingBadge status={order.shipping_status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
