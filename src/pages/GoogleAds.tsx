import { useState, useMemo } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { DataTable } from "@/components/dashboard/DataTable";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { UpdateBadge } from "@/components/dashboard/UpdateBadge";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { DollarSign, Eye, MousePointerClick, Target, Loader2, ShoppingCart, TrendingUp, Banknote } from "lucide-react";
import { DateRangeFilter, DEFAULT_DATE_RANGE } from "@/components/dashboard/DateRangeFilter";
import { Checkbox } from "@/components/ui/checkbox";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";

const COLORS = ["#0D4F4F", "#1a6b6b", "#2d8a8a", "#45a5a5", "#6bbfbf", "#8dd3d3"];

interface GoogleAdsData {
  totals: Array<{ custo: string; impressions: string; clicks: string; cpc: string; conversions: string; conversion_value: string }>;
  campaigns_list: Array<{ campaign_name: string }>;
  devices: Array<{ device: string; total: string }>;
  regions: Array<{ region: string; sessoes: string; transacoes: string; taxa_conv: string; receita: string }>;
  os: Array<{ operating_system: string; total: string }>;
  timeline: Array<{ campaign_date: string; campaign_name: string; cost: string; cpc: string; impressions: string; clicks: string }>;
  keywords: Array<{ keyword: string; impressions: string; clicks: string; ctr: string; custo: string; conversions: string; cost_per_conversion: string }>;
  age: Array<{ age_range: string; clicks: string; sessions: string }>;
}

function toPercent(arr: Array<Record<string, string>> | undefined, nameKey: string, valueKey: string) {
  if (!arr?.length) return [];
  const sum = arr.reduce((s, r) => s + Number(r[valueKey] || 0), 0);
  return arr
    .filter(r => Number(r[valueKey]) > 0)
    .map(r => ({ name: String(r[nameKey]), value: sum > 0 ? (Number(r[valueKey]) / sum) * 100 : 0 }));
}

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.03) return null;
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="hsl(180 8% 75%)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10}>
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
};

