import { useState, useMemo } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { DataTable } from "@/components/dashboard/DataTable";
import { UpdateBadge } from "@/components/dashboard/UpdateBadge";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from "recharts";
import { motion } from "framer-motion";
import { Globe, ShoppingCart, Monitor } from "lucide-react";
import { DateRangeFilter, DEFAULT_DATE_RANGE } from "@/components/dashboard/DateRangeFilter";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { KPISkeleton, ChartSkeleton, TableSkeleton } from "@/components/dashboard/DashboardSkeleton";

const COLORS = ["#0D4F4F", "#1a6b6b", "#2d8a8a", "#45a5a5", "#6bbfbf", "#8dd3d3"];

const STATE_ABBREV: Record<string, string> = {
  "State of Sao Paulo": "SP", "State of Rio de Janeiro": "RJ", "State of Minas Gerais": "MG",
  "State of Parana": "PR", "State of Santa Catarina": "SC", "State of Pernambuco": "PE",
  "State of Rio Grande do Sul": "RS", "State of Espirito Santo": "ES", "State of Bahia": "BA",
  "State of Goias": "GO", "State of Ceara": "CE", "State of Distrito Federal": "DF",
  "Federal District": "DF", "State of Amazonas": "AM", "State of Para": "PA",
  "State of Maranhao": "MA", "State of Mato Grosso": "MT", "State of Mato Grosso do Sul": "MS",
  "State of Paraiba": "PB", "State of Rio Grande do Norte": "RN", "State of Alagoas": "AL",
  "State of Sergipe": "SE", "State of Piaui": "PI", "State of Tocantins": "TO",
  "State of Rondonia": "RO", "State of Acre": "AC", "State of Amapa": "AP", "State of Roraima": "RR",
};

interface GA4Data {
  totals: Array<{ receita: string; transacoes: string; sessoes: string }>;
  sessions_by_source: Array<{ source: string; sessoes: string; receita: string; transacoes: string }>;
  devices: Array<{ device_category: string; total: string }>;
  regions: Array<{ region: string; sessoes: string; receita: string }>;
  os: Array<{ operating_system: string; total: string }>;
  campaigns: Array<{ campaign: string; revenue: string; transactions: string; sessions: string }>;
  region_perf: Array<{ region: string; sessions: string; revenue: string; transacoes: string }>;
  faq?: Array<{ faq: string; qtd: string }>;
}

function toPercent(arr: Array<Record<string, string>> | undefined, nameKey: string, valueKey: string) {
  if (!arr?.length) return [];
  const sum = arr.reduce((s, r) => s + Number(r[valueKey] || 0), 0);
  return arr
    .filter(r => Number(r[valueKey]) > 0)
    .map(r => ({ name: String(r[nameKey]), value: sum > 0 ? (Number(r[valueKey]) / sum) * 100 : 0 }));
}

const RENDERIZED_LABEL = ({ name, percent }: any) => {
  if (percent < 0.03) return null;
  return `${(percent * 100).toFixed(1)}%`;
};

