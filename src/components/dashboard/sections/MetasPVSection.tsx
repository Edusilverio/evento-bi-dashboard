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

// Lote F: meta = base 2025 na MESMA janela de calendário (13/01 a 23/04), +10%.
// Base 2025: R$ 506.788,00 e 139 passaportes.
const META_FAT = 557466.8;
const META_PASS = 153;
const REGRA_META = "base 2025 no mesmo período de calendário, +10% · exclui hospedagem, aéreo e Corrida · combo entra só com a parte do passaporte";
const META_FEM = 110;
const META_MASC = 100;

interface MetasPVData {
  fat_cm26: Array<{ faturamento: string }>;
  fat_cm25: Array<{ faturamento: string }>;
  count_cm26: Array<{ qtd: string }>;
  count_cm25: Array<{ qtd: string }>;
  pass_cm26: Array<{ qtd: string }>;
  pass_cm25: Array<{ qtd: string }>;
  gender_fem_pv: Array<{ qtd: string }>;
  gender_masc_pv: Array<{ qtd: string }>;
  pv25_janela: Array<{ qtd: string }>;
}

export function MetasPVSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<MetasPVData>("metas-pv", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    const fatCM26 = Number(data.fat_cm26?.[0]?.faturamento) || 0;
    const fatCM25 = Number(data.fat_cm25?.[0]?.faturamento) || 0;
    const countCM26 = Number(data.count_cm26?.[0]?.qtd) || 0;
    const countCM25 = Number(data.count_cm25?.[0]?.qtd) || 0;
    const passCM26 = Number(data.pass_cm26?.[0]?.qtd) || 0;
    const passCM25 = Number(data.pass_cm25?.[0]?.qtd) || 0;
    const femPV = Number(data.gender_fem_pv?.[0]?.qtd) || 0;
    const mascPV = Number(data.gender_masc_pv?.[0]?.qtd) || 0;
    const pv25Janela = Number(data.pv25_janela?.[0]?.qtd) || 0;
    return { fatCM26, fatCM25, countCM26, countCM25, passCM26, passCM25, femPV, mascPV, pv25Janela };
  }, [data]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error || !computed) return <div className="kpi-card text-center py-8"><p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p></div>;

  const passBarData = [{ name: "2025", value: computed.passCM25 }, { name: "2026", value: computed.passCM26 }];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Faturamento vs Meta" blocks={[
            { year: "2026 (13/01 a 23/04)", filters: ["FROM CM25 ∪ CM26", "Data BETWEEN '2026-01-13' AND '2026-04-23'", "Meio_de_Pagamento NOT IN ('cortesia','none','free')", "exclui hospedagem/pousada/bangalô", "exclui aéreo avulso", "exclui Corrida Endorfina (Evento_ID 104146)", "COMBO: AÉREO + PASSAPORTE entra só com a parte do passaporte", "Líquido = Valor_Final − Desconto"] },
            { year: "2025 (13/01 a 23/04)", filters: ["Data BETWEEN '2025-01-13' AND '2025-04-23'", "Mesmas exclusões da base 2026"] },
            { year: "Meta", filters: [`R$ ${META_FAT.toLocaleString('pt-BR')}`, REGRA_META] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatCurrency(computed.fatCM26)}</p>
          <p className="text-xs text-muted-foreground mt-1">Venda x Meta - {formatCurrency(META_FAT)}</p>
          <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatCurrency(computed.fatCM25)} <VariationText current={computed.fatCM26} previous={computed.fatCM25} /></p>
          <p className="text-xs font-semibold text-foreground mt-1">Total Passaporte: 210 Pass - Receita total: R$ 608.500</p>
          <div className="mt-4 pt-3 border-t border-border flex justify-center max-w-[120px] max-h-[120px] mx-auto">
            <DonutChart value={computed.fatCM26} total={META_FAT} label="" colors={["#0D4F4F", "#E5E7EB"]} compact />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="PV vs META (Passaportes)" blocks={[
            { year: "2026 (13/01 a 23/04)", filters: ["SUM(Qtd) FROM CM25 ∪ CM26", "Data BETWEEN '2026-01-13' AND '2026-04-23'", "Meio_de_Pagamento NOT IN ('cortesia','none','free')", "LOWER(Ingresso) LIKE '%passaporte%' OU '%combo%'", "combo conta como passaporte", "exclui Corrida Endorfina (Evento_ID 104146)"] },
            { year: "Meta", filters: [`${META_PASS} passaportes`, REGRA_META] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.countCM26)}</p>
          <p className="text-xs text-muted-foreground mt-1">Venda x Meta - {formatNumber(META_PASS)} (exclui hospedagem, aéreo e Corrida)</p>
          <div className="mt-4 pt-3 border-t border-border flex justify-center max-w-[120px] max-h-[120px] mx-auto">
            <DonutChart value={computed.countCM26} total={META_PASS} label="" colors={["#0D4F4F", "#E5E7EB"]} compact />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Pré Venda" blocks={[
            { year: "2026 (13/01 a 23/04)", filters: ["FROM CM25 ∪ CM26", "Data BETWEEN '2026-01-13' AND '2026-04-23'", "LOWER(Ingresso) LIKE '%passaporte%' OU '%combo%'", "Meio_de_Pagamento NOT IN ('cortesia','none','free')"] },
            { year: "2025 (13/01 a 23/04)", filters: ["Data BETWEEN '2025-01-13' AND '2025-04-23'", "Mesmas regras da base 2026"] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.passCM26)}</p>
          <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatNumber(computed.passCM25)} <VariationText current={computed.passCM26} previous={computed.passCM25} /></p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={passBarData} layout="vertical">
                <XAxis type="number" hide /><YAxis type="category" dataKey="name" stroke="hsl(0 0% 45%)" fontSize={11} tickLine={false} axisLine={false} width={35} />
                <Bar dataKey="value" name="Passaportes" fill="#0D4F4F" radius={[0, 4, 4, 0]} barSize={20} label={{ position: "right", fontSize: 12, fontWeight: "bold", fill: "#333" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 pt-2 border-t border-border text-center">
            <p className="text-[10px] text-muted-foreground">PV 25 (10/05 - 13/06) - {formatNumber(computed.pv25Janela)} passaportes</p>
          </div>
        </motion.div>
      </div>

    </div>
  );
}
