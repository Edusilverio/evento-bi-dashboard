import { useMemo } from "react";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";
import { VariationText } from "@/components/dashboard/VariationText";
import { ParcelamentosSection } from "@/components/dashboard/sections/ParcelamentosSection";

interface DemograficoData {
  age_bars: Array<{ faixa: string; qtd: string }>;
  age_pie: Array<{ faixa: string; qtd: string }>;
  total_cc_pix: Array<{ qtd: string; faturamento: string }>;
  total_cc_pix_prev: Array<{ qtd: string; faturamento: string }>;
  payment_bars: Array<{ meio: string; qtd: string }>;
  region: Array<{ estado: string; qtd: string }>;
}

const TEAL_PALETTE = [
  "hsl(180, 73%, 18%)", "hsl(180, 60%, 28%)", "hsl(180, 50%, 38%)",
  "hsl(180, 40%, 48%)", "hsl(180, 30%, 58%)", "hsl(180, 25%, 65%)", "hsl(180, 20%, 72%)",
];

const PAYMENT_LABELS: Record<string, string> = { credit_card: "Cartão de Crédito", pix: "Pix", wallet: "Wallet", debit_card: "Débito" };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium">{label}</p>
      <p className="font-mono font-bold">{formatNumber(payload[0].value)}</p>
    </div>
  );
};

