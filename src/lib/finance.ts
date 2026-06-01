import { addMonths, addYears, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export type Recorrencia = "mensal" | "bimestral" | "trimestral" | "semestral" | "anual" | "personalizada";

export function formatBRL(v: number | string) {
  const n = typeof v === "string" ? Number(v) : v;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

export function formatDate(iso: string) {
  return format(parseISO(iso), "dd 'de' MMM", { locale: ptBR });
}

export function formatDateFull(iso: string) {
  return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
}

export function isVencido(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseISO(iso) < today;
}

/** Calcula a próxima data de vencimento para uma conta recorrente. */
export function proximoVencimento(
  atual: string,
  recorrencia: Recorrencia,
  mesesPersonalizados?: number[] | null,
): string {
  const d = parseISO(atual);
  let next: Date;
  switch (recorrencia) {
    case "mensal": next = addMonths(d, 1); break;
    case "bimestral": next = addMonths(d, 2); break;
    case "trimestral": next = addMonths(d, 3); break;
    case "semestral": next = addMonths(d, 6); break;
    case "anual": next = addYears(d, 1); break;
    case "personalizada": {
      const meses = (mesesPersonalizados ?? []).slice().sort((a, b) => a - b);
      if (meses.length === 0) { next = addMonths(d, 1); break; }
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const proxMes = meses.find((x) => x > m);
      next = proxMes
        ? new Date(y, proxMes - 1, d.getDate())
        : new Date(y + 1, meses[0] - 1, d.getDate());
      break;
    }
  }
  return format(next, "yyyy-MM-dd");
}
