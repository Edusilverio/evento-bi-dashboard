import { useState, useMemo } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { DataTable } from "@/components/dashboard/DataTable";
import { UpdateBadge } from "@/components/dashboard/UpdateBadge";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { CustoConversaCard } from "@/components/dashboard/sections/CustoConversaCard";
import { formatCurrency, formatNumber, formatPct } from "@/lib/formatters";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { motion } from "framer-motion";
import { Eye, MousePointerClick, Users, DollarSign, ShoppingCart, TrendingUp, ImageIcon, ChevronDown, Monitor } from "lucide-react";
import { DateRangeFilter, DEFAULT_DATE_RANGE } from "@/components/dashboard/DateRangeFilter";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";
import { KPISkeleton, ChartSkeleton, TableSkeleton } from "@/components/dashboard/DashboardSkeleton";

const COLORS = ["#0D4F4F", "#1a6b6b", "#2d8a8a", "#45a5a5", "#6bbfbf", "#8dd3d3"];

interface MetaData {
  totals: Array<{
    impressions: string; clicks: string; reach: string; spend: string;
    purchases: string; purchase_value: string; messages: string;
    add_to_cart: string; landing_page_views: string;
  }>;
  campaigns: Array<{
    campaign_name: string; impressions: string; clicks: string; ctr: string;
    add_to_cart: string; messages: string; purchases: string; roas: string; spend: string;
  }>;
  adsets: Array<{
    adset_name: string; campaign_name: string; impressions: string; clicks: string; ctr: string;
    add_to_cart: string; messages: string; purchases: string; roas: string; spend: string;
  }>;
  demographics: Array<{ age: string; gender: string; impressions: string; clicks: string }>;
  devices: Array<{ device: string; impressions: string; clicks: string }>;
  creatives: Array<{
    creative_name: string; creative_image_url: string;
    impressions: string; clicks: string; reach: string; spend: string; cpc: string; ctr: string;
  }>;
}

function toDonutData(arr: Array<Record<string, string>> | undefined, nameKey: string, valueKey: string) {
  if (!arr?.length) return [];
  const sum = arr.reduce((s, r) => s + Number(r[valueKey] || 0), 0);
  return arr
    .filter(r => Number(r[valueKey]) > 0)
    .map(r => ({ name: String(r[nameKey]), value: sum > 0 ? (Number(r[valueKey]) / sum) * 100 : 0 }));
}

function CreativeThumbnail({ url, name }: { url: string | null; name: string }) {
  const [err, setErr] = useState(false);
  if (!url || err) return <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-5 h-5 text-muted-foreground/40" /></div>;
  return <img src={url} alt={name} className="w-12 h-12 rounded object-cover shrink-0" width={48} height={48} onError={() => setErr(true)} loading="lazy" />;
}

/* ── Funnel Step ── */
function FunnelStep({ label, value, rate, index, total }: { label: string; value: number; rate?: number; index: number; total: number }) {
  const maxWidth = 100;
  const minWidth = 50;
  const width = total > 1 ? maxWidth - ((maxWidth - minWidth) * index) / (total - 1) : maxWidth;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="flex flex-col items-center gap-1.5 w-full"
    >
      <div
        className="rounded-lg flex items-center justify-center px-6 text-primary-foreground font-semibold text-sm"
        style={{ width: `${width}%`, minHeight: '56px', backgroundColor: COLORS[index % COLORS.length] }}
      >
        <div className="flex flex-col items-center py-3">
          <span className="text-sm font-medium opacity-80">{label}</span>
          <span className="text-xl font-bold font-mono">{formatNumber(value)}</span>
        </div>
      </div>
      {rate !== undefined && (
        <span className="text-sm font-semibold text-muted-foreground">
          ↓ {rate.toFixed(2)}%
        </span>
      )}
    </motion.div>
  );
}

const CREATIVES_PER_PAGE = 6;

