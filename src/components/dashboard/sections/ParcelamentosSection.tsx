import { useMemo } from "react";
import { formatNumber } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";

const TEAL_PALETTE = [
  "hsl(180, 73%, 18%)", "hsl(180, 60%, 28%)", "hsl(180, 50%, 38%)",
  "hsl(180, 40%, 48%)", "hsl(180, 30%, 58%)", "hsl(180, 25%, 65%)",
  "hsl(180, 20%, 72%)", "hsl(180, 15%, 78%)", "hsl(180, 10%, 84%)",
  "hsl(180, 8%, 88%)", "hsl(180, 5%, 92%)", "hsl(180, 3%, 95%)",
];

interface ParcelamentosData {
  parcelas: Array<{ parcelas: string; qtd: string }>;
}

export function ParcelamentosSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<ParcelamentosData>("parcelamentos", dateRange);

  const computed = useMemo(() => {
    if (!data?.parcelas) return null;
    const bars = (data.parcelas || []).map(r => ({
      name: `${r.parcelas}x`,
      value: Number(r.qtd) || 0,
    }));
    const total = bars.reduce((s, r) => s + r.value, 0) || 1;
    const pie = bars.map(r => ({ ...r, pct: ((r.value / total) * 100).toFixed(2) }));
    return { bars, pie };
  }, [data]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error || !computed) return <div className="kpi-card text-center py-8"><p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
        <FilterTooltip className="mb-3" title="Parcelamento CC" blocks={[
          { filters: ["GROUP BY Parcelas", "FROM CM25 ∪ CM26", "Data BETWEEN startDate AND endDate", "Meio_de_Pagamento = 'credit_card'", "Faixa_Etaria != 'Outras Idades'"] },
        ]} />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={computed.bars} margin={{ top: 20, right: 10 }}>
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis hide />
            <Tooltip formatter={(val: number) => formatNumber(val)} />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={36}
              label={{ position: "top", fontSize: 11, fontWeight: "bold", fill: "hsl(var(--foreground))" }}>
              {computed.bars.map((_, i) => <Cell key={i} fill={TEAL_PALETTE[i % TEAL_PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card flex flex-col items-center">
        <FilterTooltip className="mb-3" title="Parcelamentos CC" blocks={[
          { filters: ["Distribuição percentual de parcelas", "Mesmos filtros do card 'Parcelamento CC'"] },
        ]} />
        <div className="relative w-52 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={computed.pie} cx="50%" cy="50%" innerRadius={50} outerRadius={85} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                {computed.pie.map((_, i) => <Cell key={i} fill={TEAL_PALETTE[i % TEAL_PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(val: number) => formatNumber(val)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-2 mt-2 justify-center">
          {computed.pie.map((item, i) => (
            <span key={item.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: TEAL_PALETTE[i % TEAL_PALETTE.length] }} />
              {item.name} ({item.pct}%)
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
