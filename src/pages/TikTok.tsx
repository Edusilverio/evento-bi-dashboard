import { useState, useMemo } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { DataTable } from "@/components/dashboard/DataTable";
import { UpdateBadge } from "@/components/dashboard/UpdateBadge";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { Eye, MousePointerClick, DollarSign, TrendingUp, ImageIcon, Target, Activity, Percent } from "lucide-react";
import { DateRangeFilter, DEFAULT_DATE_RANGE } from "@/components/dashboard/DateRangeFilter";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";
import { KPISkeleton } from "@/components/dashboard/DashboardSkeleton";
import { FonteNaoIntegradaBanner } from "@/components/dashboard/IntegracaoParadaBanner";

interface TikTokData {
  totals: Array<{
    gasto: string; impressoes: string; cliques: string; conversoes: string;
    resultados: string; ctr: string; cpc: string; cpm: string;
  }>;
  creatives: Array<{
    criativo_id: string; descricao: string | null; url_publica: string | null;
    gasto: string; impressoes: string; cliques: string; resultados: string;
    ctr: string; cpc: string;
  }>;
  
}

function CreativeThumbnail({ url, name }: { url: string | null; name: string }) {
  const [err, setErr] = useState(false);
  if (!url || err) return <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-5 h-5 text-muted-foreground/40" /></div>;
  return <img src={url} alt={name} className="w-12 h-12 rounded object-cover shrink-0" width={48} height={48} onError={() => setErr(true)} loading="lazy" />;
}

const TikTok = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);
  const { data, isLoading, error } = useDashboardData<TikTokData>("tiktok", dateRange);

  const computed = useMemo(() => {
    if (!data?.totals?.[0]) return null;
    const t = data.totals[0];
    const creatives = (data.creatives || []).map(c => ({
      criativo_id: c.criativo_id,
      descricao: c.descricao || c.criativo_id,
      url_publica: c.url_publica,
      gasto: Number(c.gasto || 0),
      impressoes: Number(c.impressoes || 0),
      cliques: Number(c.cliques || 0),
      resultados: Number(c.resultados || 0),
      ctr: Number(c.ctr || 0),
      cpc: Number(c.cpc || 0),
    }));
    return {
      gasto: Number(t.gasto || 0),
      impressoes: Number(t.impressoes || 0),
      cliques: Number(t.cliques || 0),
      conversoes: Number(t.conversoes || 0),
      resultados: Number(t.resultados || 0),
      ctr: Number(t.ctr || 0),
      cpc: Number(t.cpc || 0),
      cpm: Number(t.cpm || 0),
      creatives,
    };
  }, [data]);

  return (
    <div className="page-container">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="dashboard-header">Coral Moment 2026 - TIKTOK</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <UpdateBadge />
          <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
      </div>

      {isLoading ? (
        <KPISkeleton count={8} />
      ) : error || !computed ? (
        <div className="kpi-card text-center py-12"><p className="text-destructive text-sm">Erro ao carregar dados: {error?.message || "Sem dados"}</p></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Investimento" value={formatCurrency(computed.gasto)} banner={<FonteNaoIntegradaBanner texto="Fonte não integrada — TikTok ainda vem de planilha do Drive e não entra no Investimento Total" />} icon={<DollarSign className="w-4 h-4" />} />
            <KPICard title="Impressões" value={formatNumber(computed.impressoes)} icon={<Eye className="w-4 h-4" />} delay={0.05} />
            <KPICard title="Cliques" value={formatNumber(computed.cliques)} icon={<MousePointerClick className="w-4 h-4" />} delay={0.1} />
            <KPICard title="CTR" value={`${computed.ctr.toFixed(2)}%`} icon={<Percent className="w-4 h-4" />} delay={0.15} />
            <KPICard title="CPC" value={formatCurrency(computed.cpc)} icon={<DollarSign className="w-4 h-4" />} delay={0.2} />
            <KPICard title="CPM" value={formatCurrency(computed.cpm)} icon={<TrendingUp className="w-4 h-4" />} delay={0.25} />
            <KPICard title="Resultados" value={formatNumber(computed.resultados)} icon={<Activity className="w-4 h-4" />} delay={0.3} />
            <KPICard title="Conversões" value={formatNumber(computed.conversoes)} icon={<Target className="w-4 h-4" />} delay={0.35} />
          </div>

          {computed.creatives.length > 0 && (
            <div>
              <SectionHeader title="Criativos" />
              <div className="mt-3">
                <DataTable
                  columns={[
                    {
                      key: "criativo_id",
                      label: "Criativo",
                      render: (_val: any, row: any) => (
                        <div className="flex items-center gap-3">
                          <CreativeThumbnail url={row.url_publica} name={row.criativo_id} />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold">{row.criativo_id}</span>
                            <span className="text-xs text-muted-foreground line-clamp-2">{row.descricao}</span>
                          </div>
                        </div>
                      ),
                    },
                    { key: "impressoes", label: "Impressões", format: formatNumber },
                    { key: "cliques", label: "Cliques", format: formatNumber },
                    { key: "ctr", label: "CTR", format: (v: number) => `${v.toFixed(2)}%` },
                    { key: "gasto", label: "Investimento", format: (v: number) => formatCurrency(v) },
                    { key: "cpc", label: "CPC", format: (v: number) => formatCurrency(v) },
                    { key: "resultados", label: "Resultados", format: formatNumber },
                  ]}
                  data={computed.creatives}
                  pageSize={10}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TikTok;
