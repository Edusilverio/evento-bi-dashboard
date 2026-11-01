import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";
import { formatCurrency } from "@/lib/formatters";
import { useDashboardData } from "@/hooks/useDashboardData";

interface ConversasRow { conversas: string; spend: string }

// Divisao protegida: sem conversa no periodo o custo nao existe, nao e zero.
function custoPorConversa(row: ConversasRow | undefined) {
  const conversas = Number(row?.conversas) || 0;
  const spend = Number(row?.spend) || 0;
  return conversas > 0 ? formatCurrency(spend / conversas) : "—";
}

// Card aprovado na página Consolidado (Metas PV); movido para Meta Ads sem alterar
// conteúdo, números, legendas nem layout interno. Reusa o case "metas-pv" (cache TanStack).
export function CustoConversaCard({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading } = useDashboardData<{ meta_conversas: ConversasRow[]; meta_conversas_wpp: ConversasRow[] }>("metas-pv", dateRange);

  if (isLoading)
    return (
      <div className="kpi-card flex items-center justify-center min-h-[120px]">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );

  // Duas leituras que nao se substituem: a marginal responde "quanto custa a proxima
  // conversa", a total responde "quanto o Meta inteiro custou por conversa gerada".
  const custoMarginal = custoPorConversa(data?.meta_conversas_wpp?.[0]);
  const custoTotal = custoPorConversa(data?.meta_conversas?.[0]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="kpi-card">
      <FilterTooltip className="mb-1" title="Custo por conversa (marginal)" blocks={[
        { year: "Marginal", filters: ["FROM facebook.ads_insights", "date_start BETWEEN startDate AND endDate", "campaign_name LIKE '%wpp%' OR '%whats%'", "spend ÷ onsite_conversion.messaging_conversation_started_7d"] },
        { year: "Total", filters: ["Mesma conta sem o filtro de campanha", "Inclui campanhas de conversão, que gastam sem gerar conversa"] },
      ]} />
      <p className="text-2xl font-bold font-mono">{custoMarginal}</p>
      <p className="text-xs text-muted-foreground mt-1">só campanhas de WhatsApp — quanto custa gerar a próxima conversa</p>
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Investimento total ÷ conversas</p>
        <p className="text-base font-bold font-mono mt-0.5">{custoTotal}</p>
        <p className="text-[10px] text-muted-foreground mt-1">todo o investimento do Meta, campanhas de conversão incluídas</p>
      </div>
    </motion.div>
  );
}
