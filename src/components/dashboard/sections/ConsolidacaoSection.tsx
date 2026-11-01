import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { DataTable } from "@/components/dashboard/DataTable";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";
import { VariationText, ValueWithColor } from "@/components/dashboard/VariationText";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";

const MONTH_NAMES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const META_RECEITA_GERAL = 2500000;

interface ConsolidadoData {
  totals: Array<{ faturamento: string; total_ingressos: string; total_desconto: string }>;
  totals_prev: Array<{ faturamento: string; total_ingressos: string; total_desconto: string }>;
  fat_evento_89311: Array<{ total: string; desconto: string }>;
  fat_evento_89312: Array<{ total: string; desconto: string }>;
  passaportes: Array<{ qtd_passaportes: string }>;
  passaportes_prev: Array<{ qtd_passaportes: string }>;
  gauge_pv_receita: Array<{ receita_pv: string }>;
  gauge_pv_qtd: Array<{ qtd_pv: string }>;
  monthly: Array<{ mes: string; faturamento: string; ingressos: string }>;
  monthly_prev: Array<{ mes: string; faturamento: string; ingressos: string }>;
  detail: Array<{ data: string; ingresso: string; qtd: string; receita: string; pagamento: string }>;
  ingressos_total_current: Array<{ total_ingressos: string }>;
  ingressos_total_prev: Array<{ total_ingressos: string }>;
  ingressos_aereo_no_total: Array<{ qtd: string }>;
  ingressos_abertura_no_total: Array<{ qtd: string }>;
  hospedagem_current: Array<{ qtd_hospedagem: string }>;
  hospedagem_prev: Array<{ qtd_hospedagem: string }>;
  fat_hospedagem: Array<{ fat_hospedagem: string }>;
  fat_hospedagem_prev: Array<{ fat_hospedagem: string }>;
  aereo_current: Array<{ qtd_aereo: string }>;
  aereo_prev: Array<{ qtd_aereo: string }>;
  fat_aereo: Array<{ fat_aereo: string }>;
  cortesia_total: Array<{ qtd: string }>;
  cortesia_fem: Array<{ qtd: string }>;
  cortesia_masc: Array<{ qtd: string }>;
  cortesia_passaporte: Array<{ qtd: string }>;
  cortesia_brunch: Array<{ qtd: string }>;
  cortesia_spritz: Array<{ qtd: string }>;
  cortesia_escuna: Array<{ qtd: string }>;
  cortesia_festas: Array<{ qtd: string }>;
  cortesia_corrida: Array<{ qtd: string }>;
}

