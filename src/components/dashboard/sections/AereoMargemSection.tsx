import { useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { useDashboardData } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";

interface TotalRow {
  passagens: string; receita: string; custo: string; margem: string; margem_pct: string;
}
interface TrechoRow {
  trecho: string; passagens: string; receita: string; custo: string; margem: string; margem_media: string;
}
interface TrechoLoteRow {
  trecho: string; lote: string; passagens: string; margem_media: string;
}
interface AereoMargemData {
  margem_total: TotalRow[];
  margem_por_trecho: TrechoRow[];
  margem_trecho_lote: TrechoLoteRow[];
  nao_classificados: Array<{ qtd: string }>;
}

// A view devolve o lote com o rótulo curto; na tela ele aparece como o usuário fala.
const LOTES: Array<{ key: string; label: string }> = [
  { key: "PV", label: "PV" },
  { key: "L1", label: "1º" },
  { key: "L2", label: "2º" },
  { key: "L3", label: "3º" },
];

const TOOLTIP_BLOCKS = [
  {
    year: "Receita",
    filters: [
      "Parcela aérea do ingresso, não o valor cheio da linha",
      "Combo: preço do combo menos o passaporte do mesmo lote e gênero",
      "Aéreo avulso: valor cheio da linha",
    ],
  },
  {
    year: "Custo",
    filters: [
      "FROM custos.aereo_trecho — por pax, ida e volta",
      "NÃO vem do data lake: foi digitado a partir da planilha 'Passagens Azul_Coral Moment 2026', aba 'Resumo Aéreo'",
      "Se a planilha mudar, a tabela precisa ser atualizada a mão",
      "A planilha separa CGH 02/09 (3.020,14) de CGH 03/09 (2.993,15), mas o nome do ingresso não carrega a data do voo. Adotado o maior dos dois para não superestimar a margem.",
      "4 aéreos avulsos não trazem sigla de aeroporto no nome e usam o custo médio de R$ 2.661,89.",
    ],
  },
  {
    year: "Cuidado",
    filters: [
      "NÃO fazer receita menos os R$ 178.346,74 da planilha: são 67 pax de custo contra 57 passagens vendidas, e dá um prejuízo falso de R$ 16 mil.",
    ],
  },
  {
    year: "Divergência de reconciliação",
    filters: [
      "Duas leituras da margem, e elas discordam. Pelo custo de cada trecho vendido a margem é −R$ 2.050,94 (−1,3%). Pelo custo médio da planilha (57 × R$ 2.661,89) seria +R$ 10.578,27 (+6,5%). A diferença é R$ 12.629 e inverte o sinal.",
      "A causa: a planilha soma R$ 178.346,74 para 67 pax, média de R$ 2.661,89 — mas o trecho mais barato (GIG) custa R$ 2.593,91, então para essa média fechar a planilha teria que ser quase toda GIG. Os ingressos vendidos são o oposto: 36 das 57 passagens são GRU, CGH ou CNF, os caros.",
      "Enquanto os 67 pax da planilha não forem reconciliados nome a nome com as 57 passagens vendidas, o número consolidado não é confiável. O corte por trecho é.",
    ],
  },
];

function sinalClass(v: number) {
  if (v > 0) return "text-emerald-500";
  if (v < 0) return "text-destructive";
  return "text-muted-foreground";
}

function Numero({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn("font-mono font-bold", destaque ? cn("text-3xl", sinalClass(valor)) : "text-2xl")}>
        {formatCurrency(valor)}
      </p>
    </div>
  );
}

