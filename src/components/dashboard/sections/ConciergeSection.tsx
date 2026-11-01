import { useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { useDashboardData } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";

interface ConciergeRow {
  classe: string;
  Evento_ID: string;
  ingressos: string;
  transacoes: string;
  compradores: string;
  faturamento: string;
}
interface ConciergeData {
  concierge: ConciergeRow[];
}

const LOJAS: Record<string, string> = {
  "89312": "Pix",
  "89311": "Cartão",
  "104146": "Corrida",
};

const TOOLTIP_BLOCKS = [
  {
    year: "Regra",
    filters: [
      "FROM ingresse_api.CM26",
      "Data BETWEEN startDate AND endDate",
      "Meio_de_Pagamento NOT IN ('cortesia','none','free')",
      "Evento_ID = 89312 (loja Pix) → concierge: o cliente deposita na conta da Reality e a equipe emite",
    ],
  },
  {
    year: "Três cuidados",
    filters: [
      "A classificação é POR TRANSAÇÃO, nunca por pessoa — 18 compradores aparecem nas duas lojas.",
      "A regra do Pix vale até 31/12/2026; em 2027 a operação deve mudar.",
      "'A apurar' NÃO é venda direta confirmada — é o que ainda não foi classificado, à espera da lista de conversas do WhatsApp. Não leia como '58,9% é venda direta': isso não foi medido.",
    ],
  },
];

export function ConciergeSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<ConciergeData>("concierge", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    const rows = (data.concierge || []).map((r) => ({
      classe: r.classe,
      eventoId: String(r.Evento_ID),
      loja: LOJAS[String(r.Evento_ID)] || `Loja ${r.Evento_ID}`,
      ingressos: Number(r.ingressos) || 0,
      transacoes: Number(r.transacoes) || 0,
      compradores: Number(r.compradores) || 0,
      faturamento: Number(r.faturamento) || 0,
    }));
    const totalIngressos = rows.reduce((s, r) => s + r.ingressos, 0);
    const totalFat = rows.reduce((s, r) => s + r.faturamento, 0);
    const conc = rows.filter((r) => r.classe === "concierge");
    const apurar = rows.filter((r) => r.classe !== "concierge");
    const agg = (list: typeof rows) => ({
      ingressos: list.reduce((s, r) => s + r.ingressos, 0),
      transacoes: list.reduce((s, r) => s + r.transacoes, 0),
      compradores: list.reduce((s, r) => s + r.compradores, 0),
      faturamento: list.reduce((s, r) => s + r.faturamento, 0),
    });
    return {
      rows: [...conc, ...apurar],
      totalIngressos,
      totalFat,
      concierge: agg(conc),
      apurar: agg(apurar),
    };
  }, [data]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  if (error || !computed)
    return (
      <div className="kpi-card text-center py-8">
        <p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p>
      </div>
    );

  const pct = (v: number) => (computed.totalIngressos ? (100 * v) / computed.totalIngressos : 0);
  const pctFat = (v: number) => (computed.totalFat ? (100 * v) / computed.totalFat : 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Concierge — resolvido" blocks={TOOLTIP_BLOCKS} />
          <p className="text-4xl font-bold font-mono">{formatNumber(computed.concierge.ingressos)}</p>
          <p className="text-xs text-muted-foreground">
            ingressos · {pct(computed.concierge.ingressos).toFixed(1)}% do total
          </p>
          <p className="text-sm font-mono mt-2">{formatNumber(computed.concierge.compradores)} compradores</p>
          <p className="text-sm font-mono text-primary">
            {formatCurrency(computed.concierge.faturamento)}{" "}
            <span className="text-[10px] text-muted-foreground">({pctFat(computed.concierge.faturamento).toFixed(1)}%)</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">loja Pix — a equipe emite, regra vigente até 31/12/2026</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="A apurar pela conversa" blocks={TOOLTIP_BLOCKS} />
          <p className="text-4xl font-bold font-mono">{formatNumber(computed.apurar.ingressos)}</p>
          <p className="text-xs text-muted-foreground">
            ingressos · {pct(computed.apurar.ingressos).toFixed(1)}% do total
          </p>
          <p className="text-sm font-mono mt-2">{formatNumber(computed.apurar.compradores)} compradores</p>
          <p className="text-sm font-mono text-primary">
            {formatCurrency(computed.apurar.faturamento)}{" "}
            <span className="text-[10px] text-muted-foreground">({pctFat(computed.apurar.faturamento).toFixed(1)}%)</span>
          </p>
          {/* Não escrever "venda direta" aqui: essa parte não foi medida ainda. */}
          <p className="text-[10px] text-muted-foreground mt-1">
            ainda não classificado — não é venda direta confirmada; aguarda a lista de conversas do WhatsApp
          </p>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card">
        <FilterTooltip className="mb-3" title="Detalhamento por loja" blocks={TOOLTIP_BLOCKS} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-2">Loja</th>
                <th className="text-left font-medium py-2">Classificação</th>
                <th className="text-right font-medium py-2">Ingressos</th>
                <th className="text-right font-medium py-2">Transações</th>
                <th className="text-right font-medium py-2">Compradores</th>
                <th className="text-right font-medium py-2">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {computed.rows.map((r) => (
                <tr key={r.eventoId} className="border-b border-border/50 last:border-0">
                  <td className="py-2 font-medium">{r.loja} · {r.eventoId}</td>
                  <td className={cn("py-2", r.classe === "concierge" ? "text-primary font-semibold" : "text-muted-foreground")}>
                    {r.classe === "concierge" ? "concierge — resolvido" : "a apurar pela conversa"}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {formatNumber(r.ingressos)}{" "}
                    <span className="text-[10px] text-muted-foreground">({pct(r.ingressos).toFixed(1)}%)</span>
                  </td>
                  <td className="py-2 text-right font-mono">{formatNumber(r.transacoes)}</td>
                  <td className="py-2 text-right font-mono">{formatNumber(r.compradores)}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(r.faturamento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          Classificação por transação, nunca por pessoa — 18 compradores aparecem nas duas lojas, então a soma de
          compradores por loja é maior que o número de pessoas.
        </p>
      </motion.div>
    </div>
  );
}
