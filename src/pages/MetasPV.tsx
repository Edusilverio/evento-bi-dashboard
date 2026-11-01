import { useState, useMemo } from "react";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { DateRangeFilter, DEFAULT_DATE_RANGE } from "@/components/dashboard/DateRangeFilter";
import { UpdateBadge } from "@/components/dashboard/UpdateBadge";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";

const META_FAT = 715000;
const META_PASS = 210;

interface MetasPVData {
  fat_cm26: Array<{ faturamento: string }>;
  fat_cm25: Array<{ faturamento: string }>;
  count_cm26: Array<{ qtd: string }>;
  count_cm25: Array<{ qtd: string }>;
  pass_cm26: Array<{ qtd: string }>;
  pass_cm25: Array<{ qtd: string }>;
}

function VariationText({ current, previous }: { current: number; previous: number }) {
  if (!previous) return null;
  const pct = ((current / previous) - 1) * 100;
  const isNeg = pct < 0;
  return (
    <span className={`text-xs font-semibold ${isNeg ? "text-destructive" : "text-emerald-600"}`}>
      {isNeg ? "" : "+"}{pct.toFixed(1)}%
    </span>
  );
}

const MetasPV = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);
  const { data, isLoading, error } = useDashboardData<MetasPVData>("metas-pv", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    const fatCM26 = Number(data.fat_cm26?.[0]?.faturamento) || 0;
    const fatCM25 = Number(data.fat_cm25?.[0]?.faturamento) || 0;
    const countCM26 = Number(data.count_cm26?.[0]?.qtd) || 0;
    const countCM25 = Number(data.count_cm25?.[0]?.qtd) || 0;
    const passCM26 = Number(data.pass_cm26?.[0]?.qtd) || 0;
    const passCM25 = Number(data.pass_cm25?.[0]?.qtd) || 0;

    return {
      fatCM26, fatCM25, countCM26, countCM25, passCM26, passCM25,
      fatPct: META_FAT > 0 ? (fatCM26 / META_FAT) * 100 : 0,
      passPct: META_PASS > 0 ? (countCM26 / META_PASS) * 100 : 0,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !computed) {
    return (
      <div className="page-container">
        <div className="rounded-xl p-5" style={{ backgroundColor: "#0D4F4F" }}>
          <h1 className="text-xl font-bold text-white tracking-wide">METAS - PV</h1>
        </div>
        <div className="kpi-card text-center py-12">
          <p className="text-destructive text-sm">Erro ao carregar dados: {error?.message || "Sem dados disponíveis"}</p>
        </div>
      </div>
    );
  }

  const passBarData = [
    { name: "2025", value: computed.passCM25 },
    { name: "2026", value: computed.passCM26 },
  ];

  return (
    <div className="page-container space-y-4">
      {/* Header */}
      <div className="rounded-xl p-5 flex items-center justify-between" style={{ backgroundColor: "#0D4F4F" }}>
        <h1 className="text-xl font-bold text-white tracking-wide">METAS - PV</h1>
        <p className="text-white/70 text-xs">Lançamento Pré-venda - 13/01 a 23/04</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <UpdateBadge />
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      {/* 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Card 1: Faturamento vs Meta */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Faturamento vs Meta</p>
          <p className="text-2xl font-bold font-mono">{formatCurrency(computed.fatCM26)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Venda x Meta - {formatCurrency(META_FAT)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ano anterior: {formatCurrency(computed.fatCM25)}{" "}
            <VariationText current={computed.fatCM26} previous={computed.fatCM25} />
          </p>
          <div className="mt-4 pt-3 border-t border-border flex justify-center max-w-[120px] max-h-[120px] mx-auto">
            <DonutChart
              value={computed.fatCM26}
              total={META_FAT}
              label=""
              colors={["#0D4F4F", "#E5E7EB"]}
              compact
            />
          </div>
        </motion.div>

        {/* Card 2: Pass PV vs Meta */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">PV vs META</p>
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.countCM26)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Venda x Meta - {formatNumber(META_PASS)}
          </p>
          <div className="mt-4 pt-3 border-t border-border flex justify-center max-w-[120px] max-h-[120px] mx-auto">
            <DonutChart
              value={computed.countCM26}
              total={META_PASS}
              label=""
              colors={["#0D4F4F", "#E5E7EB"]}
              compact
            />
          </div>
        </motion.div>

        {/* Card 3: Passaporte */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Pré Venda</p>
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.passCM26)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ano anterior: {formatNumber(computed.passCM25)}{" "}
            <VariationText current={computed.passCM26} previous={computed.passCM25} />
          </p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={passBarData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" stroke="hsl(0 0% 45%)" fontSize={11} tickLine={false} axisLine={false} width={35} />
                <Bar dataKey="value" name="Passaportes" fill="#0D4F4F" radius={[0, 4, 4, 0]} barSize={20} label={{ position: "right", fontSize: 12, fontWeight: "bold", fill: "#333" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 pt-2 border-t border-border text-center">
            <p className="text-[10px] text-muted-foreground">PV 25 (Lote 1) - {formatNumber(computed.countCM25)}, 10/05 - 13/06</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MetasPV;