export function AereoMargemSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const { data, isLoading, error } = useDashboardData<AereoMargemData>("aereo-margem", dateRange);

  const computed = useMemo(() => {
    if (!data) return null;
    const t = data.margem_total?.[0];
    const trechos = (data.margem_por_trecho || []).map((r) => ({
      trecho: r.trecho,
      passagens: Number(r.passagens) || 0,
      receita: Number(r.receita) || 0,
      custo: Number(r.custo) || 0,
      margem: Number(r.margem) || 0,
      margemMedia: Number(r.margem_media) || 0,
    }));
    // Matriz trecho x lote. Célula ausente = não houve venda daquele lote no trecho,
    // e fica vazia de propósito: zero seria "vendeu e empatou".
    const matriz = new Map<string, Map<string, { media: number; passagens: number }>>();
    for (const r of data.margem_trecho_lote || []) {
      if (!matriz.has(r.trecho)) matriz.set(r.trecho, new Map());
      matriz.get(r.trecho)!.set(r.lote, { media: Number(r.margem_media) || 0, passagens: Number(r.passagens) || 0 });
    }
    return {
      passagens: Number(t?.passagens) || 0,
      receita: Number(t?.receita) || 0,
      custo: Number(t?.custo) || 0,
      margem: Number(t?.margem) || 0,
      margemPct: Number(t?.margem_pct) || 0,
      naoClassificados: Number(data.nao_classificados?.[0]?.qtd) || 0,
      trechos,
      matriz: [...matriz.entries()].sort((a, b) => a[0].localeCompare(b[0])),
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
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
        <FilterTooltip className="mb-3" title="Margem do Aéreo" blocks={TOOLTIP_BLOCKS} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Numero label="Receita da parcela aérea" valor={computed.receita} />
          <Numero label="Custo" valor={computed.custo} />
          <div>
            <Numero label="Margem" valor={computed.margem} destaque />
            <p className={cn("text-xs font-mono", sinalClass(computed.margem))}>
              {computed.margemPct > 0 ? "+" : ""}{computed.margemPct.toFixed(1)}% · {formatNumber(computed.passagens)} passagens
            </p>
          </div>
        </div>
        {computed.naoClassificados > 0 && (
          <p className="text-[10px] text-muted-foreground mt-3">
            {computed.naoClassificados} linha(s) fora do cálculo como "não classificada(s)": sem trecho identificável e receita abaixo do custo do trecho mais barato (GIG, R$ 2.593,91) — dar custo médio a elas inventaria prejuízo. A linha não foi apagada do dado, só sai da margem.
          </p>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card">
        <FilterTooltip className="mb-3" title="Margem por trecho" blocks={TOOLTIP_BLOCKS} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-2">Trecho</th>
                <th className="text-right font-medium py-2">Passagens</th>
                <th className="text-right font-medium py-2">Receita</th>
                <th className="text-right font-medium py-2">Custo</th>
                <th className="text-right font-medium py-2">Margem</th>
                <th className="text-right font-medium py-2">Média/passagem</th>
              </tr>
            </thead>
            <tbody>
              {computed.trechos.map((t) => (
                <tr key={t.trecho} className="border-b border-border/50 last:border-0">
                  <td className="py-2 font-medium">{t.trecho}</td>
                  <td className="py-2 text-right font-mono">{formatNumber(t.passagens)}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(t.receita)}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(t.custo)}</td>
                  <td className={cn("py-2 text-right font-mono font-bold", sinalClass(t.margem))}>
                    {t.margem > 0 ? "+" : ""}{formatCurrency(t.margem)}
                  </td>
                  <td className={cn("py-2 text-right font-mono", sinalClass(t.margemMedia))}>
                    {t.margemMedia > 0 ? "+" : ""}{formatCurrency(t.margemMedia)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card">
        <FilterTooltip
          className="mb-1"
          title="Margem média por passagem — trecho × lote"
          blocks={[...TOOLTIP_BLOCKS, { year: "Leitura", filters: ["Só combos (eh_combo)", "Célula vazia = não houve venda daquele lote no trecho"] }]}
        />
        <p className="text-[10px] text-muted-foreground mb-3">Célula vazia = sem venda. Só combos.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-2">Trecho</th>
                {LOTES.map((l) => (
                  <th key={l.key} className="text-right font-medium py-2 px-2">{l.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {computed.matriz.map(([trecho, celulas]) => (
                <tr key={trecho} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 font-medium">{trecho}</td>
                  {LOTES.map((l) => {
                    const c = celulas.get(l.key);
                    if (!c) return <td key={l.key} className="py-1.5 px-2" />;
                    return (
                      <td key={l.key} className="py-1.5 px-1">
                        <div
                          className={cn(
                            "rounded px-2 py-1 text-right font-mono font-semibold",
                            c.media >= 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-destructive/15 text-destructive",
                          )}
                          title={`${c.passagens} passagem(ns)`}
                        >
                          {c.media > 0 ? "+" : ""}{formatCurrency(c.media)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