const GoogleAds = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);
  const { data, isLoading, error } = useDashboardData<GoogleAdsData>("google-ads", dateRange);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());

  const computed = useMemo(() => {
    if (!data?.totals?.[0]) return null;
    const t = data.totals[0];
    const campaigns = (data.campaigns_list || []).map(c => c.campaign_name);
    const cost = Number(t.custo);
    const conversions = Number(t.conversions || 0);
    const conversionValue = Number(t.conversion_value || 0);
    const roi = cost > 0 ? conversionValue / cost : 0;

    const timeline = (data.timeline || []).map(r => ({
      campaign_date: r.campaign_date,
      campaign_name: r.campaign_name,
      cost: Number(r.cost),
      cpc: Number(r.cpc),
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
    }));

    const keywords = (data.keywords || []).map(k => ({
      keyword: k.keyword,
      impressions: Number(k.impressions),
      clicks: Number(k.clicks),
      ctr: Number(k.ctr),
      custo: Number(k.custo),
      conversions: Number(k.conversions || 0),
      cost_per_conversion: Number(k.cost_per_conversion || 0),
    }));

    const regions = (data.regions || []).map(r => ({
      region: r.region || "Desconhecido",
      sessoes: Number(r.sessoes),
      transacoes: Number(r.transacoes),
      taxa_conv: Number(r.taxa_conv),
      receita: Number(r.receita),
    }));

    const ageData = (data.age || []).map(a => ({
      name: a.age_range || "N/A",
      clicks: Number(a.clicks || 0),
    })).filter(a => a.clicks > 0);

    return {
      cost,
      impressions: Number(t.impressions),
      clicks: Number(t.clicks),
      cpc: Number(t.cpc),
      conversions,
      conversionValue,
      roi,
      campaigns,
      timeline,
      keywords,
      regions,
      ageData,
      deviceData: toPercent(data.devices as any, "device", "total"),
      osData: toPercent(data.os as any, "operating_system", "total"),
    };
  }, [data]);

  useMemo(() => {
    if (computed?.campaigns && selectedCampaigns.size === 0) {
      setSelectedCampaigns(new Set(computed.campaigns));
    }
  }, [computed?.campaigns]);

  const filtered = useMemo(() => {
    if (!computed) return [];
    if (selectedCampaigns.size === 0) return computed.timeline;
    return computed.timeline.filter(r => selectedCampaigns.has(r.campaign_name));
  }, [computed, selectedCampaigns]);

  const chartData = useMemo(() => {
    const dateMap: Record<string, { campaign_date: string; cost: number; clicks: number }> = {};
    filtered.forEach(r => {
      if (!dateMap[r.campaign_date]) {
        dateMap[r.campaign_date] = { campaign_date: r.campaign_date, cost: 0, clicks: 0 };
      }
      dateMap[r.campaign_date].cost += r.cost;
      dateMap[r.campaign_date].clicks += r.clicks;
    });
    return Object.values(dateMap)
      .map(d => ({ ...d, cpc: d.clicks > 0 ? d.cost / d.clicks : 0 }))
      .sort((a, b) => a.campaign_date.localeCompare(b.campaign_date));
  }, [filtered]);

  const toggleCampaign = (name: string) => {
    setSelectedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const DonutSection = ({ data: pieData, title }: { data: any[]; title: string }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="kpi-card flex flex-col items-center overflow-hidden">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{title}</span>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={pieData} cx="50%" cy="42%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none" label={renderCustomizedLabel} labelLine={false} fontSize={10}>
            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "hsl(180 12% 12%)", border: "1px solid hsl(180 10% 20%)", borderRadius: "8px", color: "#fff" }} formatter={(v: number) => `${v.toFixed(2)}%`} />
          <Legend fontSize={11} wrapperStyle={{ position: 'relative', marginTop: '8px' }} />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );

  if (isLoading) return <div className="page-container flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (error || !computed) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="dashboard-header">Coral Moment 2025 - GOOGLE ADS</h1>
          <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
        <div className="kpi-card text-center py-12"><p className="text-destructive text-sm">Erro ao carregar dados: {error?.message || "Sem dados"}</p></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="dashboard-header">Coral Moment 2025 - GOOGLE ADS</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <UpdateBadge />
          <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
      </div>

      {/* Campaign filter */}
      {computed.campaigns.length > 0 && (
        <div className="kpi-card">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-3">Filtrar Campanhas</span>
          <div className="flex flex-wrap gap-4">
            {computed.campaigns.map(c => (
              <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={selectedCampaigns.has(c)} onCheckedChange={() => toggleCampaign(c)} />
                <span className="text-foreground">{c}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KPICard title="Custo de Mídia" value={formatCurrency(computed.cost)} icon={<DollarSign className="w-4 h-4" />} />
        <KPICard title="Impressões" value={formatNumber(computed.impressions)} icon={<Eye className="w-4 h-4" />} delay={0.05} />
        <KPICard title="Cliques" value={formatNumber(computed.clicks)} icon={<MousePointerClick className="w-4 h-4" />} delay={0.1} />
        <KPICard title="CPC" value={formatCurrency(computed.cpc)} icon={<Target className="w-4 h-4" />} delay={0.15} />
        <KPICard title="Conversões" value={computed.conversions > 0 ? formatNumber(computed.conversions) : "N/D"} icon={<ShoppingCart className="w-4 h-4" />} delay={0.2} />
        <KPICard title="Valor Convertido" value={computed.conversionValue > 0 ? formatCurrency(computed.conversionValue) : "N/D"} icon={<Banknote className="w-4 h-4" />} delay={0.25} />
        <KPICard title="ROI" value={computed.roi > 0 ? `${computed.roi.toFixed(2)}x` : "N/D"} icon={<TrendingUp className="w-4 h-4" />} delay={0.3} />
      </div>

      {/* Palavras-chave */}
      {computed.keywords.length > 0 && (
        <div>
          <SectionHeader title="Palavras-chave" />
          <div className="mt-3">
            <DataTable
              columns={[
                { key: "keyword", label: "Palavra-chave" },
                { key: "impressions", label: "Impressões", format: formatNumber },
                { key: "clicks", label: "Cliques", format: formatNumber },
                { key: "ctr", label: "CTR", format: (v: number) => `${v.toFixed(2)}%` },
                { key: "custo", label: "Custo", format: (v: number) => formatCurrency(v) },
                { key: "conversions", label: "Conversões", format: formatNumber },
                { key: "cost_per_conversion", label: "Custo/Conversão", format: (v: number) => formatCurrency(v) },
              ]}
              data={computed.keywords}
              pageSize={10}
            />
          </div>
        </div>
      )}

      {/* Região - Tabela */}
      {computed.regions.length > 0 && (
        <div>
          <SectionHeader title="Performance por Região" />
          <div className="mt-3">
           <DataTable
              columns={[
                { key: "region", label: "Região" },
                { key: "sessoes", label: "Sessões", format: formatNumber },
                { key: "transacoes", label: "Transações", format: formatNumber },
                { key: "taxa_conv", label: "Taxa Conv.", format: (v: number) => `${v.toFixed(2)}%` },
                { key: "receita", label: "Receita", format: (v: number) => formatCurrency(v) },
              ]}
              data={computed.regions}
              pageSize={10}
            />
          </div>
        </div>
      )}

      {/* Donut charts + Idade */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {computed.deviceData.length > 0 && <DonutSection data={computed.deviceData} title="Dispositivos" />}
        {computed.osData.length > 0 && <DonutSection data={computed.osData} title="Sistema Operacional" />}

        {/* Idade por Cliques - Bar chart */}
        {computed.ageData.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="kpi-card flex flex-col items-center overflow-hidden">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Idade por Cliques</span>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={computed.ageData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(180 8% 55%)" fontSize={10} />
                <YAxis stroke="hsl(180 8% 55%)" fontSize={10} />
                <Tooltip
                  contentStyle={{ background: "hsl(180 12% 12%)", border: "1px solid hsl(180 10% 20%)", borderRadius: "8px", color: "#fff" }}
                  formatter={(v: number) => [formatNumber(v), "Cliques"]}
                />
                <Bar dataKey="clicks" fill="#0D4F4F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>

      {/* Line chart */}
      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Custo e CPC por Data</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <XAxis dataKey="campaign_date" stroke="hsl(180 8% 55%)" fontSize={11} />
              <YAxis yAxisId="left" stroke="hsl(180 8% 55%)" fontSize={11} tickFormatter={(v) => `R$${v}`} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(180 8% 55%)" fontSize={11} tickFormatter={(v) => `R$${v.toFixed(2)}`} />
              <Tooltip contentStyle={{ background: "hsl(180 12% 12%)", border: "1px solid hsl(180 10% 20%)", borderRadius: "8px", color: "#fff" }} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="cost" name="Custo Total" stroke="#0D4F4F" strokeWidth={2} dot={{ fill: "#0D4F4F" }} />
              <Line yAxisId="right" type="monotone" dataKey="cpc" name="CPC" stroke="#45a5a5" strokeWidth={2} dot={{ fill: "#45a5a5" }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
};

export default GoogleAds;
