import { useMemo } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { formatCurrency } from "@/lib/formatters";
import { motion } from "framer-motion";
import { FileCheck, CreditCard, Smartphone, Tag, Percent, Gift, Loader2 } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { DEFAULT_DATE_RANGE } from "@/components/dashboard/DateRangeFilter";

interface AuditoriaData {
  site_values: Array<{ pix: string; cc: string }>;
  api_values: Array<{ pix_api: string; cc_api: string }>;
  deductions: Array<{ cupom: string; cortesia: string }>;
}

const Auditoria = () => {
  const { data, isLoading, error } = useDashboardData<AuditoriaData>("auditoria", DEFAULT_DATE_RANGE);

  const computed = useMemo(() => {
    if (!data?.site_values?.[0]) return null;
    const site = data.site_values[0];
    const pix = Number(site.pix) || 0;
    const cc = Number(site.cc) || 0;
    const bruto = pix + cc;

    // API values may come as multiple rows from UNION ALL
    let apiPix = 0, apiCc = 0;
    (data.api_values || []).forEach(r => {
      apiPix += Number(r.pix_api) || 0;
      apiCc += Number(r.cc_api) || 0;
    });

    const ded = data.deductions?.[0];
    const cupom = Number(ded?.cupom) || 0;
    const cortesia = Number(ded?.cortesia) || 0;
    const tx = bruto * 0.019;

    return {
      pix, cc, apiPix, apiCc, cupom, cortesia, tx,
      brutoMenosCupomTx: bruto - cupom - tx,
      brutoMenosCupom: bruto - cupom,
    };
  }, [data]);

  if (isLoading) return <div className="page-container flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (error || !computed) {
    return (
      <div className="page-container">
        <h1 className="dashboard-header">AUDITORIA CM 25</h1>
        <div className="kpi-card text-center py-12"><p className="text-destructive text-sm">Erro ao carregar dados: {error?.message || "Sem dados"}</p></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="dashboard-header">AUDITORIA CM 25</h1>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valores Site Ingresse</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KPICard title="PIX (Site)" value={formatCurrency(computed.pix)} icon={<Smartphone className="w-4 h-4" />} />
          <KPICard title="CC (Site)" value={formatCurrency(computed.cc)} icon={<CreditCard className="w-4 h-4" />} delay={0.05} />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valores API</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KPICard title="PIX (API)" value={formatCurrency(computed.apiPix)} icon={<Smartphone className="w-4 h-4" />} />
          <KPICard title="CC (API)" value={formatCurrency(computed.apiCc)} icon={<CreditCard className="w-4 h-4" />} delay={0.05} />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deduções</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard title="Cupom" value={formatCurrency(computed.cupom)} icon={<Tag className="w-4 h-4" />} />
          <KPICard title="TX 1,9%" value={formatCurrency(computed.tx)} icon={<Percent className="w-4 h-4" />} delay={0.05} />
          <KPICard title="Valor Cortesia" value={formatCurrency(computed.cortesia)} subtitle="Eliminado" icon={<Gift className="w-4 h-4" />} delay={0.1} />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resultado</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KPICard title="Bruto - Cupom - TX" value={formatCurrency(computed.brutoMenosCupomTx)} icon={<FileCheck className="w-4 h-4" />} />
          <KPICard title="Bruto - Cupom" value={formatCurrency(computed.brutoMenosCupom)} icon={<FileCheck className="w-4 h-4" />} delay={0.05} />
        </div>
      </motion.div>
    </div>
  );
};

export default Auditoria;
