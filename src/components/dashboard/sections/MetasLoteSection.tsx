import { useMemo } from "react";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";
import { VariationText } from "@/components/dashboard/VariationText";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";

type LotePage = "metas-lote1" | "metas-lote2" | "metas-lote3" | "metas-lote4";

// Meta do 4º Lote ainda não definida pela cliente. Quando definir, basta preencher aqui.
const META_4_LOTE: { fat: number; pass: number } | null = null; // a definir pela cliente

// Lote F: meta = base de 2025 na MESMA janela de calendário, +10%.
// Base: só ingressos (fora hospedagem, aéreo avulso e Corrida Endorfina);
// o COMBO: AÉREO + PASSAPORTE entra só com a parte do passaporte.
const META_BY_PAGE: Record<LotePage, { fat: number; pass: number } | null> = {
  "metas-lote1": { fat: 409008.6, pass: 97 },
  "metas-lote2": { fat: 222855.6, pass: 38 },
  "metas-lote3": { fat: 312263.6, pass: 41 },
  "metas-lote4": META_4_LOTE,
};

// Janelas de calendário de cada lote (iguais nos dois anos).
const JANELA_BY_PAGE: Record<LotePage, string> = {
  "metas-lote1": "24/04 a 11/06",
  "metas-lote2": "12/06 a 16/07",
  "metas-lote3": "17/07 a 20/08",
  "metas-lote4": "21/08 em diante",
};

const REGRA_META = "base 2025 no mesmo período de calendário, +10% · exclui hospedagem, aéreo e Corrida · combo entra só com a parte do passaporte";

interface MetasLoteData {
  fat_cm26: Array<{ faturamento: string }>;
  fat_cm25: Array<{ faturamento: string }>;
  count_cm26: Array<{ qtd: string }>;
  count_cm25: Array<{ qtd: string }>;
  pass_cm26: Array<{ qtd: string }>;
  pass_cm25: Array<{ qtd: string }>;
}

interface Props {
  dateRange: DateRange | undefined;
  lote: "1º Lote" | "2º Lote" | "3º Lote" | "4º Lote";
  page: LotePage;
}

export function MetasLoteSection({ dateRange, lote, page }: Props) {
  const meta = META_BY_PAGE[page];
  const janela = JANELA_BY_PAGE[page];
  const META_FAT = meta?.fat ?? 0;
  const META_PASS = meta?.pass ?? 0;
  const { data, isLoading, error } = useDashboardData<MetasLoteData>(page, dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    return {
      fatCM26: Number(data.fat_cm26?.[0]?.faturamento) || 0,
      fatCM25: Number(data.fat_cm25?.[0]?.faturamento) || 0,
      countCM26: Number(data.count_cm26?.[0]?.qtd) || 0,
      countCM25: Number(data.count_cm25?.[0]?.qtd) || 0,
      passCM26: Number(data.pass_cm26?.[0]?.qtd) || 0,
      passCM25: Number(data.pass_cm25?.[0]?.qtd) || 0,
    };
  }, [data]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error || !computed) return <div className="kpi-card text-center py-8"><p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p></div>;

  const passBarData = [{ name: "2025", value: computed.passCM25 }, { name: "2026", value: computed.passCM26 }];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Faturamento vs Meta" blocks={[
            { year: `2026 (${janela})`, filters: ["FROM CM25 ∪ CM26", `Data BETWEEN a janela do lote (${janela}/2026)`, "Meio_de_Pagamento NOT IN ('cortesia','none','free')", "exclui hospedagem/pousada/bangalô", "exclui aéreo avulso", "exclui Corrida Endorfina (Evento_ID 104146)", "COMBO: AÉREO + PASSAPORTE entra só com a parte do passaporte", "Líquido = Valor_Final − Desconto"] },
            { year: `2025 (${janela})`, filters: [`Data BETWEEN a mesma janela de calendário (${janela}/2025)`, "Mesmas exclusões da base 2026"] },
            { year: "Meta", filters: [meta ? `R$ ${META_FAT.toLocaleString('pt-BR')}` : "meta a definir", REGRA_META] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatCurrency(computed.fatCM26)}</p>
          <p className="text-xs text-muted-foreground mt-1">{meta ? `Venda x Meta - ${formatCurrency(META_FAT)}` : "meta a definir"}</p>
          <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatCurrency(computed.fatCM25)} <VariationText current={computed.fatCM26} previous={computed.fatCM25} /></p>
          {meta ? (
            <div className="mt-4 pt-3 border-t border-border flex justify-center max-w-[120px] max-h-[120px] mx-auto">
              <DonutChart value={computed.fatCM26} total={META_FAT} label="" colors={["#0D4F4F", "#E5E7EB"]} compact />
            </div>
          ) : (
            <div className="mt-4 pt-3 border-t border-border text-center">
              <p className="text-lg font-bold font-mono">{formatCurrency(computed.fatCM26)}</p>
              <p className="text-xs text-muted-foreground">meta a definir</p>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card">
          <FilterTooltip className="mb-1" title={`${lote} vs META (Passaportes)`} blocks={[
            { year: `2026 (${janela})`, filters: ["SUM(Qtd) FROM CM25 ∪ CM26", `Data BETWEEN a janela do lote (${janela}/2026)`, "Meio_de_Pagamento NOT IN ('cortesia','none','free')", "LOWER(Ingresso) LIKE '%passaporte%' OU '%combo%'", "combo conta como passaporte", "exclui Corrida Endorfina (Evento_ID 104146)"] },
            { year: "Meta", filters: [meta ? `${META_PASS} passaportes` : "meta a definir", REGRA_META] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.countCM26)}</p>
          <p className="text-xs text-muted-foreground mt-1">{meta ? `Venda x Meta - ${formatNumber(META_PASS)}` : "meta a definir"}</p>
          {meta ? (
            <div className="mt-4 pt-3 border-t border-border flex justify-center max-w-[120px] max-h-[120px] mx-auto">
              <DonutChart value={computed.countCM26} total={META_PASS} label="" colors={["#0D4F4F", "#E5E7EB"]} compact />
            </div>
          ) : (
            <div className="mt-4 pt-3 border-t border-border text-center">
              <p className="text-lg font-bold font-mono">{formatNumber(computed.countCM26)}</p>
              <p className="text-xs text-muted-foreground">meta a definir</p>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card">
          <FilterTooltip className="mb-1" title={lote} blocks={[
            { year: `2026 (${janela})`, filters: ["FROM CM25 ∪ CM26", `Data BETWEEN a janela do lote (${janela}/2026)`, "LOWER(Ingresso) LIKE '%passaporte%' OU '%combo%'", "Meio_de_Pagamento NOT IN ('cortesia','none','free')"] },
            { year: `2025 (${janela})`, filters: [`Data BETWEEN a mesma janela de calendário (${janela}/2025)`, "Mesmas regras da base 2026"] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.passCM26)}</p>
          <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatNumber(computed.passCM25)} <VariationText current={computed.passCM26} previous={computed.passCM25} /></p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={passBarData} layout="vertical">
                <XAxis type="number" hide /><YAxis type="category" dataKey="name" stroke="hsl(0 0% 45%)" fontSize={11} tickLine={false} axisLine={false} width={35} />
                <Bar dataKey="value" name={lote} fill="#0D4F4F" radius={[0, 4, 4, 0]} barSize={20} label={{ position: "right", fontSize: 12, fontWeight: "bold", fill: "#333" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
