import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { FilterTooltip } from "@/components/dashboard/FilterTooltip";
import { UpdateBadge } from "@/components/dashboard/UpdateBadge";
import { DadoDesatualizadoBanner } from "@/components/dashboard/IntegracaoParadaBanner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { useDashboardData } from "@/hooks/useDashboardData";

const TEAL = "#0D4F4F";
const RED = "#DC2626";
const GREEN = "#059669";

interface FinData {
  kpis: Array<{ bloco: string; tipo: string; valor: string; valor_pago: string; valor_em_aberto: string; n: string }>;
  por_edicao: Array<{ edicao: string; receita: string; despesa: string; resultado: string; n: string }>;
  kpis_edicao: Array<{ receita: string; despesa: string; resultado: string; a_receber: string; a_pagar: string }>;
  mensal: Array<{ mes: string; tipo: string; valor: string }>;
  categorias_despesa: Array<{ categoria_nome: string; valor: string; n: string }>;
  categorias_receita: Array<{ categoria_nome: string; valor: string; n: string }>;
  movimentacao: Array<{ centro_custo_nome: string; entradas: string; saidas: string; n: string }>;
  nao_classificado: Array<{ tipo: string; n: string; valor: string }>;
  edicoes: Array<{ edicao: string }>;
  ultimo_sync: Array<{ quando: string; horas: string }>;
}

const MES_CURTO = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const labelMes = (mes: string) => {
  const [y, m] = mes.split("-");
  return `${MES_CURTO[Number(m)] || m}/${y?.slice(2) ?? ""}`;
};

const num = (v: string | undefined) => Number(v) || 0;

// Edição em andamento: despesa de produção já lançada, receita ainda entrando.
// Nunca comparar de igual para igual com edição fechada.
const EDICAO_EM_CURSO = "Coral Moment 26";
// O histórico do Conta Azul começa em 02/01/2023; a CM22 não tem receita na
// base (é ausência de dado, não prejuízo) e por isso sai da comparação.
const EDICAO_SEM_HISTORICO = "Coral Moment 22";
const emCurso = (e: string) => e === EDICAO_EM_CURSO;

