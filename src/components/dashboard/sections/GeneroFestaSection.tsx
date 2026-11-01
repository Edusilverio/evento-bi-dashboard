import { useMemo } from "react";
import { formatNumber } from "@/lib/formatters";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";

interface GenderRow { genero: string; qtd: string }

interface GeneroFestaData {
  gender_opening: GenderRow[];
  gender_lumen: GenderRow[];
  gender_brisa: GenderRow[];
}

const GENDER_COLORS = ["#0D4F4F", "#2DD4BF"];

function buildGenderPie(rows: GenderRow[]) {
  const map: Record<string, number> = {};
  (rows || []).forEach(r => { map[r.genero] = (map[r.genero] || 0) + (Number(r.qtd) || 0); });
  const masc = map["Masculino"] || 0;
  const fem = map["Feminino"] || 0;
  const total = masc + fem || 1;
  return {
    masc, fem, total,
    mascPct: ((masc / total) * 100).toFixed(1),
    femPct: ((fem / total) * 100).toFixed(1),
    pieData: [{ name: "Masculino", value: masc }, { name: "Feminino", value: fem }],
  };
}

function FestaPie({ title, pieData, mascPct, femPct, masc, fem, total, tooltip }: {
  title: string; pieData: any[]; mascPct: string; femPct: string; masc: number; fem: number; total: number;
  tooltip: { title: string; filters: string[] };
}) {
  return (
    <div className="flex flex-col items-center">
      <FilterTooltip
        title={title}
        blocks={[{ filters: tooltip.filters }]}
        className="mb-2"
        titleClassName="text-xs"
      />
      <div className="relative w-44 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={78} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
              {pieData.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i]} />)}
            </Pie>
            <Tooltip formatter={(val: number) => formatNumber(val)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-mono font-bold">{mascPct}% M</span>
          <span className="text-xs font-mono font-bold">{femPct}% F</span>
        </div>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
        <span>M: {formatNumber(masc)}</span>
        <span>F: {formatNumber(fem)}</span>
      </div>
      <div className="w-full mt-4 text-xs px-3 py-1.5 rounded bg-primary/10 font-medium">
        <div className="flex justify-between items-center">
          <span className="text-foreground">Total</span>
          <span className="text-foreground font-bold">{formatNumber(total)}</span>
        </div>
      </div>
    </div>
  );
}

const CHARTS: {
  key: "gender_opening" | "gender_lumen" | "gender_brisa";
  title: string;
  filters: string[];
}[] = [
  {
    key: "gender_opening",
    title: "Opening Party + Passaporte",
    filters: [
      "Ingresso LIKE '%opening party%' OR '%openning%'",
      "OR Ingresso LIKE '%passaporte%' OR '%combo%'",
      "Genero IS NOT NULL",
    ],
  },
  {
    key: "gender_lumen",
    title: "Lumen + Passaporte",
    filters: [
      "Ingresso LIKE '%lumen%'",
      "OR Ingresso LIKE '%passaporte%' OR '%combo%'",
      "Genero IS NOT NULL",
    ],
  },
  {
    key: "gender_brisa",
    title: "Brisa + Passaporte",
    filters: [
      "Ingresso LIKE '%brisa%' OR '%brisa%'",
      "OR Ingresso LIKE '%passaporte%' OR '%combo%'",
      "Genero IS NOT NULL",
    ],
  },
];

export function GeneroFestaSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<GeneroFestaData>("genero-festa", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    return {
      gender_opening: buildGenderPie(data.gender_opening),
      gender_lumen: buildGenderPie(data.gender_lumen),
      gender_brisa: buildGenderPie(data.gender_brisa),
    };
  }, [data]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error || !computed) return <div className="kpi-card text-center py-8"><p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
      <div className="flex gap-3 mb-6 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: GENDER_COLORS[0] }} /> Masculino</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: GENDER_COLORS[1] }} /> Feminino</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CHARTS.map(({ key, title, filters }) => {
          const d = computed[key];
          return <FestaPie
            key={key}
            title={title}
            pieData={d.pieData}
            mascPct={d.mascPct}
            femPct={d.femPct}
            masc={d.masc}
            fem={d.fem}
            total={d.total}
            tooltip={{ title, filters }}
          />;
        })}
      </div>
    </motion.div>
  );
}