const MetaAds = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);
  const { data, isLoading, error } = useDashboardData<MetaData>("meta-ads", dateRange);
  const [creativesVisible, setCreativesVisible] = useState(CREATIVES_PER_PAGE);

  const computed = useMemo(() => {
    if (!data?.totals?.[0]) return null;
    const t = data.totals[0];

    const impressions = Number(t.impressions);
    const clicks = Number(t.clicks);
    const reach = Number(t.reach);
    const spend = Number(t.spend);
    const purchases = Number(t.purchases || 0);
    const purchaseValue = Number(t.purchase_value || 0);
    const messages = Number(t.messages || 0);
    const addToCart = Number(t.add_to_cart || 0);
    const landingPageViews = Number(t.landing_page_views || 0);
    const roi = spend > 0 ? purchaseValue / spend : 0;

    const demos = data.demographics || [];
    const genderMap: Record<string, number> = {};
    const ageMap: Record<string, number> = {};
    demos.forEach(d => {
      const gLabel = d.gender === 'male' ? 'male' : d.gender === 'female' ? 'female' : 'unknown';
      genderMap[gLabel] = (genderMap[gLabel] || 0) + Number(d.clicks);
      ageMap[d.age] = (ageMap[d.age] || 0) + Number(d.clicks);
    });
    const totalClicks = Object.values(genderMap).reduce((s, v) => s + v, 0) || 1;

    const campaigns = (data.campaigns || []).map(c => ({
      campaign_name: c.campaign_name,
      impressions: Number(c.impressions),
      clicks: Number(c.clicks),
      ctr: Number(c.ctr),
      add_to_cart: Number(c.add_to_cart || 0),
      messages: Number(c.messages || 0),
      purchases: Number(c.purchases || 0),
      roas: Number(c.roas || 0),
      spend: Number(c.spend),
    }));

    const adsets = (data.adsets || []).map(a => ({
      adset_name: a.adset_name,
      campaign_name: a.campaign_name,
      impressions: Number(a.impressions),
      clicks: Number(a.clicks),
      ctr: Number(a.ctr),
      add_to_cart: Number(a.add_to_cart || 0),
      messages: Number(a.messages || 0),
      purchases: Number(a.purchases || 0),
      roas: Number(a.roas || 0),
      spend: Number(a.spend),
    }));

    const deviceData = toDonutData(data.devices as any, "device", "impressions");

    const creatives = (data.creatives || []).map(c => ({
      creative_image_url: c.creative_image_url,
      creative_name: c.creative_name,
      impressions: Number(c.impressions),
      clicks: Number(c.clicks),
      reach: Number(c.reach),
      spend: Number(c.spend),
      cpc: Number(c.cpc),
      ctr: Number(c.ctr || 0),
    }));

    // Funnel data
    const funnel = [
      { label: "Impressões", value: impressions },
      { label: "Cliques", value: clicks },
      { label: "Vis. Página Destino", value: landingPageViews },
      { label: "Add to Cart", value: addToCart },
      { label: "Compras", value: purchases },
    ];

    return {
      impressions, clicks, reach, spend, purchases, purchaseValue, messages, addToCart, landingPageViews, roi,
      campaigns, adsets, creatives, funnel,
      genderData: Object.entries(genderMap).map(([name, v]) => ({ name, value: (v / totalClicks) * 100 })),
      deviceData,
      ageData: Object.entries(ageMap).map(([name, v]) => ({ name, value: (v / totalClicks) * 100 })).sort((a, b) => b.value - a.value),
    };
  }, [data]);

  const DonutSection = ({ data: pieData, title }: { data: any[]; title: string }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="kpi-card flex flex-col items-center">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{title}</span>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none" label={({ name, percent }: any) => percent < 0.02 ? null : `${name} ${(percent * 100).toFixed(2)}%`} labelLine={false} fontSize={10}>
            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(210 14% 89%)", borderRadius: "8px", color: "hsl(240 20% 12%)" }} formatter={(v: number) => `${v.toFixed(2)}%`} />
          <Legend fontSize={11} />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );

  return (
    <div className="page-container">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="dashboard-header">Coral Moment 2026 - META ADS</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <UpdateBadge />
          <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
      </div>

      {isLoading ? (
        <KPISkeleton count={6} />
      ) : error || !computed ? (
        <div className="kpi-card text-center py-12"><p className="text-destructive text-sm">Erro ao carregar dados: {error?.message || "Sem dados"}</p></div>
      ) : (
        <>
          {/* KPIs em duas linhas de 4 cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Impressões" value={formatNumber(computed.impressions)} icon={<Eye className="w-4 h-4" />} />
            <KPICard title="Alcance" value={formatNumber(computed.reach)} icon={<Users className="w-4 h-4" />} delay={0.05} />
            <KPICard title="Clicks" value={formatNumber(computed.clicks)} icon={<MousePointerClick className="w-4 h-4" />} delay={0.1} />
            <KPICard title="Compras" value={formatNumber(computed.purchases)} icon={<ShoppingCart className="w-4 h-4" />} delay={0.15} />
            <KPICard title="Custo" value={formatCurrency(computed.spend)} icon={<DollarSign className="w-4 h-4" />} delay={0.2} />
            <KPICard title="ROI" value={`${computed.roi.toFixed(2)}x`} icon={<TrendingUp className="w-4 h-4" />} delay={0.25} />
            <KPICard title="Conversas" value={formatNumber(computed.messages)} icon={<MousePointerClick className="w-4 h-4" />} delay={0.3} />
            <KPICard title="Custo por Conversa" value={computed.messages > 0 ? formatCurrency(computed.spend / computed.messages) : "N/D"} icon={<DollarSign className="w-4 h-4" />} delay={0.35} />
          </div>

          {/* Funil de Conversão */}
          <div>
            <SectionHeader title="Funil de Conversão" />
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="kpi-card mt-3">
              <div className="flex flex-col items-center gap-2">
                {computed.funnel.map((step, i) => (
                  <FunnelStep
                    key={step.label}
                    label={step.label}
                    value={step.value}
                    rate={i > 0 && computed.funnel[i - 1].value > 0 ? (step.value / computed.funnel[i - 1].value) * 100 : undefined}
                    index={i}
                    total={computed.funnel.length}
                  />
                ))}
              </div>
            </motion.div>
          </div>

          {/* Custo por Conversa — card movido do Consolidado sem alterações */}
          <div>
            <SectionHeader title="Custo por Conversa" />
            <div className="mt-3">
              <CustoConversaCard dateRange={dateRange} />
            </div>
          </div>

          {/* Performance de Campanha */}
          {computed.campaigns.length > 0 && (
            <div>
              <SectionHeader title="Performance de Campanha" />
              <div className="mt-3">
                <DataTable
                  columns={[
                    { key: "campaign_name", label: "Campanha" },
                    { key: "impressions", label: "Impressões", format: formatNumber },
                    { key: "clicks", label: "Cliques", format: formatNumber },
                    { key: "ctr", label: "CTR", format: (v: number) => `${v.toFixed(2)}%` },
                    { key: "add_to_cart", label: "Add to Cart", format: formatNumber },
                    { key: "messages", label: "Mensagens", format: formatNumber },
                    { key: "purchases", label: "Compras", format: formatNumber },
                    { key: "roas", label: "ROAS", format: (v: number) => `${v.toFixed(2)}x` },
                    { key: "spend", label: "Custo", format: (v: number) => formatCurrency(v) },
                  ]}
                  data={computed.campaigns}
                  pageSize={10}
                />
              </div>
            </div>
          )}

          {/* Conjuntos de Anúncio */}
          {computed.adsets.length > 0 && (
            <div>
              <SectionHeader title="Conjuntos de Anúncio" />
              <div className="mt-3">
                <DataTable
                  columns={[
                    { key: "adset_name", label: "Conjunto" },
                    { key: "campaign_name", label: "Campanha" },
                    { key: "impressions", label: "Impressões", format: formatNumber },
                    { key: "clicks", label: "Cliques", format: formatNumber },
                    { key: "ctr", label: "CTR", format: (v: number) => `${v.toFixed(2)}%` },
                    { key: "add_to_cart", label: "Add to Cart", format: formatNumber },
                    { key: "messages", label: "Mensagens", format: formatNumber },
                    { key: "purchases", label: "Compras", format: formatNumber },
                    { key: "roas", label: "ROAS", format: (v: number) => `${v.toFixed(2)}x` },
                    { key: "spend", label: "Custo", format: (v: number) => formatCurrency(v) },
                  ]}
                  data={computed.adsets}
                  pageSize={10}
                />
              </div>
            </div>
          )}

          {/* Donut charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {computed.genderData.length > 0 && <DonutSection data={computed.genderData} title="Gênero" />}
            {computed.deviceData.length > 0 && <DonutSection data={computed.deviceData} title="Dispositivos" />}
            {computed.ageData.length > 0 && <DonutSection data={computed.ageData} title="Faixa Etária" />}
          </div>

          {/* Criativos */}
          {computed.creatives.length > 0 && (
            <div>
              <SectionHeader title="Criativos" />
              <div className="mt-3">
                <DataTable
                  columns={[
                    {
                      key: "creative_name",
                      label: "Criativo",
                      render: (_val: any, row: any) => (
                        <div className="flex items-center gap-3">
                          <CreativeThumbnail url={row.creative_image_url} name={row.creative_name} />
                          <span className="text-xs font-medium line-clamp-2">{row.creative_name?.replace(/\{\{product\.name\}\}\s*/g, "").replace(/-[a-f0-9]{32}$/i, "").trim() || "Sem nome"}</span>
                        </div>
                      ),
                    },
                    { key: "impressions", label: "Impressões", format: formatNumber },
                    { key: "clicks", label: "Cliques", format: formatNumber },
                    { key: "ctr", label: "CTR", format: (v: number) => `${v.toFixed(2)}%` },
                    { key: "spend", label: "Custo", format: (v: number) => formatCurrency(v) },
                    { key: "cpc", label: "CPC", format: (v: number) => formatCurrency(v) },
                    { key: "reach", label: "Alcance", format: formatNumber },
                  ]}
                  data={computed.creatives.slice(0, creativesVisible)}
                  pageSize={CREATIVES_PER_PAGE}
                />
                {creativesVisible < computed.creatives.length && (
                  <button
                    onClick={() => setCreativesVisible(v => Math.min(v + CREATIVES_PER_PAGE, computed.creatives.length))}
                    className="mt-3 w-full py-2.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    Ver mais ({computed.creatives.length - creativesVisible} restantes)
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MetaAds;
