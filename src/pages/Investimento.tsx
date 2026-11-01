import { useState, useMemo } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { UpdateBadge } from "@/components/dashboard/UpdateBadge";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";
import { formatCurrency } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";
import { DollarSign, Instagram, Search, Loader2, AlertTriangle } from "lucide-react";
import { DateRangeFilter, DEFAULT_DATE_RANGE } from "@/components/dashboard/DateRangeFilter";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";
import { IntegracaoParadaBanner, integracaoParada, type UltimoDadoRow } from "@/components/dashboard/IntegracaoParadaBanner";

const MONTH_NAMES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface InvestData {
  meta_cost: Array<{ total: string; mes: string }>;
  google_cost: Array<{ total: string; mes: string }>;
  meta_cost_prev: Array<{ total: string; mes: string }>;
  google_cost_prev: Array<{ total: string; mes: string }>;
  meta_total: Array<{ total: string }>;
  google_total: Array<{ total: string }>;
  meta_total_prev: Array<{ total: string }>;
  google_total_prev: Array<{ total: string }>;
  google_last_date: Array<{ last_date: string }>;
  google_ads_ultimo_dado: UltimoDadoRow[];
  meta_ultimo_dado: UltimoDadoRow[];
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function GoogleDataWarning({ lastDate }: { lastDate: Date }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 mb-3 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>Dados de Google Ads disponíveis até {formatBR(lastDate)}. Os meses posteriores consideram apenas Meta Ads.</span>
    </div>
  );
}

const META_INVESTIMENTO = 82000;

