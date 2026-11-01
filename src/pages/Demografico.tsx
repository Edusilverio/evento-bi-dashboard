import { useState, useMemo } from "react";
import { formatNumber } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { DateRangeFilter, DEFAULT_DATE_RANGE } from "@/components/dashboard/DateRangeFilter";
import { UpdateBadge } from "@/components/dashboard/UpdateBadge";
import type { DateRange } from "react-day-picker";
import { useDashboardData } from "@/hooks/useDashboardData";

interface DemograficoData {
  age_bars: Array<{ faixa: string; qtd: string }>;
  age_pie: Array<{ faixa: string; qtd: string }>;
  total_cc_pix: Array<{ qtd: string }>;
  payment_bars: Array<{ meio: string; qtd: string }>;
  region: Array<{ estado: string; qtd: string }>;
}

const TEAL_PALETTE = [
  "hsl(180, 73%, 18%)",
  "hsl(180, 60%, 28%)",
  "hsl(180, 50%, 38%)",
  "hsl(180, 40%, 48%)",
  "hsl(180, 30%, 58%)",
  "hsl(180, 25%, 65%)",
  "hsl(180, 20%, 72%)",
];

const PAYMENT_LABELS: Record<string, string> = {
  credit_card: "Cartão de Crédito",
  pix: "Pix",
  wallet: "Wallet",
  debit_card: "Débito",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium">{label}</p>
      <p className="font-mono font-bold">{formatNumber(payload[0].value)}</p>
    </div>
  );
};

const Demografico = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);
  const { data, isLoading, error } = useDashboardData<DemograficoData>("demografico", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;

    const ageBars = (data.age_bars || []).map((r) => ({
      name: r.faixa,
      value: Number(r.qtd) || 0,
    }));

    const totalCcPix = Number(data.total_cc_pix?.[0]?.qtd) || 0;

    const paymentBars = (data.payment_bars || []).map((r) => ({
      name: PAYMENT_LABELS[r.meio] || r.meio,
      value: Number(r.qtd) || 0,
    }));

    const regionBars = (data.region || []).map((r) => ({
      name: r.estado || "N/A",
      value: Number(r.qtd) || 0,
    }));

    const agePieData = (data.age_pie || []).map((r) => ({
      name: r.faixa,
      value: Number(r.qtd) || 0,
    }));
    const ageTotal = agePieData.reduce((s, r) => s + r.value, 0) || 1;
    const agePie = agePieData.map((r) => ({ ...r, pct: ((r.value / ageTotal) * 100).toFixed(1) }));

    const payTotal = paymentBars.reduce((s, r) => s + r.value, 0) || 1;
    const payPie = paymentBars.map((r) => ({ ...r, pct: ((r.value / payTotal) * 100).toFixed(1) }));

    return { ageBars, agePie, totalCcPix, paymentBars, payPie, regionBars };
  }, [data]);

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !computed) {
    return (
      <div className="page-container">
        <div className="rounded-xl p-5 bg-primary">
          <h1 className="text-xl font-bold text-primary-foreground tracking-wide">Demográfico</h1>
        </div>
        <div className="kpi-card text-center py-12 mt-4">
          <p className="text-destructive text-sm">Erro ao carregar dados: {error?.message || "Sem dados"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-4">
      {/* Header */}
      <div className="rounded-xl p-5 bg-primary">
        <h1 className="text-xl font-bold text-primary-foreground tracking-wide">Demográfico</h1>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <UpdateBadge />
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      {/* Row 1: Faixa Etária bars + pie + KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Bar chart - Faixa Etária */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Faixa Etária - CC/Pix/Cortesia</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={computed.ageBars} margin={{ top: 20, right: 10 }}>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={36}
                label={{ position: "top", fontSize: 11, fontWeight: "bold", fill: "hsl(var(--foreground))" }}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pie - Faixa Etária */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card flex flex-col items-center">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Faixa Etária — Todos os Ingressos</p>
          <div className="relative w-44 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={computed.agePie} cx="50%" cy="50%" innerRadius={40} outerRadius={70} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                  {computed.agePie.map((_, i) => (
                    <Cell key={i} fill={TEAL_PALETTE[i % TEAL_PALETTE.length]} />
                  ))}
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

        {/* KPI - Total CC/Pix */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card flex flex-col items-center justify-center">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Ingressos Únicos - CC/Pix</p>
          <p className="text-4xl font-bold font-mono">{formatNumber(computed.totalCcPix)}</p>
        </motion.div>
      </div>

      {/* Row 2: Meios de Pagamento (bar + pie) */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="kpi-card">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Meios de Pagamentos - CC/Pix</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bars */}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={computed.paymentBars} margin={{ top: 20, right: 10 }}>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={50}
                label={{ position: "top", fontSize: 11, fontWeight: "bold", fill: "hsl(var(--foreground))" }}
              >
                {computed.paymentBars.map((_, i) => (
                  <Cell key={i} fill={TEAL_PALETTE[i % TEAL_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Pie */}
          <div className="flex flex-col items-center">
            <div className="relative w-44 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={computed.payPie} cx="50%" cy="50%" innerRadius={40} outerRadius={70} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                    {computed.payPie.map((_, i) => (
                      <Cell key={i} fill={TEAL_PALETTE[i % TEAL_PALETTE.length]} />
                    ))}
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

      {/* Row 3: Região */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="kpi-card">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Região - CC/Pix/Cortesia</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={computed.regionBars} margin={{ top: 20, right: 10 }}>
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={32}
              label={{ position: "top", fontSize: 10, fontWeight: "bold", fill: "hsl(var(--foreground))" }}
            >
              {computed.regionBars.map((_, i) => (
                <Cell key={i} fill={TEAL_PALETTE[i % TEAL_PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
};

export default Demografico;
