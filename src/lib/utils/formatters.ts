/**
 * Format a number as BRL currency: R$ 1.234,56
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Format a date string to DD/MM/YYYY
 * Uses America/Sao_Paulo timezone
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "\u2014";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString));
}

/**
 * Format a date string to DD/MM/YYYY HH:mm
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "\u2014";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

/**
 * Format a number as percentage: 15,5%
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "0%";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

/**
 * Truncate text to maxLength chars with ellipsis
 */
export function truncate(text: string | null | undefined, maxLength: number = 40): string {
  if (!text) return "\u2014";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "\u2026";
}