const Investimento = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);
  const { data, isLoading, error } = useDashboardData<InvestData>("investimento", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    const metaTotal = Number(data.meta_total?.[0]?.total) || 0;
    const googleTotal = Number(data.google_total?.[0]?.total) || 0;
    const totalInvest = metaTotal + googleTotal;
    const metaTotalPrev = Number(data.meta_total_prev?.[0]?.total) || 0;
    const googleTotalPrev = Number(data.google_total_prev?.[0]?.total) || 0;
    const totalInvestPrev = metaTotalPrev + googleTotalPrev;

    const metaByMonth = (data.meta_cost || []).reduce((acc, r) => ({ ...acc, [r.mes]: Number(r.total) }), {} as Record<string, number>);
    const googleByMonth = (data.google_cost || []).reduce((acc, r) => ({ ...acc, [r.mes]: Number(r.total) }), {} as Record<string, number>);
    const metaByMonthPrev = (data.meta_cost_prev || []).reduce((acc, r) => ({ ...acc, [r.mes]: Number(r.total) }), {} as Record<string, number>);
    const googleByMonthPrev = (data.google_cost_prev || []).reduce((acc, r) => ({ ...acc, [r.mes]: Number(r.total) }), {} as Record<string, number>);
    const allMonths = [...new Set([
      ...Object.keys(metaByMonth),
      ...Object.keys(googleByMonth),
      ...Object.keys(metaByMonthPrev),
      ...Object.keys(googleByMonthPrev),
    ])].sort();

    const monthlyData = allMonths.map(m => ({
      mes: MONTH_NAMES[Number(m)] || m,
      meta: metaByMonth[m] || 0,
      google: googleByMonth[m] || 0,
      metaPrev: metaByMonthPrev[m] || 0,
      googlePrev: googleByMonthPrev[m] || 0,
    }));

    const stackedData = allMonths.map(m => {
      const metaV = metaByMonth[m] || 0;
      const googleV = googleByMonth[m] || 0;
      const total = metaV + googleV || 1;
      const metaVP = metaByMonthPrev[m] || 0;
      const googleVP = googleByMonthPrev[m] || 0;
      const totalP = metaVP + googleVP || 1;
      return {
        mes: MONTH_NAMES[Number(m)] || m,
        meta: (metaV / total) * 100,
        google: (googleV / total) * 100,
        metaPrev: (metaVP / totalP) * 100,
        googlePrev: (googleVP / totalP) * 100,
      };
    });

    return {
      metaTotal, googleTotal, totalInvest, metaTotalPrev, googleTotalPrev, totalInvestPrev, monthlyData, stackedData,
      googleLastDate: data.google_last_date?.[0]?.last_date || null,
      googleUltimoDado: data.google_ads_ultimo_dado?.[0],
      metaUltimoDado: data.meta_ultimo_dado?.[0],
    };
  }, [data]);

  const googleWarning = useMemo(() => {
    if (!computed?.googleLastDate || !dateRange?.to) return null;
    const last = parseLocalDate(computed.googleLastDate);
    const end = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate());
    const diffDays = (end.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 3 ? last : null;
  }, [computed?.googleLastDate, dateRange?.to]);

  const variation = (curr: number, prev: number) => {
    if (!prev) return undefined;
    return ((curr / prev) - 1) * 100;
  };

  if (isLoading) return <div className="page-container flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (error || !computed) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="dashboard-header">Coral Moment 2026 - INVESTIMENTO</h1>
          <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
        <div className="kpi-card text-center py-12"><p className="text-destructive text-sm">Erro ao carregar dados: {error?.message || "Sem dados"}</p></div>
      </div>
    );
  }

  const googleParado = integracaoParada(computed.googleUltimoDado);
  const metaParado = integracaoParada(computed.metaUltimoDado);

  const totalFilters = [
    "SUM(spend) FROM facebook.ads_insights + SUM(daily_cost) FROM google_ads.vw_campaign",
    "google_ads: campaign_name LIKE '%STEP%'",
    "date_start / campaign_date BETWEEN período selecionado",
  ];
  const metaFilters = [
    "SUM(CAST(spend AS FLOAT64)) FROM coral-moment.facebook.ads_insights",
    "date_start BETWEEN período selecionado",
  ];
  const googleFilters = [
    "SUM(CAST(REPLACE(daily_cost, ',', '.') AS FLOAT64)) FROM coral-moment.google_ads.vw_campaign",
    "campaign_name LIKE '%STEP%'",
    "campaign_date BETWEEN período selecionado",
  ];

  return (
    <div className="page-container">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="dashboard-header">Coral Moment 2026 - INVESTIMENTO</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <UpdateBadge />
          <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title={<FilterTooltip title="Investimento Total" blocks={[{ year: "2026 e 2025", filters: totalFilters }]} />}
          value={formatCurrency(computed.totalInvest)}
          subtitle={`Ano anterior: ${formatCurrency(computed.totalInvestPrev)}`}
          variation={variation(computed.totalInvest, computed.totalInvestPrev)}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <KPICard
          title={<FilterTooltip title="Custo Meta Ads" blocks={[{ year: "2026 e 2025", filters: metaFilters }]} />}
          value={formatCurrency(computed.metaTotal)}
          subtitle={`Ano anterior: ${formatCurrency(computed.metaTotalPrev)}`}
          variation={metaParado ? undefined : variation(computed.metaTotal, computed.metaTotalPrev)}
          variationNote={metaParado ? "—" : undefined}
          banner={<IntegracaoParadaBanner row={computed.metaUltimoDado} />}
          icon={<Instagram className="w-4 h-4" />}
          delay={0.05}
        />
        <KPICard
          title={<FilterTooltip title="Custo Google Ads" blocks={[{ year: "2026 e 2025", filters: googleFilters }]} />}
          value={formatCurrency(computed.googleTotal)}
          subtitle={`Ano anterior: ${formatCurrency(computed.googleTotalPrev)}`}
          // Dado congelado em março comparado com o ano anterior inteiro nao significa nada.
          variation={googleParado ? undefined : variation(computed.googleTotal, computed.googleTotalPrev)}
          variationNote={googleParado ? "—" : undefined}
          banner={<IntegracaoParadaBanner row={computed.googleUltimoDado} />}
          icon={<Search className="w-4 h-4" />}
          delay={0.1}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gauge / Donut: % investido vs meta */}
        <DonutChart
          value={computed.totalInvest}
          total={META_INVESTIMENTO}
          label={`Meta Investimento - ${formatCurrency(META_INVESTIMENTO)}`}
          colors={["#0D4F4F", "#1a2e2e"]}
        />

        {/* Stacked 100% bar chart */}
        {computed.stackedData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="kpi-card">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Google Ads e Meta Ads por Mês (%) — 2025 vs 2026</h3>
            {googleWarning && <GoogleDataWarning lastDate={googleWarning} />}
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={computed.stackedData} margin={{ top: 25 }}>
                <XAxis dataKey="mes" stroke="hsl(180 8% 55%)" fontSize={12} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: "hsl(180 12% 12%)", border: "1px solid hsl(180 10% 20%)", borderRadius: "8px", color: "#fff" }} formatter={(v: number) => `${v.toFixed(0)}%`} />
                <Legend />
                <Bar dataKey="metaPrev" name="Meta Ads 2025" fill="#6b7280" stackId="prev" />
                <Bar dataKey="googlePrev" name="Google Ads 2025" fill="#9ca3af" stackId="prev" radius={[4, 4, 0, 0]} />
                <Bar dataKey="meta" name="Meta Ads 2026" fill="#0D4F4F" stackId="curr" />
                <Bar dataKey="google" name="Google Ads 2026" fill="#45a5a5" radius={[4, 4, 0, 0]} stackId="curr" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>

      {/* Monthly R$ bar chart */}
      {computed.monthlyData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="kpi-card">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Investimento por Mês (R$) — 2025 vs 2026</h3>
          {googleWarning && <GoogleDataWarning lastDate={googleWarning} />}
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={computed.monthlyData} margin={{ top: 25 }}>
              <XAxis dataKey="mes" stroke="hsl(180 8% 55%)" fontSize={12} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "hsl(180 12% 12%)", border: "1px solid hsl(180 10% 20%)", borderRadius: "8px", color: "#fff" }} formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="metaPrev" name="Meta Ads 2025" fill="#6b7280" stackId="prev" />
              <Bar dataKey="googlePrev" name="Google Ads 2025" fill="#9ca3af" stackId="prev" radius={[4, 4, 0, 0]} label={({ x, y, width, index }: any) => {
                const d = computed!.monthlyData[index];
                const total = (d?.metaPrev || 0) + (d?.googlePrev || 0);
                if (!total) return null as any;
                return <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={9} fontWeight="bold" fill="hsl(180 8% 55%)">{formatCurrency(total)}</text>;
              }} />
              <Bar dataKey="meta" name="Meta Ads 2026" fill="#0D4F4F" stackId="curr" />
              <Bar dataKey="google" name="Google Ads 2026" fill="#45a5a5" radius={[4, 4, 0, 0]} stackId="curr" label={({ x, y, width, index }: any) => {
                const d = computed!.monthlyData[index];
                const total = (d?.meta || 0) + (d?.google || 0);
                if (!total) return null as any;
                return <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={9} fontWeight="bold" fill="hsl(180 8% 75%)">{formatCurrency(total)}</text>;
              }} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
};

export default Investimento;
