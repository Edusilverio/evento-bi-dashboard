import { useMemo } from "react";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";
import { VariationText } from "@/components/dashboard/VariationText";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";

const META_BOAT = 140;
const VAGAS_BLOQUEADAS = 15;
const GENDER_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))"];

interface SunsetBoatSextaData {
  count_current: Array<{ qtd: string }>;
  count_prev: Array<{ qtd: string }>;
  count_all: Array<{ qtd: string }>;
  count_equipe: Array<{ qtd: string }>;
  gender: Array<{ genero: string; qtd: string }>;
  fat: Array<{ faturamento: string; desconto: string }>;
  prevenda_current: Array<{ qtd: string }>;
  prevenda_prev: Array<{ qtd: string }>;
  prevenda_gender: Array<{ genero: string; qtd: string }>;
  lote1_current: Array<{ qtd: string }>;
  lote1_prev: Array<{ qtd: string }>;
  lote1_gender: Array<{ genero: string; qtd: string }>;
  prevenda_gender_prev: Array<{ genero: string; qtd: string }>;
  lote1_gender_prev: Array<{ genero: string; qtd: string }>;
}

export function SunsetBoatSextaSection({ dateRange }: { dateRange: DateRange | undefined }) {
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
    (data.gender || []).forEach(r => { genderMap[r.genero] = Number(r.qtd) || 0; });
    const masc = genderMap["Masculino"] || 0;
    const fem = genderMap["Feminino"] || 0;
    const totalGender = masc + fem || 1;
    const availableCapacity = META_BOAT - VAGAS_BLOQUEADAS;
    const restantes = Math.max(0, availableCapacity - countCurrent);
    const prevendaCurrent = Number(data.prevenda_current?.[0]?.qtd) || 0;
    const prevendaPrev = Number(data.prevenda_prev?.[0]?.qtd) || 0;
    const pvGenderMap: Record<string, number> = {};
    (data.prevenda_gender || []).forEach(r => { pvGenderMap[r.genero] = Number(r.qtd) || 0; });
    const pvMasc = pvGenderMap["Masculino"] || 0;
    const pvFem = pvGenderMap["Feminino"] || 0;
    const lote1Current = Number(data.lote1_current?.[0]?.qtd) || 0;
    const lote1Prev = Number(data.lote1_prev?.[0]?.qtd) || 0;
    const l1GenderMap: Record<string, number> = {};
    (data.lote1_gender || []).forEach(r => { l1GenderMap[r.genero] = Number(r.qtd) || 0; });
    const l1Masc = l1GenderMap["Masculino"] || 0;
    const l1Fem = l1GenderMap["Feminino"] || 0;
    const pvPrevMap: Record<string, number> = {};
    (data.prevenda_gender_prev || []).forEach(r => { pvPrevMap[r.genero] = Number(r.qtd) || 0; });
    const pvMascPrev = pvPrevMap["Masculino"] || 0;
    const pvFemPrev = pvPrevMap["Feminino"] || 0;
    const l1PrevMap: Record<string, number> = {};
    (data.lote1_gender_prev || []).forEach(r => { l1PrevMap[r.genero] = Number(r.qtd) || 0; });
    const l1MascPrev = l1PrevMap["Masculino"] || 0;
    const l1FemPrev = l1PrevMap["Feminino"] || 0;
    return { countCurrent, countPrev, countAll, countEquipe, fatLiquido, masc, fem, restantes, availableCapacity, mascPct: (masc / totalGender) * 100, femPct: (fem / totalGender) * 100, prevendaCurrent, prevendaPrev, pvMasc, pvFem, lote1Current, lote1Prev, l1Masc, l1Fem, pvMascPrev, pvFemPrev, l1MascPrev, l1FemPrev };
  }, [data]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error || !computed) return <div className="kpi-card text-center py-8"><p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p></div>;

  const barDataHoriz = [{ name: "2025", value: computed.countPrev }, { name: "2026", value: computed.countCurrent }];
  const barDataGender = [{ name: "Masculino", value: computed.masc }, { name: "Feminino", value: computed.fem }];
  const donutGender = [{ name: "Masculino", value: computed.masc }, { name: "Feminino", value: computed.fem }];
  const vendidosPct = (computed.countCurrent / computed.availableCapacity) * 100;
  const restantesPct = (computed.restantes / computed.availableCapacity) * 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Sunset Boat Escuna - CC/Pix" blocks={[
            { year: "2026", filters: ["SUM(Qtd) FROM CM26", "Data BETWEEN startDate AND endDate", "LOWER(Ingresso) LIKE '%sunset boat party%' AND '%sexta%'", "NOT '%cortesia%'", "Meio_de_Pagamento NOT IN ('cortesia','none','free')"] },
            { year: "2025 (YoY −1 ano)", filters: ["COUNT(DISTINCT Transacao_ID) FROM CM25", "Mesmas regras com prevStart..prevEnd"] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.countCurrent)}</p>
          <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatNumber(computed.countPrev)} <VariationText current={computed.countCurrent} previous={computed.countPrev} /></p>
          <p className="text-xs text-muted-foreground mt-1">Total com cortesia: {formatNumber(computed.countAll)}</p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={barDataHoriz} layout="vertical">
                <XAxis type="number" hide /><YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={35} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} label={{ position: "right", fontSize: 12, fontWeight: "bold", fill: "hsl(var(--foreground))" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card flex flex-col items-center">
          <FilterTooltip className="mb-1" title={`Venda x Meta ${META_BOAT}`} blocks={[
            { filters: [`Meta: ${META_BOAT} ingressos (capacidade total)`, `${VAGAS_BLOQUEADAS} vagas bloqueadas`, "Realizado = Sunset Boat Escuna - CC/Pix 2026"] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.countCurrent)}</p>
          <div className="mt-4 flex justify-center max-w-[130px] max-h-[130px] mx-auto">
            <DonutChart value={computed.countCurrent} total={META_BOAT} label="" colors={["#0D4F4F", "#E5E7EB"]} compact />
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Sunset Boat Escuna - Masc vs Fem" blocks={[
            { filters: ["FROM CM26 (período atual)", "LOWER(Ingresso) LIKE '%sunset boat party%' AND '%sexta%'", "Gênero via LOWER(Ingresso) LIKE '%masculino%/%feminino%'", "INCLUI cortesia (CC/Pix + Cortesia)"] },
          ]} />
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={barDataGender} margin={{ top: 20 }}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} /><YAxis hide />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} label={{ position: "top", fontSize: 12, fontWeight: "bold", fill: "hsl(var(--foreground))" }}>
                  {barDataGender.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="kpi-card">
        <FilterTooltip className="mb-2" title={`Ocupação do Barco — Meta ${META_BOAT} (Escuna)`} blocks={[
          { filters: [`Capacidade total: ${META_BOAT}`, `Bloqueadas: ${VAGAS_BLOQUEADAS} (equipe)`, `Disponíveis: ${META_BOAT - VAGAS_BLOQUEADAS}`, "Vendidos = Sunset Boat Escuna - CC/Pix 2026"] },
        ]} />
        <div className="w-full h-7 rounded-full overflow-hidden flex bg-muted">
          {vendidosPct > 0 && <div className="h-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground transition-all" style={{ width: `${Math.min(vendidosPct, 100)}%` }}>{computed.countCurrent}</div>}
          {restantesPct > 0 && <div className="h-full bg-muted-foreground/20 flex items-center justify-center text-[10px] font-bold text-muted-foreground transition-all" style={{ width: `${Math.min(restantesPct, 100)}%` }}>{computed.restantes}</div>}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Vendidos (CC/Pix)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/20 inline-block" /> Restantes</span>
        </div>
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/10 text-destructive font-semibold">
            🔒 {VAGAS_BLOQUEADAS} vagas bloqueadas
          </span>
          <span className="text-muted-foreground">(equipe)</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="kpi-card flex flex-col items-center">
          <FilterTooltip className="mb-2" title="% Sunset Boat Escuna" blocks={[
            { filters: ["Distribuição percentual Masc vs Fem", "Mesmos filtros do card 'Sunset Boat Escuna - Masc vs Fem'"] },
          ]} />
          <div className="relative w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={donutGender} cx="50%" cy="50%" innerRadius={45} outerRadius={65} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                {donutGender.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i]} />)}
              </Pie></PieChart>
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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="kpi-card flex flex-col items-center justify-center">
          <FilterTooltip className="mb-1" title="Total Sunset Boat Escuna CC/Pix/Cortesia" blocks={[
            { filters: ["SUM(Qtd) FROM CM26 (período atual)", "LOWER(Ingresso) LIKE '%sunset boat party%' AND '%sexta%'", "(SEM filtro de Meio_de_Pagamento)"] },
          ]} />
          <p className="text-3xl font-bold font-mono">{formatNumber(computed.countAll)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="kpi-card flex flex-col items-center justify-center">
          <FilterTooltip className="mb-1" title="Faturamento Sunset Boat Escuna" blocks={[
            { filters: ["SUM(Valor_Final − Desconto) FROM CM26", "LOWER(Ingresso) LIKE '%sunset boat party%' AND '%sexta%'", "Meio_de_Pagamento NOT IN ('cortesia','none','free')"] },
          ]} />
          <p className="text-3xl font-bold font-mono">{formatCurrency(computed.fatLiquido)}</p>
          <p className="text-xs text-muted-foreground mt-1">Valor Final - Desconto</p>
        </motion.div>
      </div>
    </div>
  );
}
