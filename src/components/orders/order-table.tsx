"use client";

import React, { useMemo, useState } from "react";
import type { Order, MlAccount } from "@/types/database";
import { formatCurrency, formatDate, formatDateTime, truncate } from "@/lib/utils/formatters";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Package } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface OrderTableProps {
  orders: Order[];
  sortField?: string | null;
  sortDirection?: "asc" | "desc";
  onSort?: (field: string) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  groupBy?: string | null;
  accounts?: MlAccount[];
}

interface OrderGroup {
  key: string;
  label: string;
  orders: Order[];
  totalAmount: number;
}

type SortableColumn = {
  key: string;
  label: string;
  align: "left" | "right" | "center";
  sortable: boolean;
};

const COLUMNS: SortableColumn[] = [
  { key: "ml_order_id", label: "Pedido", align: "left", sortable: false },
  { key: "date_created", label: "Data", align: "left", sortable: true },
  { key: "item_title", label: "Produto", align: "left", sortable: false },
  { key: "buyer_nickname", label: "Comprador", align: "left", sortable: false },
  { key: "quantity", label: "Qtd", align: "right", sortable: true },
  { key: "total_amount", label: "Valor", align: "right", sortable: true },
  { key: "ml_fee", label: "Comissao", align: "right", sortable: false },
  { key: "net_profit", label: "Lucro", align: "right", sortable: true },
  { key: "status", label: "Status", align: "center", sortable: false },
  { key: "payment_status", label: "Pagamento", align: "center", sortable: false },
  { key: "shipping_status", label: "Envio", align: "center", sortable: false },
];

function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: string;
  sortField?: string | null;
  sortDirection?: "asc" | "desc";
}) {
  if (sortField !== field) {
    return <ArrowUpDown className="ml-1 inline size-3 text-muted-foreground/50" />;
  }
  return sortDirection === "asc" ? (
    <ArrowUp className="ml-1 inline size-3 text-[#CDFF00]" />
  ) : (
    <ArrowDown className="ml-1 inline size-3 text-[#CDFF00]" />
  );
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
      label: "Invalido",
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
      label: "Nao entregue",
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

function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (currentPage > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push("ellipsis");
  }

  pages.push(totalPages);

  return pages;
}

function buildGroups(
  orders: Order[],
  groupBy: string,
  accounts?: MlAccount[]
): OrderGroup[] {
  const map = new Map<string, Order[]>();

  for (const order of orders) {
    let key: string;
    switch (groupBy) {
      case "day":
        key = formatDate(order.date_created);
        break;
      case "product":
        key = order.item_title ?? "Sem titulo";
        break;
      case "account":
        key = order.ml_account_id;
        break;
      default:
        key = "all";
    }
    const group = map.get(key);
    if (group) {
      group.push(order);
    } else {
      map.set(key, [order]);
    }
  }

  const accountMap = new Map<string, string>();
  if (accounts) {
    for (const acc of accounts) {
      accountMap.set(
        acc.id,
        acc.nickname ?? acc.email ?? `Conta ${acc.ml_user_id}`
      );
    }
  }

  return Array.from(map.entries()).map(([key, groupOrders]) => ({
    key,
    label:
      groupBy === "account" ? (accountMap.get(key) ?? key) : key,
    orders: groupOrders,
    totalAmount: groupOrders.reduce(
      (sum, o) => sum + (o.total_amount ?? 0),
      0
    ),
  }));
}

function OrderRow({ order }: { order: Order }) {
  const profitPositive = order.net_profit != null && order.net_profit > 0;
  const profitNegative = order.net_profit != null && order.net_profit < 0;

  return (
    <tr className="border-b border-border transition-colors hover:bg-[#242429]">
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
}

function GroupHeader({
  group,
  expanded,
  onToggle,
  colSpan,
}: {
  group: OrderGroup;
  expanded: boolean;
  onToggle: () => void;
  colSpan: number;
}) {
  return (
    <tr
      className="cursor-pointer border-b border-border bg-muted/30 transition-colors hover:bg-muted/50"
      onClick={onToggle}
    >
      <td colSpan={colSpan} className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="font-medium text-foreground">{group.label}</span>
          <span className="text-xs text-muted-foreground">
            {group.orders.length}{" "}
            {group.orders.length === 1 ? "venda" : "vendas"}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {formatCurrency(group.totalAmount)}
          </span>
        </div>
      </td>
    </tr>
  );
}

export function OrderTable({
  orders,
  sortField,
  sortDirection,
  onSort,
  pagination,
  onPageChange,
  groupBy,
  accounts,
}: OrderTableProps) {
  const groups = useMemo(() => {
    if (!groupBy) return null;
    return buildGroups(orders, groupBy, accounts);
  }, [orders, groupBy, accounts]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

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

  const alignClass = {
    left: "text-left",
    right: "text-right",
    center: "text-center",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1250px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground ${alignClass[col.align]} ${
                    col.sortable ? "cursor-pointer select-none" : ""
                  }`}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                >
                  {col.label}
                  {col.sortable && (
                    <SortIcon
                      field={col.key}
                      sortField={sortField}
                      sortDirection={sortDirection}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups
              ? groups.map((group) => (
                  <React.Fragment key={group.key}>
                    <GroupHeader
                      group={group}
                      expanded={!collapsedGroups.has(group.key)}
                      onToggle={() => toggleGroup(group.key)}
                      colSpan={COLUMNS.length}
                    />
                    {!collapsedGroups.has(group.key) &&
                      group.orders.map((order) => (
                        <OrderRow key={order.id} order={order} />
                      ))}
                  </React.Fragment>
                ))
              : orders.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && onPageChange && (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Pagina {pagination.page} de {pagination.totalPages}
            {" \u2014 "}
            {pagination.total} {pagination.total === 1 ? "venda" : "vendas"} no total
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  text="Anterior"
                  onClick={(e) => {
                    e.preventDefault();
                    if (pagination.page > 1) onPageChange(pagination.page - 1);
                  }}
                  className={
                    pagination.page <= 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>

              {getPageNumbers(pagination.page, pagination.totalPages).map(
                (pageNum, idx) =>
                  pageNum === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <span className="flex size-8 items-center justify-center text-sm text-muted-foreground">
                        ...
                      </span>
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        isActive={pageNum === pagination.page}
                        onClick={(e) => {
                          e.preventDefault();
                          onPageChange(pageNum);
                        }}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  )
              )}

              <PaginationItem>
                <PaginationNext
                  text="Proximo"
                  onClick={(e) => {
                    e.preventDefault();
                    if (pagination.page < pagination.totalPages)
                      onPageChange(pagination.page + 1);
                  }}
                  className={
                    pagination.page >= pagination.totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