function BadgeEmCurso({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500 ${className}`}>
      Em curso
    </span>
  );
}


function Card({ title, tooltip, value, sub, color, delay = 0 }: {
  title: string;
  tooltip?: { title: string; blocks: { year?: string; filters: string[] }[] };
  value: string;
  sub?: React.ReactNode;
  color?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="kpi-card"
    >
      <div className="mb-2">
        {tooltip ? (
          <FilterTooltip title={tooltip.title} blocks={tooltip.blocks} />
        ) : (
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        )}
      </div>
      <div className="text-2xl font-bold font-mono tracking-tight" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </motion.div>
  );
}

function ChartBox({ title, tooltip, children }: { title: string; tooltip?: { title: string; blocks: { year?: string; filters: string[] }[] }; children: React.ReactNode }) {
  return (
    <div className="kpi-card">
      <div className="mb-4">
        {tooltip ? <FilterTooltip title={tooltip.title} blocks={tooltip.blocks} /> : (
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        )}
      </div>
      {children}
    </div>
  );
}

const moneyTooltip = {
  contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 },
  formatter: (v: number) => formatCurrency(Number(v)),
};

const Financeiro = () => {
  const [edicao, setEdicao] = useState("Coral Moment 26");
  const { data, isLoading, error } = useDashboardData<FinData>("financeiro-cm", undefined, edicao);

  const c = useMemo(() => {
    if (!data) return null;
    const k = data.kpis_edicao?.[0];
    const receita = num(k?.receita);
    const despesa = num(k?.despesa);

    const todasEdicoes = (data.por_edicao || []).filter((r) => r.edicao?.startsWith("Coral Moment"));

    const cm22 = todasEdicoes.find((r) => r.edicao === EDICAO_SEM_HISTORICO);

    const edicoes = todasEdicoes
      .filter((r) => r.edicao !== EDICAO_SEM_HISTORICO)
      .map((r) => ({
        edicao: r.edicao.replace("Coral Moment ", "CM") + (emCurso(r.edicao) ? " (em curso)" : ""),
        emCurso: emCurso(r.edicao),
        receita: num(r.receita),
        despesa: num(r.despesa),
        resultado: num(r.resultado),
      }));


    const meses: Record<string, { mes: string; receita: number; despesa: number }> = {};
    for (const r of data.mensal || []) {
      meses[r.mes] ??= { mes: labelMes(r.mes), receita: 0, despesa: 0 };
      if (r.tipo === "receita") meses[r.mes].receita += num(r.valor);
      else meses[r.mes].despesa += num(r.valor);
    }

    const bloco = (b: string, t: string) => data.kpis?.find((x) => x.bloco === b && x.tipo === t);
    const estruturaR = num(bloco("estrutura", "receita")?.valor);
    const estruturaD = num(bloco("estrutura", "despesa")?.valor);

    const nc = data.nao_classificado || [];
    const ncRec = nc.find((r) => r.tipo === "receita");
    const ncDes = nc.find((r) => r.tipo === "despesa");

    return {
      receita,
      despesa,
      resultado: receita - despesa,
      aReceber: num(k?.a_receber),
      aPagar: num(k?.a_pagar),
      edicoes,
      cm22: cm22 ? { receita: num(cm22.receita), despesa: num(cm22.despesa) } : null,

      mensal: Object.keys(meses).sort().map((m) => meses[m]),
      catDespesa: (data.categorias_despesa || []).map((r) => ({ nome: r.categoria_nome || "Sem categoria", valor: num(r.valor) })).reverse(),
      catReceita: (data.categorias_receita || []).map((r) => ({ nome: r.categoria_nome || "Sem categoria", valor: num(r.valor) })).reverse(),
      estruturaR,
      estruturaD,
      estruturaRes: estruturaR - estruturaD,
      movimentacao: (data.movimentacao || []).map((r) => ({
        centro: r.centro_custo_nome,
        entradas: num(r.entradas),
        saidas: num(r.saidas),
        n: num(r.n),
      })),
      ncRec: { n: num(ncRec?.n), valor: num(ncRec?.valor) },
      ncDes: { n: num(ncDes?.n), valor: num(ncDes?.valor) },
      opcoes: (data.edicoes || []).map((r) => r.edicao),
      ultimoSync: data.ultimo_sync?.[0]?.quando ?? null,
      horasSync: data.ultimo_sync?.[0]?.horas != null ? Number(data.ultimo_sync[0].horas) : null,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Carregando financeiro...
      </div>
    );
  }

  if (error || !c) {
    return <div className="text-destructive text-sm">Erro ao carregar dados financeiros.</div>;
  }

  return (
    <div className="space-y-4 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-xs text-muted-foreground">Conta Azul — receitas e despesas por centro de custo</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={edicao} onValueChange={setEdicao}>
            <SelectTrigger className="w-[220px] h-9 text-xs">
              <SelectValue placeholder="Edição" />
            </SelectTrigger>
            <SelectContent>
              {(c.opcoes.length ? c.opcoes : [edicao]).map((o) => (
                <SelectItem key={o} value={o} className="text-xs">
                  {o}{emCurso(o) ? " — em curso" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <UpdateBadge />
        </div>
      </header>

      {/* ── Bloco 1: Resultado do evento ── */}
      <div className="flex flex-wrap items-center gap-2">
        <SectionHeader title={`Resultado do evento — ${edicao}`} />
        {emCurso(edicao) && <BadgeEmCurso />}
      </div>
      {emCurso(edicao) && (
        <p className="text-xs text-amber-500">
          Edição <strong>em curso</strong>: a despesa de produção já está lançada e a receita ainda está entrando.
          O resultado abaixo é parcial e não é comparável de igual para igual com edições fechadas.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          title="Receita"
          tooltip={{ title: "Receita", blocks: [{ filters: ["bloco = 'evento'", `edicao = '${edicao}'`, "tipo = 'receita'", "SUM(valor) — contas a receber lançadas"] }] }}
          value={formatCurrency(c.receita)}
          sub={emCurso(edicao) ? <BadgeEmCurso /> : undefined}
          color={TEAL}
        />
        <Card
          title="Despesa"
          tooltip={{ title: "Despesa", blocks: [{ filters: ["bloco = 'evento'", `edicao = '${edicao}'`, "tipo = 'despesa'", "SUM(valor) — contas a pagar lançadas"] }] }}
          value={formatCurrency(c.despesa)}
          sub={emCurso(edicao) ? <BadgeEmCurso /> : undefined}
          delay={0.05}
        />
        <Card
          title="Resultado"
          tooltip={{
            title: "Resultado",
            blocks: [
              {
                year: "De onde vem o número",
                filters: [
                  "receita − despesa, sobre vw_movimento (Conta Azul)",
                  `entram só as linhas de bloco = 'evento' com edicao = '${edicao}'`,
                  "edição = centro de custo do lançamento (centro_custo_nome LIKE 'Coral Moment%' / 'Summer%' / 'Encore')",
                ],
              },
              {
                year: "O que fica de fora",
                filters: [
                  "categoria com Empréstimo, Aporte ou Reembolso Aporte → bloco 'financeiro', mesmo com centro de custo de evento (é financiamento, não faturamento)",
                  "centro de custo 'Reality' → bloco 'estrutura' (custo fixo da agência)",
                  "linhas sem centro de custo → 'não classificado', mostradas no rodapé",
                ],
              },
              {
                year: "Eixo e base",
                filters: [
                  "o eixo do tempo é a competência (data_competencia), não o caixa",
                  "valor lançado (SUM(valor)), independente de pago ou em aberto",
                  "histórico disponível no Conta Azul começa em 02/01/2023",
                ],
              },
            ],
          }}
          value={formatCurrency(c.resultado)}
          sub={emCurso(edicao) ? <BadgeEmCurso /> : undefined}
          color={c.resultado >= 0 ? GREEN : RED}
          delay={0.1}
        />
        <Card
          title="Em aberto"
          tooltip={{ title: "Em aberto", blocks: [{ filters: ["SUM(valor_em_aberto) por tipo", "situação vem de status (ACQUITTED/PENDING)", "nunca da coluna situacao crua"] }] }}
          value={formatCurrency(c.aReceber)}
          sub={<>A receber • a pagar: <span className="font-mono">{formatCurrency(c.aPagar)}</span></>}
          delay={0.15}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBox tooltip={{ title: "Edição x edição — receita e despesa", blocks: [{ filters: ["bloco = 'evento'", "centro_custo_nome LIKE 'Coral Moment%'", "SUM(valor) por edição e tipo", "CM22 fora: período anterior ao início do histórico", "CM26 em curso: receita ainda entrando"] }] }} title="Edições">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={c.edicoes} margin={{ top: 25, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="edicao" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...moneyTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="receita" name="Receita" fill={TEAL} radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill={RED} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {c.edicoes.map((e) => (
              <div key={e.edicao} className="text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.edicao} resultado</div>
                <div className="text-xs font-mono font-semibold" style={{ color: e.resultado >= 0 ? GREEN : RED }}>
                  {formatCurrency(e.resultado)}
                </div>
                {e.emCurso && <BadgeEmCurso className="mt-1" />}
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
            <p>
              <BadgeEmCurso /> CM26 é edição em andamento — despesa de produção lançada, receita ainda entrando.
              Não comparar de igual para igual com edição fechada.
            </p>
            {c.cm22 && (
              <p>
                CM22 fora da comparação: período anterior ao início do histórico disponível no Conta Azul (02/01/2023).
                Na base há {formatCurrency(c.cm22.despesa)} de despesa e {formatCurrency(c.cm22.receita)} de receita —
                é ausência de dado, não prejuízo.
              </p>
            )}
          </div>
        </ChartBox>



        <ChartBox tooltip={{ title: "Receita x despesa por mês de competência", blocks: [{ filters: ["bloco = 'evento'", `edicao = '${edicao}'`, "FORMAT_DATE('%Y-%m', data_competencia)", "últimos 36 meses"] }] }} title="Mensal">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={c.mensal} margin={{ top: 25, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={50} />
              <YAxis hide />
              <Tooltip {...moneyTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="receita" name="Receita" fill={TEAL} radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill={RED} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBox tooltip={{ title: "Top 10 categorias de despesa", blocks: [{ filters: ["bloco = 'evento'", `edicao = '${edicao}'`, "tipo = 'despesa'", "SUM(valor) por categoria_nome, top 10"] }] }} title="Top despesas">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart layout="vertical" data={c.catDespesa} margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="nome" width={160} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...moneyTooltip} />
              <Bar dataKey="valor" name="Despesa" fill={RED} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox tooltip={{ title: "Top 10 categorias de receita", blocks: [{ filters: ["bloco = 'evento'", `edicao = '${edicao}'`, "tipo = 'receita'", "SUM(valor) por categoria_nome, top 10"] }] }} title="Top receitas">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart layout="vertical" data={c.catReceita} margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="nome" width={160} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...moneyTooltip} />
              <Bar dataKey="valor" name="Receita" fill={TEAL} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      {/* ── Bloco 2: Estrutura ── */}
      <SectionHeader title="Estrutura — Reality" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Receita"
          tooltip={{ title: "Receita da estrutura", blocks: [{ filters: ["centro_custo_nome = 'Reality'", "custo/receita da agência, não de edição", "não entra na margem de nenhuma edição"] }] }}
          value={formatCurrency(c.estruturaR)}
          color={TEAL}
        />
        <Card
          title="Despesa"
          tooltip={{ title: "Despesa da estrutura", blocks: [{ filters: ["centro_custo_nome = 'Reality'", "estrutura fixa da agência", "fora do resultado do evento"] }] }}
          value={formatCurrency(c.estruturaD)}
          delay={0.05}
        />
        <Card
          title="Resultado"
          tooltip={{ title: "Resultado da estrutura", blocks: [{ filters: ["receita − despesa em 'Reality'", "não contamina a margem das edições"] }] }}
          value={formatCurrency(c.estruturaRes)}
          color={c.estruturaRes >= 0 ? GREEN : RED}
          delay={0.1}
        />
      </div>

      {/* ── Bloco 3: Movimentação financeira ── */}
      <SectionHeader title="Movimentação financeira" />
      <p className="text-xs text-muted-foreground">
        Empréstimos, aportes, estornos e ajustes. São entradas e saídas de caixa, não receita nem despesa —
        por isso ficam <strong>fora do resultado do evento</strong>, de propósito.
      </p>
      <div className="kpi-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2">Centro de custo</th>
              <th className="py-2 text-right">Entradas</th>
              <th className="py-2 text-right">Saídas</th>
              <th className="py-2 text-right">Líquido</th>
              <th className="py-2 text-right">Lançamentos</th>
            </tr>
          </thead>
          <tbody>
            {c.movimentacao.map((r) => (
              <tr key={r.centro} className="border-b border-border/40 last:border-0">
                <td className="py-2">{r.centro}</td>
                <td className="py-2 text-right font-mono">{formatCurrency(r.entradas)}</td>
                <td className="py-2 text-right font-mono">{formatCurrency(r.saidas)}</td>
                <td className="py-2 text-right font-mono" style={{ color: r.entradas - r.saidas >= 0 ? GREEN : RED }}>
                  {formatCurrency(r.entradas - r.saidas)}
                </td>
                <td className="py-2 text-right font-mono text-muted-foreground">{formatNumber(r.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Rodapé ── */}
      <div className="pt-4 space-y-1 text-[11px] text-muted-foreground border-t border-border">
        <p>
          Fora dos blocos acima: {formatNumber(c.ncDes.n)} lançamento(s) de despesa somando {formatCurrency(c.ncDes.valor)} e{" "}
          {formatNumber(c.ncRec.n)} de receita somando {formatCurrency(c.ncRec.valor)} — linhas sem centro de custo no Conta Azul.
          Por isso a soma dos três blocos não fecha com o total do ERP.
        </p>
        <DadoDesatualizadoBanner quando={c.ultimoSync} horas={c.horasSync} />
      </div>
    </div>
  );
};

export default Financeiro;
