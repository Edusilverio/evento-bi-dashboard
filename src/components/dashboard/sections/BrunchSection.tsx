import { useMemo } from "react";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";

const META_BRUNCH = 55;
const GENDER_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))"];

interface BrunchData {
  count_ccpix: Array<{ qtd: string; faturamento: string }>;
  count_total: Array<{ qtd: string }>;
  gender: Array<{ genero: string; qtd: string }>;
}

export function BrunchSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<BrunchData>("brunch", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    const ccpix = Number(data.count_ccpix?.[0]?.qtd) || 0;
    const faturamento = Number(data.count_ccpix?.[0]?.faturamento) || 0;
    const total = Number(data.count_total?.[0]?.qtd) || 0;
    const genderMap: Record<string, number> = {};
    (data.gender || []).forEach((r) => { genderMap[r.genero] = Number(r.qtd) || 0; });
    const masc = genderMap["Masculino"] || 0;
    const fem = genderMap["Feminino"] || 0;
    const totalG = masc + fem || 1;
    return { ccpix, faturamento, total, masc, fem, mascPct: (masc / totalG) * 100, femPct: (fem / totalG) * 100 };
  }, [data]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error || !computed) return <div className="kpi-card text-center py-8"><p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p></div>;

  const barDataGender = [
    { name: `Masculino (${computed.mascPct.toFixed(0)}%)`, value: computed.masc },
    { name: `Feminino (${computed.femPct.toFixed(0)}%)`, value: computed.fem },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card flex flex-col items-center justify-center">
        <FilterTooltip className="mb-1" title="Brunch - CC/Pix" blocks={[
          { year: "2026", filters: [
            "SUM(Qtd) FROM CM26",
            "Data BETWEEN startDate AND endDate",
            "LOWER(Ingresso) LIKE '%brunch%'",
            "Meio_de_Pagamento NOT IN ('cortesia','none','free')",
          ] },
        ]} />
        <p className="text-4xl font-bold font-mono">{formatNumber(computed.ccpix)}</p>
        <p className="text-sm font-semibold font-mono text-primary mt-1">{formatCurrency(computed.faturamento)}</p>
        <p className="text-[10px] text-muted-foreground">Faturamento líquido</p>
        <p className="text-xs text-muted-foreground mt-2">Total (com cortesia): {formatNumber(computed.total)}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card flex flex-col items-center">
        <FilterTooltip className="mb-1" title={`Brunch x Meta ${META_BRUNCH}`} blocks={[
          { filters: [
            `Meta: ${META_BRUNCH} ingressos`,
            "Realizado = Brunch CC/Pix 2026",
          ] },
        ]} />
        <p className="text-2xl font-bold font-mono">{formatNumber(computed.ccpix)}</p>
        <div className="mt-4 flex justify-center max-w-[130px] max-h-[130px] mx-auto">
          <DonutChart value={computed.ccpix} total={META_BRUNCH} label="" colors={["#0D4F4F", "#E5E7EB"]} compact />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card">
        <FilterTooltip className="mb-1" title="Brunch - Masc vs Fem" blocks={[
          { year: "2026", filters: [
            "FROM CM26 (período atual)",
            "LOWER(Ingresso) LIKE '%brunch%'",
            "Gênero via coluna Genero ou LOWER(Ingresso) LIKE '%masculino%/%feminino%'",
            "Sem exclusão de Meio_de_Pagamento: inclui pagos, free e cortesia",
          ] },
        ]} />
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barDataGender} margin={{ top: 25 }}>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} label={{ position: "top", fontSize: 12, fontWeight: "bold", fill: "hsl(var(--foreground))" }}>
                {barDataGender.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-1 text-xs text-muted-foreground justify-center">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Masc</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> Fem</span>
        </div>
      </motion.div>
    </div>
  );
}
