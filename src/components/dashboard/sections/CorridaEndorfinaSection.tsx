import { useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { useDashboardData } from "@/hooks/useDashboardData";

const META_CORRIDA = 60;

interface CorridaData {
  asfalto_paid: Array<{ qtd: string; faturamento: string }>;
  asfalto_total: Array<{ qtd: string }>;
  trilha_paid: Array<{ qtd: string; faturamento: string }>;
  trilha_total: Array<{ qtd: string }>;
  asfalto_cortesia_valor: Array<{ qtd: string; valor: string }>;
  trilha_cortesia_valor: Array<{ qtd: string; valor: string }>;
}

interface RaceCardProps {
  label: string;
  dataInfo: string;
  keyword: string;
  paidQtd: number;
  faturamento: number;
  totalQtd: number;
  cortesiaQtd: number;
  cortesiaValor: number;
  meta: number;
  delay?: number;
}

function RaceCard({ label, dataInfo, keyword, paidQtd, faturamento, totalQtd, cortesiaQtd, cortesiaValor, meta, delay = 0 }: RaceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="kpi-card flex flex-col items-center"
    >
      <FilterTooltip
        className="mb-1"
        title={`${label} — Ocupação vs Meta`}
        blocks={[
          {
            year: "2026",
            filters: [
              "FROM CM26",
              "Evento_ID = 104146",
              `LOWER(Ingresso) LIKE '%${keyword}%'`,
              "Data BETWEEN startDate AND endDate",
              "Ocupação (pagos + cortesias): SEM filtro de Meio_de_Pagamento",
              `Faturamento líquido: Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
              `Meta: ${meta} vagas — é meta de LOTAÇÃO, não de venda`,
              "Por ser lotação, o ponteiro inclui cortesias. Nas festas o ponteiro é de venda (só pagos) — são duas regras diferentes, de propósito.",
              "Valor em cortesias = SUM(Valor_Final) das linhas 'free' (valor de face). Não entra em nenhum faturamento.",
            ],
          },
        ]}
      />
      <p className="text-[10px] text-muted-foreground">{dataInfo}</p>
      <p className="text-4xl font-bold font-mono mt-1">{formatNumber(paidQtd)}</p>
      <p className="text-xs text-muted-foreground">Total (com cortesias): {formatNumber(totalQtd)}</p>
      <p className="text-sm font-semibold font-mono text-primary mt-1">{formatCurrency(faturamento)}</p>
      <p className="text-[10px] text-muted-foreground">Faturamento líquido</p>
      <p className="text-xs text-muted-foreground mt-1">Valor em cortesias: {formatCurrency(cortesiaValor)}</p>
      <p className="text-[10px] text-muted-foreground">{formatNumber(cortesiaQtd)} cortesias (valor de face, não é receita)</p>
      <div className="mt-4 flex justify-center max-w-[130px] max-h-[130px] mx-auto">
        <DonutChart value={totalQtd} total={meta} label="" colors={["#0D4F4F", "#E5E7EB"]} compact />
      </div>
      <p className="text-xs text-muted-foreground mt-2">Meta: {meta} vagas (lotação — inclui cortesias)</p>
    </motion.div>
  );
}

export function CorridaEndorfinaSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<CorridaData>("corrida-endorfina", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    return {
      asfaltoPaid: Number(data.asfalto_paid?.[0]?.qtd) || 0,
      asfaltoFat: Number(data.asfalto_paid?.[0]?.faturamento) || 0,
      asfaltoTotal: Number(data.asfalto_total?.[0]?.qtd) || 0,
      trilhaPaid: Number(data.trilha_paid?.[0]?.qtd) || 0,
      trilhaFat: Number(data.trilha_paid?.[0]?.faturamento) || 0,
      trilhaTotal: Number(data.trilha_total?.[0]?.qtd) || 0,
      asfaltoCortQtd: Number(data.asfalto_cortesia_valor?.[0]?.qtd) || 0,
      asfaltoCortVal: Number(data.asfalto_cortesia_valor?.[0]?.valor) || 0,
      trilhaCortQtd: Number(data.trilha_cortesia_valor?.[0]?.qtd) || 0,
      trilhaCortVal: Number(data.trilha_cortesia_valor?.[0]?.valor) || 0,
    };
  }, [data]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  if (error || !computed)
    return (
      <div className="kpi-card text-center py-8">
        <p className="text-destructive text-sm">Erro: {error?.message || "Sem dados"}</p>
      </div>
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
      <RaceCard
        label="Asfalto"
        dataInfo="04/09 às 07h"
        keyword="asfalto"
        paidQtd={computed.asfaltoPaid}
        faturamento={computed.asfaltoFat}
        totalQtd={computed.asfaltoTotal}
        cortesiaQtd={computed.asfaltoCortQtd}
        cortesiaValor={computed.asfaltoCortVal}
        meta={META_CORRIDA}
      />
      <RaceCard
        label="Trilha"
        dataInfo="05/09 às 09h"
        keyword="trilha"
        paidQtd={computed.trilhaPaid}
        faturamento={computed.trilhaFat}
        totalQtd={computed.trilhaTotal}
        cortesiaQtd={computed.trilhaCortQtd}
        cortesiaValor={computed.trilhaCortVal}
        meta={META_CORRIDA}
        delay={0.05}
      />
    </div>
  );
}