export function ConsolidacaoSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<ConsolidadoData>("consolidado-cm", dateRange);



  const computed = useMemo(() => {
    if (!data?.totals?.[0]) return null;
    const t = data.totals[0];
    const prev = data.totals_prev?.[0];
    const fat = Number(t.faturamento) || 0;
    const totalDesconto = Number(t.total_desconto) || 0;
    const fatBrutoCupom = fat - totalDesconto;
    const fatPrev = Number(prev?.faturamento) || 0;
    const prevDesconto = Number(prev?.total_desconto) || 0;
    const fatPrevBruto = fatPrev - prevDesconto;

    const e89311 = data.fat_evento_89311?.[0];
    const e89312 = data.fat_evento_89312?.[0];
    const fatCC = (Number(e89311?.total) || 0) - (Number(e89311?.desconto) || 0);
    const fatPix = (Number(e89312?.total) || 0) - (Number(e89312?.desconto) || 0);

    const ingressosCurrent = Number(data.ingressos_total_current?.[0]?.total_ingressos) || 0;
    const ingressosPrev = Number(data.ingressos_total_prev?.[0]?.total_ingressos) || 0;
    const aereoNoTotal = Number(data.ingressos_aereo_no_total?.[0]?.qtd) || 0;
    const aberturaNoTotal = Number(data.ingressos_abertura_no_total?.[0]?.qtd) || 0;
    const hospCurrent = Number(data.hospedagem_current?.[0]?.qtd_hospedagem) || 0;
    const hospPrev = Number(data.hospedagem_prev?.[0]?.qtd_hospedagem) || 0;
    const fatHospedagem = Number(data.fat_hospedagem?.[0]?.fat_hospedagem) || 0;
    const fatHospedagemPrev = Number(data.fat_hospedagem_prev?.[0]?.fat_hospedagem) || 0;
    const aereoCurrent = Number(data.aereo_current?.[0]?.qtd_aereo) || 0;
    const aereoPrev = Number(data.aereo_prev?.[0]?.qtd_aereo) || 0;
    const fatAereo = Number(data.fat_aereo?.[0]?.fat_aereo) || 0;
    const cortesiaTotal = Number(data.cortesia_total?.[0]?.qtd) || 0;
    const cortesiaFem = Number(data.cortesia_fem?.[0]?.qtd) || 0;
    const cortesiaMasc = Number(data.cortesia_masc?.[0]?.qtd) || 0;
    const cortesiaPassaporte = Number(data.cortesia_passaporte?.[0]?.qtd) || 0;
    const cortesiaBrunch = Number(data.cortesia_brunch?.[0]?.qtd) || 0;
    const cortesiaSpritz = Number(data.cortesia_spritz?.[0]?.qtd) || 0;
    const cortesiaEscuna = Number(data.cortesia_escuna?.[0]?.qtd) || 0;
    const cortesiaFestas = Number(data.cortesia_festas?.[0]?.qtd) || 0;
    

    const monthly = (data.monthly || []).map(m => ({
      mes: MONTH_NAMES[Number(m.mes)] || m.mes,
      fat2026: Number(m.faturamento), ingressos2026: Number(m.ingressos),
    }));
    const monthlyPrev = (data.monthly_prev || []).map(m => ({
      mes: MONTH_NAMES[Number(m.mes)] || m.mes,
      fat2025: Number(m.faturamento), ingressos2025: Number(m.ingressos),
    }));
    const allMonths = [...new Set([...monthly.map(m => m.mes), ...monthlyPrev.map(m => m.mes)])];
    const comparison = allMonths.map(mes => ({
      mes,
      fat2026: monthly.find(m => m.mes === mes)?.fat2026 || 0,
      fat2025: monthlyPrev.find(m => m.mes === mes)?.fat2025 || 0,
      ingressos2026: monthly.find(m => m.mes === mes)?.ingressos2026 || 0,
      ingressos2025: monthlyPrev.find(m => m.mes === mes)?.ingressos2025 || 0,
    }));

    // 2026 usa o faturamento aereo real (avulso pelo valor da linha + parcela aerea dos combos).
    // 2025 nao tem essa decomposicao no BigQuery, entao segue com a estimativa de 2800 por ingresso.
    const fatSemAereo = fatBrutoCupom - fatAereo;
    const fatPrevSemAereo = fatPrevBruto - (aereoPrev * 2800);

    const ingressosSemAereo = ingressosCurrent - aereoNoTotal;
    const ingressosSemAereoSemAbertura = ingressosSemAereo - aberturaNoTotal;

    return {
      fat, fatPrev, fatCC, fatPix, fatBrutoCupom, fatPrevBruto,
      ingressosCurrent, ingressosPrev, hospCurrent, hospPrev, fatHospedagem, fatHospedagemPrev,
      aereoCurrent, aereoPrev, fatAereo,
      cortesiaTotal, cortesiaFem, cortesiaMasc, cortesiaPassaporte, cortesiaBrunch, cortesiaSpritz, cortesiaEscuna, cortesiaFestas,
      fatSemAereo, fatPrevSemAereo,
      ingressosSemAereo, ingressosSemAereoSemAbertura,
      comparison,
      detail: (data.detail || []).map(d => ({ data: d.data, ingresso: d.ingresso, qtd: Number(d.qtd), receita: Number(d.receita), pagamento: d.pagamento })),
      totalDetailQtd: (data.detail || []).reduce((s, d) => s + (Number(d.qtd) || 0), 0),
      totalDetailReceita: (data.detail || []).reduce((s, d) => s + (Number(d.receita) || 0), 0),
    };
  }, [data]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error || !computed) return <div className="kpi-card text-center py-8"><p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p></div>;

  const ingressosCompData = [{ name: "2025", value: computed.ingressosPrev }, { name: "2026", value: computed.ingressosCurrent }];
  const hospCompData = [{ name: "2025", value: computed.hospPrev }, { name: "2026", value: computed.hospCurrent }];
  const aereoCompData = [{ name: "2025", value: computed.aereoPrev }, { name: "2026", value: computed.aereoCurrent }];
  const cortesiaGenderData = [{ name: "Feminino", value: computed.cortesiaFem }, { name: "Masculino", value: computed.cortesiaMasc }];


  return (
    <div className="space-y-4">
      {/* Row 1: Faturamento + Atingimento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card flex flex-col p-6 min-w-0 overflow-hidden">
          <FilterTooltip className="mb-2" title="Faturamento vs Meta CC/Pix" blocks={[
            { year: "2026 (Net = Valor_Final − Desconto)", filters: ["Tabela: CM25 ∪ CM26", "Data BETWEEN startDate AND endDate", "Meio_de_Pagamento NOT IN ('cortesia','none','free')"] },
            { year: "2025 (mesmo período YoY −1 ano)", filters: ["Mesmas regras com prevStart..prevEnd"] },
            { year: "Quebra por loja de venda (Evento_ID)", filters: ["Loja Cartão: Evento_ID = 89311", "Loja Pix: Evento_ID = 89312", "Corrida (Evento_ID = 104146): evento único, sem lojas separadas — entra pelo meio de pagamento real (credit_card/debit_card/wallet → Loja Cartão; pix/money → Loja Pix)", "(Valor_Final − Desconto)", "Atenção: loja ≠ meio de pagamento. O meio de pagamento efetivo está no gráfico de meios de pagamento."] },
          ]} />
          <p className="text-2xl md:text-3xl font-bold font-mono whitespace-nowrap"><ValueWithColor value={computed.fatBrutoCupom} format={formatCurrency} /></p>
          <p className="text-sm text-muted-foreground mt-2">Ano anterior: {formatCurrency(computed.fatPrevBruto)} <VariationText current={computed.fatBrutoCupom} previous={computed.fatPrevBruto} /></p>
          <p className="text-sm text-muted-foreground mt-1">Meta: {formatCurrency(META_RECEITA_GERAL)} <span className={`text-xs font-semibold ${computed.fatBrutoCupom >= META_RECEITA_GERAL ? "text-emerald-600" : "text-destructive"}`}>{((computed.fatBrutoCupom / META_RECEITA_GERAL) * 100).toFixed(1)}%</span></p>
          <div className="flex flex-wrap gap-3 mt-4 text-sm">
            <div className="min-w-0"><span className="text-muted-foreground">Loja Cartão: </span><span className="font-semibold font-mono"><ValueWithColor value={computed.fatCC} format={formatCurrency} /></span></div>
            <div className="min-w-0"><span className="text-muted-foreground">Loja Pix: </span><span className="font-semibold font-mono"><ValueWithColor value={computed.fatPix} format={formatCurrency} /></span></div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Sem aéreo: {formatCurrency(computed.fatSemAereo)} — Ano anterior: {formatCurrency(computed.fatPrevSemAereo)} <VariationText current={computed.fatSemAereo} previous={computed.fatPrevSemAereo} /></p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="kpi-card flex flex-col items-center justify-center">
          <FilterTooltip className="mb-2" title="Atingimento da Meta" blocks={[
            { filters: [`Meta global: R$ ${META_RECEITA_GERAL.toLocaleString('pt-BR')}`, "Realizado = Faturamento Líquido (Bruto − Desconto)", "Mesmos filtros do card 'Faturamento vs Meta'"] },
          ]} />
          {(() => {
            const pct = ((computed.fatBrutoCupom / META_RECEITA_GERAL) * 100);
            const restante = META_RECEITA_GERAL - computed.fatBrutoCupom;
            const donutData = [
              { name: "Realizado", value: computed.fatBrutoCupom },
              { name: "Restante", value: Math.max(restante, 0) },
            ];
            return (
              <div className="relative w-full flex items-center justify-center" style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" innerRadius={50} outerRadius={70} startAngle={90} endAngle={-270} strokeWidth={0}>
                      <Cell fill="#0D4F4F" />
                      <Cell fill="#E5E7EB" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold font-mono" style={{ color: "#0D4F4F" }}>{pct.toFixed(1)}%</span>
                </div>
              </div>
            );
          })()}
          <p className="text-xs text-muted-foreground mt-1">Falta: {formatCurrency(Math.max(META_RECEITA_GERAL - computed.fatBrutoCupom, 0))}</p>
        </motion.div>
      </div>

      {/* Row 2: Ingressos + Hospedagem + Aéreo + Cortesia */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Total Ingressos CC/Pix" blocks={[
            { year: "2026", filters: ["SUM(Qtd) FROM CM25 ∪ CM26", "Data BETWEEN startDate AND endDate", "Meio_de_Pagamento NOT IN ('cortesia','none','free')", "Conta todas as linhas vendidas, inclusive hospedagem — é o mesmo total da tabela de Detalhamento logo abaixo"] },
            { year: "2025 (YoY −1 ano)", filters: ["Mesma regra com prevStart..prevEnd", "EXCLUI a abertura (em 2026 ela virou parte do passaporte)"] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.ingressosCurrent)}</p>
          <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatNumber(computed.ingressosPrev)} <VariationText current={computed.ingressosCurrent} previous={computed.ingressosPrev} /></p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={ingressosCompData} margin={{ top: 20 }}>
                <XAxis dataKey="name" stroke="hsl(0 0% 45%)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Bar dataKey="value" name="Ingressos" fill="#0D4F4F" radius={[4, 4, 0, 0]} barSize={36} label={{ position: "top", fontSize: 12, fontWeight: "bold", fill: "#333" }} />
              </BarChart>
          </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Sem aéreo: {formatNumber(computed.ingressosSemAereo)} — Ano anterior: {formatNumber(computed.ingressosPrev)} <VariationText current={computed.ingressosSemAereo} previous={computed.ingressosPrev} /></p>
          <p className="text-xs text-muted-foreground mt-1">Sem aéreo e sem abertura: {formatNumber(computed.ingressosSemAereoSemAbertura)} — Ano anterior: {formatNumber(computed.ingressosPrev)} <VariationText current={computed.ingressosSemAereoSemAbertura} previous={computed.ingressosPrev} /></p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Total Hospedagem" blocks={[
            { year: "2026", filters: ["SUM(Qtd) FROM CM25 ∪ CM26", "Data BETWEEN startDate AND endDate", "LOWER(Ingresso) LIKE '%titular%'", "Meio_de_Pagamento NOT IN ('cortesia','none','free')"] },
            { year: "2025 (YoY −1 ano)", filters: ["LOWER(Ingresso) LIKE '%pousada%' OR '%hospedagem%' OR '%bangalo%' OR '%bangalô%'", "AND NOT LIKE '%extra%'", "Meio_de_Pagamento NOT IN ('cortesia','none','free')"] },
            { year: "Fat. Hospedagem", filters: ["(Valor_Final − Desconto)", "LIKE '%pousada/hospedagem/bangalo/extra%'", "Soma TODAS as linhas de hospedagem (28), incluindo complementos de pagamento e diárias extras", "Grandezas diferentes: a contagem é de quartos, o valor é de todas as linhas — não dividir um pelo outro"] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.hospCurrent)} <span className="text-sm font-normal text-muted-foreground">quartos</span></p>
          <p className="text-[10px] text-muted-foreground">Contagem de quartos (linhas "TITULAR")</p>
          <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatNumber(computed.hospPrev)} <VariationText current={computed.hospCurrent} previous={computed.hospPrev} /></p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={hospCompData} layout="vertical" margin={{ top: 5, right: 45, bottom: 5, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" stroke="hsl(0 0% 45%)" fontSize={11} tickLine={false} axisLine={false} width={35} />
                <Bar dataKey="value" name="Hospedagens" fill="#0D4F4F" radius={[0, 4, 4, 0]} barSize={20} label={{ position: "right", fontSize: 12, fontWeight: "bold", fill: "#333" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 pt-2 border-t border-border text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fat. Hospedagem CC/Pix</p>
            <p className="text-lg font-bold font-mono mt-1" style={{ color: "#0D4F4F" }}><ValueWithColor value={computed.fatHospedagem} format={formatCurrency} /></p>
            <p className="text-[10px] text-muted-foreground">Todas as linhas de hospedagem (inclui complementos de pagamento e diárias extras)</p>
            <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatCurrency(computed.fatHospedagemPrev)} <VariationText current={computed.fatHospedagem} previous={computed.fatHospedagemPrev} /></p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Total Aéreo" blocks={[
            { year: "2026", filters: ["SUM(Qtd) FROM CM25 ∪ CM26", "Data BETWEEN startDate AND endDate", "LOWER(Ingresso) LIKE '%aéreo%' OR '%aereo%'", "Meio_de_Pagamento NOT IN ('cortesia','none','free')"] },
            { year: "2025 (YoY −1 ano)", filters: ["Mesmas regras com prevStart..prevEnd"] },
            { year: "Fat. Aéreo CC/Pix", filters: ["Parcela aérea real, não estimativa", "Combo: preço do combo menos o preço do passaporte do mesmo lote e gênero (PV 2.900 · 1º 2.750 · 2ºF 2.600 · 2ºM 2.700 · 3º 3.100)", "Aéreo avulso: valor cheio da linha", "Lote sem preço próprio cai no fallback de 2.800 — hoje nenhum combo cai nele"] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.aereoCurrent)}</p>
          <p className="text-xs text-muted-foreground mt-1">Ano anterior: {formatNumber(computed.aereoPrev)} <VariationText current={computed.aereoCurrent} previous={computed.aereoPrev} /></p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={aereoCompData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" stroke="hsl(0 0% 45%)" fontSize={11} tickLine={false} axisLine={false} width={35} />
                <Bar dataKey="value" name="Aéreo" fill="#0D4F4F" radius={[0, 4, 4, 0]} barSize={20} label={{ position: "right", fontSize: 12, fontWeight: "bold", fill: "#333" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 pt-2 border-t border-border text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fat. Aéreo CC/Pix</p>
            <p className="text-lg font-bold font-mono mt-1" style={{ color: "#0D4F4F" }}><ValueWithColor value={computed.fatAereo} format={formatCurrency} /></p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="kpi-card">
          <FilterTooltip className="mb-1" title="Cortesias CM" blocks={[
            { year: "Período atual", filters: ["SUM(Qtd) FROM CM25 ∪ CM26", "Data BETWEEN startDate AND endDate", "Meio_de_Pagamento = 'cortesia'"] },
            { year: "Por gênero", filters: ["Feminino: Ingresso LIKE '%Feminino%'", "Masculino: Ingresso LIKE '%Masculino%'"] },
            { year: "Quebra por produto (todas as cortesias CM26)", filters: ["Passaporte: cortesia AND passaporte", "Brunch: cortesia AND brunch", "Barco Spritz: cortesia AND 'sunset boat party spritz'", "Barco Escuna: cortesia AND 'sunset boat party azul'", "Festas individuais: o restante (não cai nos 4 acima)"] },
            { year: "Escopo", filters: ["Somente o evento Coral Moment (89880)", "As cortesias da Corrida Endorfina (Evento_ID 104146) ficam fora — evento separado, com meta própria"] },
          ]} />
          <p className="text-2xl font-bold font-mono">{formatNumber(computed.cortesiaTotal)}</p>
          <div className="mt-1 space-y-0.5">
            <p className="text-[11px] text-foreground font-medium flex justify-between"><span>Passaporte</span><span className="font-mono">{formatNumber(computed.cortesiaPassaporte)}</span></p>
            <p className="text-[11px] text-muted-foreground flex justify-between"><span>Brunch</span><span className="font-mono">{formatNumber(computed.cortesiaBrunch)}</span></p>
            <p className="text-[11px] text-muted-foreground flex justify-between"><span>Barco Spritz</span><span className="font-mono">{formatNumber(computed.cortesiaSpritz)}</span></p>
            <p className="text-[11px] text-muted-foreground flex justify-between"><span>Barco Escuna</span><span className="font-mono">{formatNumber(computed.cortesiaEscuna)}</span></p>
            <p className="text-[11px] text-muted-foreground flex justify-between"><span>Festas individuais</span><span className="font-mono">{formatNumber(computed.cortesiaFestas)}</span></p>
          </div>
          
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={cortesiaGenderData} margin={{ top: 20 }}>
                <XAxis dataKey="name" stroke="hsl(0 0% 45%)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Bar dataKey="value" name="Cortesias" radius={[4, 4, 0, 0]} barSize={36} label={{ position: "top", fontSize: 12, fontWeight: "bold", fill: "#333" }}>
                  <Cell fill="hsl(var(--accent))" />
                  <Cell fill="hsl(var(--primary))" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

    </div>
  );
}

export function DetalhesVendasSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<ConsolidadoData>("consolidado-cm", dateRange);
  const [detailSearch, setDetailSearch] = useState("");

  const computed = useMemo(() => {
    if (!data?.totals?.[0]) return null;
    const monthly = (data.monthly || []).map(m => ({
      mes: MONTH_NAMES[Number(m.mes)] || m.mes,
      fat2026: Number(m.faturamento), ingressos2026: Number(m.ingressos),
    }));
    const monthlyPrev = (data.monthly_prev || []).map(m => ({
      mes: MONTH_NAMES[Number(m.mes)] || m.mes,
      fat2025: Number(m.faturamento), ingressos2025: Number(m.ingressos),
    }));
    const allMonths = [...new Set([...monthly.map(m => m.mes), ...monthlyPrev.map(m => m.mes)])];
    const comparison = allMonths.map(mes => {
      const fat2026 = monthly.find(m => m.mes === mes)?.fat2026 || 0;
      const fat2025 = monthlyPrev.find(m => m.mes === mes)?.fat2025 || 0;
      const ingressos2026 = monthly.find(m => m.mes === mes)?.ingressos2026 || 0;
      const ingressos2025 = monthlyPrev.find(m => m.mes === mes)?.ingressos2025 || 0;
      const varFat = fat2025 === 0 ? null : ((fat2026 - fat2025) / fat2025) * 100;
      const varIngressos = ingressos2025 === 0 ? null : ((ingressos2026 - ingressos2025) / ingressos2025) * 100;
      return { mes, fat2026, fat2025, ingressos2026, ingressos2025, varFat, varIngressos };
    });
    return {
      comparison,
      detail: (data.detail || []).map(d => ({ data: d.data, ingresso: d.ingresso, qtd: Number(d.qtd), receita: Number(d.receita), pagamento: d.pagamento })),
    };
  }, [data]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (error || !computed) return <div className="kpi-card text-center py-8"><p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p></div>;

  const filteredDetail = (computed.detail || []).filter((d: any) => String(d.ingresso || "").toLowerCase().includes(detailSearch.toLowerCase()));
  const filteredDetailTotals = {
    qtd: filteredDetail.reduce((s: number, d: any) => s + (Number(d.qtd) || 0), 0),
    receita: filteredDetail.reduce((s: number, d: any) => s + (Number(d.receita) || 0), 0),
  };

  const formatVar = (v: number | null | undefined) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return "—";
    const sign = v > 0 ? "+" : v < 0 ? "−" : "";
    return sign + Math.round(Math.abs(v)) + "%";
  };
  const varColor = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "#9CA3AF" : v > 0 ? "#16A34A" : "#DC2626");
  const renderVarTooltip = (varKey: "varFat" | "varIngressos", isCurrency: boolean) => ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0]?.payload;
    const v = entry?.[varKey];
    return (
      <div style={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(0 0% 88%)", borderRadius: "8px", padding: "8px", fontSize: "12px" }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {isCurrency ? formatCurrency(p.value) : formatNumber(p.value)}
          </div>
        ))}
        <div style={{ color: varColor(v), marginTop: 4, fontWeight: 600 }}>Variação: {formatVar(v)}</div>
      </div>
    );
  };
  const fat26Label = ({ x, y, width, value, index }: any) => {
    const v = computed.comparison[index]?.varFat ?? null;
    return (
      <>
        <text x={x + width / 2} y={y - 16} textAnchor="middle" fontSize={8} fontWeight="bold" fill={varColor(v)}>{formatVar(v)}</text>
        <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={8} fill="hsl(0 0% 45%)">{formatCurrency(value)}</text>
      </>
    );
  };
  const ingressos26Label = ({ x, y, width, value, index }: any) => {
    const v = computed.comparison[index]?.varIngressos ?? null;
    return (
      <>
        <text x={x + width / 2} y={y - 16} textAnchor="middle" fontSize={9} fontWeight="bold" fill={varColor(v)}>{formatVar(v)}</text>
        <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={9} fill="hsl(0 0% 45%)">{formatNumber(value)}</text>
      </>
    );
  };

  return (
    <div className="space-y-4">
      {computed.comparison.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="kpi-card">
            <FilterTooltip className="mb-3" title="Visão Mensal 25 x 26 - Faturamento" blocks={[
              { filters: ["SUM(Valor_Final) por EXTRACT(MONTH FROM Data)", "FROM CM25 ∪ CM26", "Meio_de_Pagamento NOT IN ('cortesia','none','free')", "2026: período atual / 2025: período YoY −1 ano"] },
            ]} />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={computed.comparison} margin={{ top: 40 }}>
                <XAxis dataKey="mes" stroke="hsl(0 0% 45%)" fontSize={12} />
                <YAxis hide />
                <Tooltip content={renderVarTooltip("varFat", true)} />
                <Legend />
                <Bar dataKey="fat2025" name="2025" fill="#94A3B8" radius={[4, 4, 0, 0]} label={({ x, y, width, value }: any) => (
                  <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={8} fill="hsl(0 0% 45%)">{formatCurrency(value)}</text>
                )} />
                <Bar dataKey="fat2026" name="2026" fill="#0D4F4F" radius={[4, 4, 0, 0]} label={fat26Label} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="kpi-card">
            <FilterTooltip className="mb-3" title="Visão Mensal 25 x 26 - Ingressos" blocks={[
              { filters: ["SUM(Qtd) por EXTRACT(MONTH FROM Data)", "FROM CM25 ∪ CM26", "Meio_de_Pagamento NOT IN ('cortesia','none','free')", "2026: período atual / 2025: período YoY −1 ano"] },
            ]} />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={computed.comparison} margin={{ top: 40 }}>
                <XAxis dataKey="mes" stroke="hsl(0 0% 45%)" fontSize={12} />
                <YAxis hide />
                <Tooltip content={renderVarTooltip("varIngressos", false)} />
                <Legend />
                <Bar dataKey="ingressos2025" name="2025" fill="#94A3B8" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 9, fill: "hsl(0 0% 45%)" }} />
                <Bar dataKey="ingressos2026" name="2026" fill="#0D4F4F" radius={[4, 4, 0, 0]} label={ingressos26Label} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Detalhamento de Vendas</p>
          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={detailSearch}
              onChange={(e) => setDetailSearch(e.target.value)}
              placeholder="Pesquisar ingresso..."
              className="h-8 pl-7 text-xs"
            />
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Total: <strong className="text-foreground">{formatNumber(filteredDetailTotals.qtd)} ingressos</strong></span>
            <span>Receita: <strong className="text-foreground">{formatCurrency(filteredDetailTotals.receita)}</strong></span>
          </div>
        </div>
        <DataTable
          columns={[
            { key: "data", label: "Data Compra" },
            { key: "ingresso", label: "Descrição" },
            { key: "qtd", label: "Qtd", progressBar: true },
            { key: "receita", label: "Receita Bruta", format: (v: number) => formatCurrency(v), progressBar: true },
            { key: "pagamento", label: "Meio de Pagamento" },
          ]}
          data={filteredDetail}
          totals={{ qtd: { value: filteredDetailTotals.qtd, format: formatNumber }, receita: { value: filteredDetailTotals.receita, format: formatCurrency } }}
        />
      </div>
    </div>
  );
}