const GA4 = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);
  const { data, isLoading, error } = useDashboardData<GA4Data>("ga4", dateRange);

  const computed = useMemo(() => {
    if (!data?.totals?.[0]) return null;
    const t = data.totals[0];

    // Sessions by source (Ingresse vs LP)
    const sessionsBySource = (data.sessions_by_source || []).map(s => ({
      source: s.source,
      sessoes: Number(s.sessoes),
      receita: Number(s.receita),
      transacoes: Number(s.transacoes),
    }));
    const ingresseSessions = sessionsBySource.find(s => s.source === 'Ingresse')?.sessoes || 0;
    const lpSessions = sessionsBySource.find(s => s.source === 'LP')?.sessoes || 0;

    const campaigns = (data.campaigns || []).map(c => ({
      campaign: c.campaign,
      revenue: Number(c.revenue),
      transactions: Number(c.transactions),
      sessions: Number(c.sessions),
    }));

    const campaignTotals = campaigns.reduce((acc, c) => ({
      revenue: acc.revenue + c.revenue,
      transactions: acc.transactions + c.transactions,
      sessions: acc.sessions + c.sessions,
    }), { revenue: 0, transactions: 0, sessions: 0 });

    const regionPerf = (data.region_perf || []).map(r => ({
      region: r.region,
      sessions: Number(r.sessions),
      revenue: Number(r.revenue),
      transacoes: Number(r.transacoes || 0),
    }));

    const regionTotals = regionPerf.reduce((acc, r) => ({
      sessions: acc.sessions + r.sessions,
      revenue: acc.revenue + r.revenue,
      transacoes: acc.transacoes + r.transacoes,
    }), { sessions: 0, revenue: 0, transacoes: 0 });

    const faqData = (data.faq || []).map(f => ({ faq: f.faq, qtd: Number(f.qtd) }));

    return {
      revenue: Number(t.receita),
      transactions: Number(t.transacoes),
      sessions: Number(t.sessoes),
      ingresseSessions,
      lpSessions,
      avgDuration: 0,
      deviceData: toPercent(data.devices as any, "device_category", "total"),
      regionData: (() => {
        const regions = (data.regions || [])
          .map(r => ({ name: STATE_ABBREV[r.region] || r.region, sessions: Number(r.sessoes || 0) }))
          .filter(r => r.sessions > 0)
          .sort((a, b) => b.sessions - a.sessions);
        const top = regions.slice(0, 10);
        const othersSum = regions.slice(10).reduce((s, r) => s + r.sessions, 0);
        if (othersSum > 0) top.push({ name: "Outros", sessions: othersSum });
        const total = top.reduce((s, r) => s + r.sessions, 0);
        return top.map(r => ({ ...r, pct: total > 0 ? (r.sessions / total) * 100 : 0 }));
      })(),
      osData: toPercent(data.os as any, "operating_system", "total"),
      campaigns,
      campaignTotals,
      regionPerf,
      regionTotals,
      faqData,
    };
  }, [data]);

  const DonutSection = ({ data: pieData, title, showNameInLabel }: { data: any[]; title: string; showNameInLabel?: boolean }) => {
    const label = showNameInLabel
      ? ({ name, percent }: any) => (percent < 0.03 ? null : `${name} ${(percent * 100).toFixed(1)}%`)
      : RENDERIZED_LABEL;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="kpi-card flex flex-col items-center overflow-hidden">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{title}</span>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Pie data={pieData} cx="50%" cy="45%" innerRadius={35} outerRadius={60} dataKey="value" stroke="none" label={label} labelLine={false} fontSize={9}>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(210 14% 89%)", borderRadius: "8px", color: "hsl(240 20% 12%)" }} formatter={(v: number) => `${v.toFixed(2)}%`} />
            <Legend fontSize={10} />
          </PieChart>
        </ResponsiveContainer>
      </motion.div>
    );
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="dashboard-header">Coral Moment 2026 - GA4</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <UpdateBadge />
          <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <KPISkeleton count={4} />
      ) : error || !computed ? (
        <div className="kpi-card text-center py-12"><p className="text-destructive text-sm">Erro ao carregar dados: {error?.message || "Sem dados"}</p></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard title="Receita de Compra" value={formatCurrency(computed.revenue)} icon={<ShoppingCart className="w-4 h-4" />} />
            <KPICard title="Transações" value={formatNumber(computed.transactions)} icon={<Globe className="w-4 h-4" />} delay={0.05} />
            <KPICard title="Sessões Total" value={formatNumber(computed.sessions)} icon={<Monitor className="w-4 h-4" />} delay={0.1} subtitle={`Ingresse: ${formatNumber(computed.ingresseSessions)} · LP: ${formatNumber(computed.lpSessions)}`} />
            <KPICard title="Sessões Ingresse" value={formatNumber(computed.ingresseSessions)} icon={<Monitor className="w-4 h-4" />} delay={0.15} />
            <KPICard title="Sessões LP" value={formatNumber(computed.lpSessions)} icon={<Monitor className="w-4 h-4" />} delay={0.2} />
          </div>

          {/* Donut charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {computed.deviceData.length > 0 && <DonutSection data={computed.deviceData} title="Dispositivos" showNameInLabel />}
            {computed.osData.length > 0 && <DonutSection data={computed.osData} title="Sistema Operacional" showNameInLabel />}
          </div>

          {/* Região - Bar chart horizontal */}
          {computed.regionData.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="kpi-card">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 block">Sessões por Região</span>
              <ResponsiveContainer width="100%" height={Math.max(computed.regionData.length * 36, 200)}>
                <BarChart data={computed.regionData} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 40 }}>
                  
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={40} tick={{ fontSize: 11, fill: "hsl(215 14% 45%)" }} />
                  <Tooltip contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(210 14% 89%)", borderRadius: "8px", color: "hsl(240 20% 12%)" }} formatter={(v: number) => formatNumber(v)} labelFormatter={(l) => `Estado: ${l}`} />
                  <Bar dataKey="sessions" fill="#0D4F4F" radius={[0, 4, 4, 0]} label={({ x, y, width, height, index }: any) => {
                    const item = computed!.regionData[index];
                    return (
                      <text x={(x || 0) + (width || 0) + 4} y={(y || 0) + (height || 0) / 2 + 4} fontSize={10} fill="hsl(215 14% 45%)">
                        {item ? `${item.pct.toFixed(1)}%` : ''}
                      </text>
                    );
                  }} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Estado</th>
                      <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Sessões</th>
                      <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">% do Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computed.regionData.map((r: any) => (
                      <tr key={r.name} className="border-b border-border/50">
                        <td className="py-1.5 px-2 font-medium">{r.name}</td>
                        <td className="text-right py-1.5 px-2 font-mono">{formatNumber(r.sessions)}</td>
                        <td className="text-right py-1.5 px-2 font-mono">{r.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Performance de Origem/Mídia */}
          {computed.campaigns.length > 0 && (
            <div>
              <SectionHeader title="Performance de Origem/Mídia" />
              <div className="mt-3">
                <DataTable
                  columns={[
                    { key: "campaign", label: "Campanha" },
                    { key: "revenue", label: "Receita", format: (v: number) => formatCurrency(v) },
                    { key: "transactions", label: "Transações", format: formatNumber },
                    { key: "sessions", label: "Sessões Total", format: formatNumber },
                  ]}
                  data={computed.campaigns}
                  totals={{
                    campaign: { value: 0, format: () => "Total" },
                    revenue: { value: computed.campaignTotals.revenue, format: formatCurrency },
                    transactions: { value: computed.campaignTotals.transactions, format: formatNumber },
                    sessions: { value: computed.campaignTotals.sessions, format: formatNumber },
                  }}
                />
              </div>
            </div>
          )}

          {/* Performance por Região */}
          {computed.regionPerf.length > 0 && (
            <div>
              <SectionHeader title="Performance por Região" />
              <div className="mt-3">
                <DataTable
                  columns={[
                    { key: "region", label: "Região" },
                    { key: "sessions", label: "Sessões", format: formatNumber },
                    { key: "revenue", label: "Receita", format: (v: number) => formatCurrency(v) },
                    { key: "transacoes", label: "Transações", format: formatNumber },
                  ]}
                  data={computed.regionPerf}
                  totals={{
                    region: { value: 0, format: () => "Total" },
                    sessions: { value: computed.regionTotals.sessions, format: formatNumber },
                    revenue: { value: computed.regionTotals.revenue, format: formatCurrency },
                    transacoes: { value: computed.regionTotals.transacoes, format: formatNumber },
                  }}
                />
              </div>
            </div>
          )}

          {/* FAQ */}
          {computed.faqData.length > 0 && (
            <div>
              <SectionHeader title="FAQ" />
              <div className="mt-3">
                <DataTable columns={[{ key: "faq", label: "FAQ" }, { key: "qtd", label: "Qtd", format: formatNumber }]} data={computed.faqData} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GA4;
