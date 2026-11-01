import { format } from "date-fns";

export function formatCurrency(val: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

export function formatNumber(val: number) {
  return new Intl.NumberFormat("pt-BR").format(val);
}

export function formatDate(val: string) {
  try { return format(new Date(val), "dd/MM/yyyy"); } catch { return val; }
}

export function formatPct(val: number) {
  return `${val.toFixed(2)}%`;
}
