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

const META_PASS = 400;
const GENDER_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))"];

interface PassaporteCMData {
  count_cm26: Array<{ qtd: string }>;
  count_cm25: Array<{ qtd: string }>;
  count_all_cm26: Array<{ qtd: string }>;
  count_by_payment_cm26: Array<{ tipo: string; qtd: string }>;
  gender_cm26: Array<{ genero: string; qtd: string }>;
  fat_cm26: Array<{ faturamento: string; desconto: string }>;
  fat_cm25: Array<{ faturamento: string; desconto: string }>;
  lote1_gender_cm26: Array<{ genero: string; qtd: string }>;
  lote1_gender_cm25: Array<{ genero: string; qtd: string }>;
  lote2_gender_cm26: Array<{ genero: string; qtd: string }>;
  lote2_gender_cm25: Array<{ genero: string; qtd: string }>;
}

export function PassaporteSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<PassaporteCMData>("passaporte-cm", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    const countCM26 = Number(data.count_cm26?.[0]?.qtd) || 0;
    const countCM25 = Number(data.count_cm25?.[0]?.qtd) || 0;
    const countAllCM26 = Number(data.count_all_cm26?.[0]?.qtd) || 0;
    const fatCM26 = Number(data.fat_cm26?.[0]?.faturamento) || 0;
    const descCM26 = Number(data.fat_cm26?.[0]?.desconto) || 0;
    const fatLiquido = fatCM26 - descCM26;
    const fatCM25 = Number(data.fat_cm25?.[0]?.faturamento) || 0;
    const descCM25 = Number(data.fat_cm25?.[0]?.desconto) || 0;
    const fatLiquido25 = fatCM25 - descCM25;
    const genderMap: Record<string, number> = {};
    (data.gender_cm26 || []).forEach(r => { genderMap[r.genero] = Number(r.qtd) || 0; });
    const masc = genderMap["Masculino"] || 0;
    const fem = genderMap["Feminino"] || 0;
    const totalGender = masc + fem || 1;
    const paymentMap: Record<string, number> = {};
    (data.count_by_payment_cm26 || []).forEach(r => { paymentMap[r.tipo] = Number(r.qtd) || 0; });
    const ccCount = paymentMap["credit_card"] || 0;
    const pixCount = paymentMap["pix"] || 0;
    const walletCount = paymentMap["wallet"] || 0;
    const moneyCount = paymentMap["money"] || 0;
    const cortesiaCount = paymentMap["cortesia"] || 0;
    const lote1Map26: Record<string, number> = {};
    (data.lote1_gender_cm26 || []).forEach(r => { lote1Map26[r.genero] = Number(r.qtd) || 0; });
    const lote1Map25: Record<string, number> = {};
    (data.lote1_gender_cm25 || []).forEach(r => { lote1Map25[r.genero] = Number(r.qtd) || 0; });
    const lote1Masc26 = lote1Map26["Masculino"] || 0;
    const lote1Fem26 = lote1Map26["Feminino"] || 0;
    const lote1Masc25 = lote1Map25["Masculino"] || 0;
    const lote1Fem25 = lote1Map25["Feminino"] || 0;
    return { countCM26, countCM25, countAllCM26, fatLiquido, fatLiquido25, masc, fem, mascPct: (masc / totalGender) * 100, femPct: (fem / totalGender) * 100, ccCount, pixCount, walletCount, moneyCount, cortesiaCount, lote1Masc26, lote1Fem26, lote1Masc25, lote1Fem25 };
  }, [data]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error || !computed) return <div className="kpi-card text-center py-8"><p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p></div>;

  const barDataHoriz = [{ name: "2025", value: computed.countCM25 }, { name: "2026", value: computed.countCM26 }];
  const barDataGender = [{ name: "Masculino", value: computed.masc }, { name: "Feminino", value: computed.fem }];
  const donutGender = [{ name: "Masculino", value: computed.masc }, { name: "Feminino", value: computed.fem }];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Card 1: Faturamento Passaporte (first position, similar to Faturamento vs Meta from MetasPV) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Faturamento Passaporte CC/Pix/Wallet/Money" blocks={[
            { year: "2026", filters: ["FROM CM26", "Data BETWEEN startDate AND endDate", "(Ingresso LIKE '%Passaporte%' OR LOWER(Ingresso) LIKE '%combo%')", "LOWER(Ingresso) NOT LIKE '%cortesia%'", "Meio_de_Pagamento IN ('credit_card','pix','wallet','money')", "Líquido = Valor_Final − Desconto"] },
            { year: "2025 (YoY −1 ano)", filters: ["FROM CM25 com prevStart..prevEnd, mesmas regras (Passaporte ou combo)"] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatCurrency(computed.fatLiquido)}</p>
          <p className="text-xs text-muted-foreground mt-1">Valor Final - Desconto</p>
          <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatCurrency(computed.fatLiquido25)} <VariationText current={computed.fatLiquido} previous={computed.fatLiquido25} /></p>
        </motion.div>

        {/* Card 2: Total Passaporte CC/Pix */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Total Passaporte CC/Pix/Débito/Wallet/Money" blocks={[
            { year: "2026", filters: ["SUM(Qtd) FROM CM26", "Data BETWEEN startDate AND endDate", "(Ingresso LIKE '%Passaporte%' OR LOWER(Ingresso) LIKE '%combo%')", "LOWER(Ingresso) NOT LIKE '%cortesia%'", "Meio_de_Pagamento IN ('credit_card','pix','debit_card','wallet','money')"] },
            { year: "2025 (YoY −1 ano)", filters: ["FROM CM25 com prevStart..prevEnd, mesmas regras (Passaporte ou combo, inclui debit_card)"] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.countCM26)}</p>
          <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatNumber(computed.countCM25)} <VariationText current={computed.countCM26} previous={computed.countCM25} /></p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={barDataHoriz} layout="vertical" margin={{ top: 5, right: 45, bottom: 5, left: 0 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={35} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} label={{ position: "right", fontSize: 12, fontWeight: "bold", fill: "hsl(var(--foreground))" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Card 3: Venda x Meta 400 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card flex flex-col items-center">
          <FilterTooltip className="mb-1" title={`Venda x Meta ${META_PASS}`} blocks={[
            { filters: [`Meta: ${META_PASS} passaportes`, "Realizado = Total Passaporte CC/Pix/Débito/Wallet/Money 2026", "(mesmos filtros do card 'Total Passaporte CC/Pix/Débito/Wallet/Money')"] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.countCM26)}</p>
          <div className="mt-4 flex justify-center max-w-[130px] max-h-[130px] mx-auto">
            <DonutChart value={computed.countCM26} total={META_PASS} label="" colors={["#0D4F4F", "#E5E7EB"]} compact />
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Card 4: Passaporte - Masc vs Fem */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Passaporte - Masc vs Fem CC/Pix/Cortesia" blocks={[
            { filters: ["FROM CM26 (período atual)", "(Ingresso LIKE '%Passaporte%' OR LOWER(Ingresso) LIKE '%combo%')", "Gênero via Ingresso LIKE '%Masculino%/%Feminino%'", "Meio_de_Pagamento IN ('credit_card','pix','cortesia')"] },
          ]} />

          <div className="mt-3">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={barDataGender} margin={{ top: 30, right: 10, bottom: 5, left: 10 }}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} /><YAxis hide />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} label={{ position: "top", fontSize: 12, fontWeight: "bold", fill: "hsl(var(--foreground))" }}>
                  {barDataGender.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Card 5: % Passaporte */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="kpi-card flex flex-col items-center">
          <FilterTooltip className="mb-2" title="% Passaporte CC/Pix/Cortesia" blocks={[
            { filters: ["Distribuição percentual Masc vs Fem", "Mesmos filtros do card 'Passaporte - Masc vs Fem CC/Pix/Cortesia'"] },
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

        {/* Card 6: Total Passaporte CC/Pix/Wallet/Cortesia */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="kpi-card flex flex-col items-center justify-center">
          <FilterTooltip className="mb-1" title="Total Passaporte CC/Pix/Cortesia" blocks={[
            { year: "Total (todas as formas)", filters: ["SUM(Qtd) FROM CM26", "Data BETWEEN startDate AND endDate", "(Ingresso LIKE '%Passaporte%' OR LOWER(Ingresso) LIKE '%combo%')", "(SEM filtro de Meio_de_Pagamento)"] },
            { year: "Quebra por meio", filters: ["CASE: cortesia | credit_card | pix | wallet | money", "GROUP BY tipo"] },
          ]} />
          <p className="text-3xl font-bold font-mono">{formatNumber(computed.countAllCM26)}</p>
          {(() => {
            const total = computed.ccCount + computed.pixCount + computed.walletCount + computed.moneyCount + computed.cortesiaCount || 1;
            const ccPct = (computed.ccCount / total) * 100;
            const pixPct = (computed.pixCount / total) * 100;
            const walletPct = (computed.walletCount / total) * 100;
            const moneyPct = (computed.moneyCount / total) * 100;
            const cortPct = (computed.cortesiaCount / total) * 100;
            return (
              <div className="w-full mt-4 space-y-2">
                <div className="w-full h-6 rounded-full overflow-hidden flex bg-muted">
                  {ccPct > 0 && <div className="h-full flex items-center justify-center text-[10px] font-bold text-primary-foreground" style={{ width: `${ccPct}%`, backgroundColor: "hsl(var(--primary))" }}>{computed.ccCount}</div>}
                  {pixPct > 0 && <div className="h-full flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${pixPct}%`, backgroundColor: "hsl(var(--accent))" }}>{computed.pixCount}</div>}
                  {walletPct > 0 && <div className="h-full flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${walletPct}%`, backgroundColor: "hsl(210, 60%, 50%)" }}>{computed.walletCount}</div>}
                  {moneyPct > 0 && <div className="h-full flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${moneyPct}%`, backgroundColor: "hsl(30, 70%, 50%)" }}>{computed.moneyCount}</div>}
                  {cortPct > 0 && <div className="h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground" style={{ width: `${cortPct}%`, backgroundColor: "hsl(var(--muted))" }}>{computed.cortesiaCount}</div>}
                </div>
                <div className="flex justify-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "hsl(var(--primary))" }} /> CC</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "hsl(var(--accent))" }} /> Pix</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "hsl(210, 60%, 50%)" }} /> Wallet</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "hsl(30, 70%, 50%)" }} /> Money</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "hsl(var(--muted))" }} /> Cortesia</span>
                </div>
              </div>
            );
          })()}
        </motion.div>
      </div>

    </div>
  );
}

export function Passaporte1oLoteSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<PassaporteCMData>("passaporte-cm", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    const lote1Map26: Record<string, number> = {};
    (data.lote1_gender_cm26 || []).forEach(r => { lote1Map26[r.genero] = Number(r.qtd) || 0; });
    const lote1Map25: Record<string, number> = {};
    (data.lote1_gender_cm25 || []).forEach(r => { lote1Map25[r.genero] = Number(r.qtd) || 0; });
    return {
      lote1Masc26: lote1Map26["Masculino"] || 0,
      lote1Fem26: lote1Map26["Feminino"] || 0,
      lote1Masc25: lote1Map25["Masculino"] || 0,
      lote1Fem25: lote1Map25["Feminino"] || 0,
    };
  }, [data]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error || !computed) return <div className="kpi-card text-center py-8"><p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p></div>;

  return (
    <div className="grid grid-cols-1 gap-4 items-stretch">
      {/* Card: Total Passaporte 1º Lote */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="kpi-card flex flex-col items-center justify-center text-center">
        <FilterTooltip className="mb-1" title="Total Passaporte 1º Lote" blocks={[
          { year: "2026", filters: ["FROM CM26 (período atual)", "Ingresso LIKE '%Passaporte%' AND '%1º Lote%'", "NOT '%cortesia%'", "Meio_de_Pagamento IN ('credit_card','pix','wallet','money')", "Soma Masc + Fem"] },
          { year: "2025", filters: ["FROM f_vendas_CM26 WHERE ano = 2025", "Mesmos filtros de Ingresso/Pagamento"] },
        ]} />
        <p className="text-3xl font-bold font-mono">{formatNumber(computed.lote1Masc26 + computed.lote1Fem26)}</p>
        <p className="text-xs text-muted-foreground mt-2">Total 1º Lote 2025: {formatNumber(computed.lote1Masc25 + computed.lote1Fem25)}</p>
      </motion.div>
    </div>
  );
}

export function Passaporte2oLoteSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<PassaporteCMData>("passaporte-cm", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    const lote2Map26: Record<string, number> = {};
    (data.lote2_gender_cm26 || []).forEach(r => { lote2Map26[r.genero] = Number(r.qtd) || 0; });
    const lote2Map25: Record<string, number> = {};
    (data.lote2_gender_cm25 || []).forEach(r => { lote2Map25[r.genero] = Number(r.qtd) || 0; });
    return {
      lote2Masc26: lote2Map26["Masculino"] || 0,
      lote2Fem26: lote2Map26["Feminino"] || 0,
      lote2Masc25: lote2Map25["Masculino"] || 0,
      lote2Fem25: lote2Map25["Feminino"] || 0,
    };
  }, [data]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error || !computed) return <div className="kpi-card text-center py-8"><p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p></div>;

  return (
    <div className="grid grid-cols-1 gap-4 items-stretch">
      {/* Card: Total Passaporte 2º Lote */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="kpi-card flex flex-col items-center justify-center text-center">
        <FilterTooltip className="mb-1" title="Total Passaporte 2º Lote" blocks={[
          { year: "2026", filters: ["FROM CM26 (período atual)", "Ingresso LIKE '%Passaporte%' AND '%2º Lote%'", "NOT '%cortesia%'", "Meio_de_Pagamento IN ('credit_card','pix','wallet','money')", "Soma Masc + Fem"] },
          { year: "2025", filters: ["FROM f_vendas_CM26 WHERE ano = 2025", "Mesmos filtros de Ingresso/Pagamento"] },
        ]} />
        <p className="text-3xl font-bold font-mono">{formatNumber(computed.lote2Masc26 + computed.lote2Fem26)}</p>
        <p className="text-xs text-muted-foreground mt-2">Total 2º Lote 2025: {formatNumber(computed.lote2Masc25 + computed.lote2Fem25)}</p>
      </motion.div>
    </div>
  );
}
