import { useState, useMemo } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { DataTable } from "@/components/dashboard/DataTable";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { DollarSign, Ticket, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { DateRangeFilter, DEFAULT_DATE_RANGE } from "@/components/dashboard/DateRangeFilter";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";

interface PRData {
  totals: Array<{ faturamento: string; total_ingressos: string; fat_cc: string; fat_pix: string }>;
  totals_prev: Array<{ faturamento: string; total_ingressos: string }>;
  detail: Array<{ data: string; ingresso: string; qtd: string; receita: string; pagamento: string }>;
}

const META_PR = 90000;

const ConsolidadoPR = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);
  const { data, isLoading, error } = useDashboardData<PRData>("consolidado-pr", dateRange);

  const computed = useMemo(() => {
    if (!data?.totals?.[0]) return null;
    const t = data.totals[0];
    const prev = data.totals_prev?.[0];
    const fat = Number(t.faturamento) || 0;
    const fatPrev = Number(prev?.faturamento) || 0;
    const qtd = Number(t.total_ingressos) || 0;
    const qtdPrev = Number(prev?.total_ingressos) || 0;

    return {
      fat, fatPrev, qtd, qtdPrev,
      fatCC: Number(t.fat_cc) || 0,
      fatPix: Number(t.fat_pix) || 0,
      variacaoFat: fatPrev ? ((fat - fatPrev) / fatPrev) * 100 : 0,
      variacaoQtd: qtdPrev ? ((qtd - qtdPrev) / qtdPrev) * 100 : 0,
      detail: (data.detail || []).map(d => ({
        data: d.data, ingresso: d.ingresso, qtd: Number(d.qtd), receita: Number(d.receita), pagamento: d.pagamento,
      })),
    };
  }, [data]);

  if (isLoading) return <div className="page-container flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (error || !computed) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="dashboard-header">PÓS RÉVEILLON 2026 - CONSOLIDADO</h1>
          <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
        <div className="kpi-card text-center py-12"><p className="text-destructive text-sm">Erro ao carregar dados: {error?.message || "Sem dados"}</p></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="dashboard-header">PÓS RÉVEILLON 2026 - CONSOLIDADO</h1>
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Faturamento CC/Pix" value={formatCurrency(computed.fat)} variation={computed.variacaoFat} subtitle={`Ano anterior: ${formatCurrency(computed.fatPrev)}`} icon={<DollarSign className="w-4 h-4" />} />
        <KPICard title="Fat. CC" value={formatCurrency(computed.fatCC)} subtitle="Cartão de Crédito" delay={0.05} />
        <KPICard title="Fat. Pix" value={formatCurrency(computed.fatPix)} subtitle="Pix" delay={0.1} />
        <KPICard title="Total Ingressos CC/Pix" value={formatNumber(computed.qtd)} variation={computed.variacaoQtd} icon={<Ticket className="w-4 h-4" />} delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DonutChart value={computed.fat} total={META_PR} label="Venda x Meta" colors={["#0D4F4F", "#1a2e2e"]} />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="kpi-card lg:col-span-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Faturamento Bruto</h3>
          <div className="grid grid-cols-2 gap-6">
            <div><p className="text-sm text-muted-foreground">Cartão de Crédito</p><p className="text-xl font-bold font-mono">{formatCurrency(computed.fatCC)}</p></div>
            <div><p className="text-sm text-muted-foreground">Pix</p><p className="text-xl font-bold font-mono">{formatCurrency(computed.fatPix)}</p></div>
            <div><p className="text-sm text-muted-foreground">Total</p><p className="text-xl font-bold font-mono text-primary">{formatCurrency(computed.fat)}</p></div>
            <div><p className="text-sm text-muted-foreground">Meta</p><p className="text-xl font-bold font-mono">{formatCurrency(META_PR)}</p></div>
          </div>
        </motion.div>
      </div>

      <DataTable
        columns={[
          { key: "data", label: "Data Compra" },
          { key: "ingresso", label: "Ingresso" },
          { key: "qtd", label: "Qtd" },
          { key: "receita", label: "Receita Bruta", format: (v: number) => formatCurrency(v) },
          { key: "pagamento", label: "Pagamento" },
        ]}
        data={computed.detail}
      />
    </div>
  );
};

export default ConsolidadoPR;