export function DemograficoSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<DemograficoData>("demografico", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    const ageBars = (data.age_bars || []).map(r => ({ name: r.faixa, value: Number(r.qtd) || 0 }));
    const totalCcPix = Number(data.total_cc_pix?.[0]?.qtd) || 0;
    const fatCcPix = Number(data.total_cc_pix?.[0]?.faturamento) || 0;
    const totalCcPixPrev = Number(data.total_cc_pix_prev?.[0]?.qtd) || 0;
    const fatCcPixPrev = Number(data.total_cc_pix_prev?.[0]?.faturamento) || 0;
    const paymentBars = (data.payment_bars || []).map(r => ({ name: PAYMENT_LABELS[r.meio] || r.meio, value: Number(r.qtd) || 0 }));
    const regionBars = (data.region || []).map(r => ({ name: r.estado || "N/A", value: Number(r.qtd) || 0 }));

    const agePieData = (data.age_pie || []).map(r => ({ name: r.faixa, value: Number(r.qtd) || 0 }));
    const ageTotal = agePieData.reduce((s, r) => s + r.value, 0) || 1;
    const agePie = agePieData.map(r => ({ ...r, pct: ((r.value / ageTotal) * 100).toFixed(1) }));

    const payTotal = paymentBars.reduce((s, r) => s + r.value, 0) || 1;
    const payPie = paymentBars.map(r => ({ ...r, pct: ((r.value / payTotal) * 100).toFixed(1) }));

    const regionTotal = regionBars.reduce((s, r) => s + r.value, 0) || 1;
    const regionPie = regionBars.map(r => ({ ...r, pct: ((r.value / regionTotal) * 100).toFixed(1) }));

    return { ageBars, agePie, totalCcPix, fatCcPix, totalCcPixPrev, fatCcPixPrev, paymentBars, payPie, regionBars, regionPie };
  }, [data]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error || !computed) return <div className="kpi-card text-center py-8"><p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p></div>;

  return (
    <div className="space-y-4">
      {/* Row 1: Faixa Etária bars + pie + KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
          <FilterTooltip className="mb-3" title="Faixa Etária - CC/Pix/Cortesia" blocks={[
            { filters: ["GROUP BY Faixa_Etaria", "FROM CM25 ∪ CM26", "Data BETWEEN startDate AND endDate", "LOWER(Meio_de_Pagamento) NOT IN ('none')", "Faixa_Etaria != 'Outras Idades'"] },
          ]} />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={computed.ageBars} margin={{ top: 20, right: 10 }}>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={36}
                label={{ position: "top", fontSize: 11, fontWeight: "bold", fill: "hsl(var(--foreground))" }} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card flex flex-col items-center">
          <FilterTooltip className="mb-3" title="Faixa Etária — Todos os Ingressos" blocks={[
            { filters: ["GROUP BY Faixa_Etaria", "FROM CM25 ∪ CM26", "LOWER(Meio_de_Pagamento) NOT IN ('free','none','cortesia')", "Faixa_Etaria != 'Outras Idades'"] },
          ]} />
          <div className="relative w-44 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={computed.agePie} cx="50%" cy="50%" innerRadius={40} outerRadius={70} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                  {computed.agePie.map((_, i) => <Cell key={i} fill={TEAL_PALETTE[i % TEAL_PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(val: number) => formatNumber(val)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {computed.agePie.map((item, i) => (
              <span key={item.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: TEAL_PALETTE[i % TEAL_PALETTE.length] }} />
                {item.name} ({item.pct}%)
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card flex flex-col items-center justify-center">
          <FilterTooltip className="mb-2" title="Total Ingressos Festa - CC/Pix" blocks={[
            { year: "2026 (período atual)", filters: ["SUM(Qtd) FROM CM25 ∪ CM26", "Data BETWEEN startDate AND endDate", "Meio_de_Pagamento NOT IN ('cortesia','none','free')", "EXCLUI Ingresso LIKE: pousada, hospedagem, bangalo, bangalô, único e AÉREO AVULSO", "COMBO entra: +1 ingresso na contagem, e no faturamento só a parcela do passaporte (Valor_Final − Desconto − parcela aérea do lote/gênero: PV 2.900 · 1º 2.750 · 2ºF 2.600 · 2º 2.700 · 3º 3.100 · demais 2.800)", "NÃO exclui opening/openning (em 2026 a abertura faz parte do produto)"] },
            { year: "Faturamento 2026", filters: ["SUM(Valor_Final) − SUM(Desconto)", "Combo: só a parcela do passaporte (a parcela aérea continua fora)", "Demais filtros iguais aos acima"] },
            { year: "2025 (ano anterior, YoY −1 ano)", filters: ["Mesmos filtros acima (ingressos e faturamento)", "Data BETWEEN prevStart AND prevEnd", "EXCLUI Ingresso LIKE: opening, openning (em 2025 a abertura era vendida de forma diferente)"] },
          ]} />
          <p className="text-[9px] text-muted-foreground/70 mb-1">(exclui hospedagem, aéreo avulso e cortesia — combo entra com a parcela do passaporte — opening party excluído apenas de 2025)</p>
          <p className="text-4xl font-bold font-mono">{formatNumber(computed.totalCcPix)}</p>
          <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatNumber(computed.totalCcPixPrev)} <VariationText current={computed.totalCcPix} previous={computed.totalCcPixPrev} /></p>
          <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">Faturamento</p>
          <p className="text-2xl font-bold font-mono text-primary">{formatCurrency(computed.fatCcPix)}</p>
          <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatCurrency(computed.fatCcPixPrev)} <VariationText current={computed.fatCcPix} previous={computed.fatCcPixPrev} /></p>
        </motion.div>
      </div>

      {/* Row 2: Meios de Pagamento */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="kpi-card">
        <FilterTooltip className="mb-3" title="Meios de Pagamentos - CC/Pix" blocks={[
          { filters: ["GROUP BY Meio_de_Pagamento", "FROM CM25 ∪ CM26", "LOWER(Meio_de_Pagamento) IN ('credit_card','pix','wallet')", "Faixa_Etaria != 'Outras Idades'"] },
        ]} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={computed.paymentBars} margin={{ top: 20, right: 10 }}>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={50}
                label={{ position: "top", fontSize: 11, fontWeight: "bold", fill: "hsl(var(--foreground))" }}>
                {computed.paymentBars.map((_, i) => <Cell key={i} fill={TEAL_PALETTE[i % TEAL_PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-col items-center">
            <div className="relative w-44 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={computed.payPie} cx="50%" cy="50%" innerRadius={40} outerRadius={70} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                    {computed.payPie.map((_, i) => <Cell key={i} fill={TEAL_PALETTE[i % TEAL_PALETTE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(val: number) => formatNumber(val)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {computed.payPie.map((item, i) => (
                <span key={item.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: TEAL_PALETTE[i % TEAL_PALETTE.length] }} />
                  {item.name} ({item.pct}%)
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Row 2b: Parcelamentos CC */}
      <ParcelamentosSection dateRange={dateRange} />



      {/* Row 3: Região bars + pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="kpi-card">
          <FilterTooltip className="mb-3" title="Região Qtd Ingressos" blocks={[
            { filters: ["GROUP BY Estado", "FROM CM25 ∪ CM26", "LOWER(Meio_de_Pagamento) NOT IN ('none')", "Faixa_Etaria != 'Outras Idades'", "ORDER BY qtd DESC LIMIT 15"] },
          ]} />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={computed.regionBars} margin={{ top: 20, right: 10 }}>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={32}
                label={{ position: "top", fontSize: 10, fontWeight: "bold", fill: "hsl(var(--foreground))" }}>
                {computed.regionBars.map((_, i) => <Cell key={i} fill={TEAL_PALETTE[i % TEAL_PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="kpi-card flex flex-col items-center">
          <FilterTooltip className="mb-3" title="Região CC/Pix/Cortesia" blocks={[
            { filters: ["Distribuição percentual por Estado", "Mesmos filtros do card 'Região Qtd Ingressos'"] },
          ]} />
          <div className="relative w-52 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={computed.regionPie} cx="50%" cy="50%" innerRadius={50} outerRadius={85} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                  {computed.regionPie.map((_, i) => <Cell key={i} fill={TEAL_PALETTE[i % TEAL_PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(val: number) => formatNumber(val)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 justify-center max-w-xs">
            {computed.regionPie.slice(0, 10).map((item, i) => (
              <span key={item.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: TEAL_PALETTE[i % TEAL_PALETTE.length] }} />
                {item.name} ({item.pct}%)
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
