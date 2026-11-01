import { useState, useMemo } from "react";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { PieChart, Pie } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { DateRangeFilter, DEFAULT_DATE_RANGE } from "@/components/dashboard/DateRangeFilter";
import { UpdateBadge } from "@/components/dashboard/UpdateBadge";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";

const META_BOAT = 140;

interface SunsetBoatSextaData {
  count_current: Array<{ qtd: string }>;
  count_prev: Array<{ qtd: string }>;
  count_all: Array<{ qtd: string }>;
  count_equipe: Array<{ qtd: string }>;
  gender: Array<{ genero: string; qtd: string }>;
  fat: Array<{ faturamento: string; desconto: string }>;
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

const SunsetBoatSexta = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);
  const { data, isLoading, error } = useDashboardData<SunsetBoatSextaData>("sunset-boat-sexta", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    const countCurrent = Number(data.count_current?.[0]?.qtd) || 0;
    const countPrev = Number(data.count_prev?.[0]?.qtd) || 0;
    const countAll = Number(data.count_all?.[0]?.qtd) || 0;
    const countEquipe = Number(data.count_equipe?.[0]?.qtd) || 0;
    const fatBruto = Number(data.fat?.[0]?.faturamento) || 0;
    const desconto = Number(data.fat?.[0]?.desconto) || 0;
    const fatLiquido = fatBruto - desconto;

    const genderMap: Record<string, number> = {};
    (data.gender || []).forEach((r) => {
      genderMap[r.genero] = Number(r.qtd) || 0;
    });
    const masc = genderMap["Masculino"] || 0;
    const fem = genderMap["Feminino"] || 0;
    const totalGender = masc + fem || 1;

    const restantes = Math.max(0, META_BOAT - countCurrent - countEquipe);

    return {
      countCurrent, countPrev, countAll, countEquipe, fatLiquido, masc, fem, restantes,
      mascPct: (masc / totalGender) * 100,
      femPct: (fem / totalGender) * 100,
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
        <div className="rounded-xl p-5 bg-primary">
          <h1 className="text-xl font-bold text-primary-foreground tracking-wide">Sunset Boat Party - Escuna</h1>
        </div>
        <div className="kpi-card text-center py-12 mt-4">
          <p className="text-destructive text-sm">Erro ao carregar dados: {error?.message || "Sem dados"}</p>
        </div>
      </div>
    );
  }

  const barDataHoriz = [
    { name: "2025", value: computed.countPrev },
    { name: "2026", value: computed.countCurrent },
  ];

  const barDataGender = [
    { name: "Masculino", value: computed.masc },
    { name: "Feminino", value: computed.fem },
  ];

  const donutGender = [
    { name: "Masculino", value: computed.masc },
    { name: "Feminino", value: computed.fem },
  ];

  const GENDER_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))"];

  // Progress bar segments
  const vendidosPct = (computed.countCurrent / META_BOAT) * 100;
  const equipePct = (computed.countEquipe / META_BOAT) * 100;
  const restantesPct = (computed.restantes / META_BOAT) * 100;

  return (
    <div className="page-container space-y-4">
      {/* Header */}
      <div className="rounded-xl p-5 bg-primary flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-foreground tracking-wide">Sunset Boat Party - Escuna</h1>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <UpdateBadge />
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      {/* Row 1: 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Card 1: Sunset Boat Escuna CC/Pix */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Sunset Boat Escuna - CC/Pix</p>
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.countCurrent)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ano anterior: {formatNumber(computed.countPrev)}{" "}
            <VariationText current={computed.countCurrent} previous={computed.countPrev} />
          </p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={barDataHoriz} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={35} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} label={{ position: "right", fontSize: 12, fontWeight: "bold", fill: "hsl(var(--foreground))" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Card 2: Venda x Meta 140 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card flex flex-col items-center">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Venda x Meta {META_BOAT}</p>
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.countCurrent)}</p>
          <div className="mt-4 flex justify-center max-w-[130px] max-h-[130px] mx-auto">
            <DonutChart
              value={computed.countCurrent}
              total={META_BOAT}
              label=""
              colors={["#0D4F4F", "#E5E7EB"]}
              compact
            />
          </div>
        </motion.div>

        {/* Card 3: Masc vs Fem barras verticais */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Sunset Boat Escuna - Masc vs Fem</p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={barDataGender} margin={{ top: 20 }}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} label={{ position: "top", fontSize: 12, fontWeight: "bold", fill: "hsl(var(--foreground))" }}>
                  {barDataGender.map((_, i) => (
                    <Cell key={i} fill={GENDER_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Progress Bar: Vendidos | Restantes | Equipe */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="kpi-card">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Ocupação do Barco — Meta {META_BOAT}</p>
        <div className="w-full h-7 rounded-full overflow-hidden flex bg-muted">
          {vendidosPct > 0 && (
            <div
              className="h-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground transition-all"
              style={{ width: `${Math.min(vendidosPct, 100)}%` }}
            >
              {computed.countCurrent}
            </div>
          )}
          {equipePct > 0 && (
            <div
              className="h-full bg-accent flex items-center justify-center text-[10px] font-bold text-accent-foreground transition-all"
              style={{ width: `${Math.min(equipePct, 100)}%` }}
            >
              {computed.countEquipe}
            </div>
          )}
          {restantesPct > 0 && (
            <div
              className="h-full bg-muted-foreground/20 flex items-center justify-center text-[10px] font-bold text-muted-foreground transition-all"
              style={{ width: `${Math.min(restantesPct, 100)}%` }}
            >
              {computed.restantes}
            </div>
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Vendidos (CC/Pix)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> Equipe</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/20 inline-block" /> Restantes</span>
        </div>
      </motion.div>

      {/* Row 2: 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Card 4: % Sunset Boat Escuna */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="kpi-card flex flex-col items-center">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">% Sunset Boat Escuna</p>
          <div className="relative w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutGender}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  {donutGender.map((_, i) => (
                    <Cell key={i} fill={GENDER_COLORS[i]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs font-mono font-bold">{computed.mascPct.toFixed(0)}% M</span>
              <span className="text-xs font-mono font-bold">{computed.femPct.toFixed(0)}% F</span>
            </div>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Masc</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> Fem</span>
          </div>
        </motion.div>

        {/* Card 5: Total CC/Pix/Cortesia */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="kpi-card flex flex-col items-center justify-center">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Sunset Boat Escuna CC/Pix/Cortesia</p>
          <p className="text-3xl font-bold font-mono">{formatNumber(computed.countAll)}</p>
        </motion.div>

        {/* Card 6: Faturamento */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="kpi-card flex flex-col items-center justify-center">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Faturamento Sunset Boat Escuna</p>
          <p className="text-3xl font-bold font-mono">{formatCurrency(computed.fatLiquido)}</p>
          <p className="text-xs text-muted-foreground mt-1">Valor Final - Desconto</p>
        </motion.div>
      </div>
    </div>
  );
};

export default SunsetBoatSexta;
