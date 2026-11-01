// Modo demonstração da dashboard-data: no lugar do BigQuery, devolve dados FICTÍCIOS no mesmo
// formato que cada consulta devolveria. Ativado com CM_DEMO_MODE=true nas variáveis da função.
//
// Como funciona: lê o SELECT externo de cada SQL, descobre as colunas de saída (alias), separa
// dimensões (data, mês, gênero, canal…) de medidas (somas, contagens, razões) e gera linhas
// plausíveis, proporcionais ao período pedido e determinísticas (mesma consulta = mesmos números).
// Valores categóricos de expressões CASE (ex.: 'pix', 'concierge') são lidos do próprio SQL.

type Row = Record<string, string | null>;

const EVENTO = "Coral Moment";

// ------------------------------------------------------------------ aleatório determinístico
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ leitura do SQL
function nivelZero(sql: string, cb: (i: number, low: string) => boolean | void) {
  const low = sql.toLowerCase();
  let depth = 0;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" || c === "`" || c === '"') {
      const j = sql.indexOf(c, i + 1);
      i = j < 0 ? sql.length : j;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && cb(i, low) === true) return;
  }
}

function palavra(low: string, i: number, w: string) {
  return low.startsWith(w, i) && (i === 0 || !/[a-z0-9_]/.test(low[i - 1])) && !/[a-z0-9_]/.test(low[i + w.length] ?? " ");
}

function analisar(sql: string) {
  let sel = -1;
  nivelZero(sql, (i, low) => { if (palavra(low, i, "select")) sel = i; });
  if (sel < 0) return { cols: [] as { alias: string; expr: string }[], grupo: false, limite: 0, distinto: false };
  let from = sql.length;
  nivelZero(sql.slice(sel), (i, low) => { if (palavra(low, i, "from")) { from = sel + i; return true; } });
  let lista = sql.slice(sel + 6, from).trim();
  const distinto = /^distinct\b/i.test(lista);
  if (distinto) lista = lista.slice(8);
  const partes: string[] = [];
  let cur = "", depth = 0;
  for (let i = 0; i < lista.length; i++) {
    const c = lista[i];
    if (c === "'") { const j = lista.indexOf("'", i + 1); cur += lista.slice(i, j + 1); i = j; continue; }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === "," && depth === 0) { partes.push(cur); cur = ""; } else cur += c;
  }
  partes.push(cur);
  const cols = partes.map((p) => {
    const e = p.trim();
    const m = e.match(/\bas\s+`?(\w+)`?\s*$/i);
    return { alias: m ? m[1] : e.split(/[.\s]/).pop()!, expr: e };
  });
  const resto = sql.slice(from).toLowerCase();
  const grupo = /group\s+by/.test(resto.replace(/\([^()]*\)/g, ""));
  const lm = resto.match(/limit\s+(\d+)\s*$/) ?? resto.match(/limit\s+(\d+)/);
  return { cols, grupo, limite: lm ? Number(lm[1]) : 0, distinto };
}

const AGREGADO = /\b(sum|count|avg|max|min|safe_divide|approx_count_distinct|countif|stddev)\s*\(/i;

// ------------------------------------------------------------------ vocabulário fictício
const VOC: Record<string, string[]> = {
  genero: ["Feminino", "Masculino"],
  gender: ["female", "male"],
  age: ["18-24", "25-34", "35-44", "45-54", "55-64"],
  age_range: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
  faixa: ["18 a 24", "25 a 34", "35 a 44", "45 a 54", "55 ou mais"],
  region: ["São Paulo", "Rio de Janeiro", "Pernambuco", "Minas Gerais", "Bahia", "Paraná", "Distrito Federal", "Rio Grande do Sul", "Santa Catarina", "Ceará"],
  estado: ["SP", "RJ", "PE", "MG", "BA", "PR", "DF", "RS", "SC", "CE", "GO", "ES"],
  device: ["mobile", "desktop", "tablet"],
  device_category: ["mobile", "desktop", "tablet"],
  operating_system: ["iOS", "Android", "Windows", "Macintosh", "Linux"],
  source: ["LP", "Ingresse"],
  campaign: ["instagram / social", "google / cpc", "(direct) / (none)", "facebook / paid", "newsletter / email", "tiktok / paid"],
  campaign_name: ["[CM26] Conversão Passaporte", "[CM26] Remarketing Site", "[CM26] Mensagens WhatsApp", "[CM26] Alcance Lançamento", "[CM26] Sunset Boat", "[STEP] Search Marca", "[STEP] Search Genérico"],
  adset_name: ["Público Semelhante 2%", "Interesse Viagens", "Remarketing 30d", "Envolvimento Instagram", "Base de Compradores"],
  creative_name: ["Vídeo Aftermovie 30s", "Carrossel Atrações", "Story Contagem Regressiva", "Foto Pôr do Sol", "Reels Line-up"],
  keyword: ["festival na praia", "pacote festa ilha", "passaporte moment", "sunset boat party", "viagem para ilha", "festa ano novo praia"],
  pagamento: ["credit_card", "pix", "wallet"],
  meio: ["credit_card", "pix", "wallet", "debit_card"],
  tipo: ["receita", "despesa"],
  ingresso: ["Passaporte 1º Lote Feminino", "Passaporte 1º Lote Masculino", "Passaporte Pré-venda", "Combo Aéreo + Passaporte",
             "Sunset Boat Party Sexta", "Sunset Boat Party Sábado", "Brunch", "Opening Party", "Hospedagem Pousada Titular"],
  trecho: ["GRU ⇄ Ilha", "REC ⇄ Ilha", "CNF ⇄ Ilha", "BSB ⇄ Ilha"],
  lote: ["PV", "L1", "L2", "L3"],
  categoria_nome: ["Produção", "Artistas", "Hospedagem", "Marketing", "Transporte", "Alimentação", "Estrutura", "Impostos", "Taxas de venda", "Equipe"],
  centro_custo_nome: ["Evento", "Marketing", "Hospedagem", "Aéreo", "Administrativo"],
  descricao: ["Vídeo aftermovie", "Contagem regressiva", "Line-up anunciado", "Bastidores da ilha", "Depoimento de público"],
  edicao: [`${EVENTO} 26`, `${EVENTO} 25`, `${EVENTO} 24`, `${EVENTO} 23`, `${EVENTO} 22`],
};

// magnitude por dia de período (unidade da medida)
const MONEY = /^(fat|faturamento|receita|revenue|valor|purchase_value|conversion_value|spend|cost|custo|gasto|desconto|total_desconto|pix|cc|entradas|saidas|despesa|resultado|a_receber|a_pagar|margem|receita_pv|fat_.*)$/;
const BASE: Record<string, number> = {
  faturamento: 26000, receita: 24000, revenue: 9000, valor: 30000, purchase_value: 7000, conversion_value: 4500,
  spend: 1300, cost: 450, custo: 700, gasto: 380, desconto: 900, total_desconto: 900, pix: 9000, cc: 15000,
  entradas: 9000, saidas: 7000, despesa: 18000, resultado: 6000, a_receber: 2500, a_pagar: 2000, margem: 700,
  receita_pv: 8000, fat_aereo: 6000, fat_hospedagem: 4000, fat_cc: 15000, fat_pix: 9000,
  qtd: 34, ingressos: 40, total_ingressos: 40, qtd_passaportes: 18, qtd_pv: 6, qtd_hospedagem: 5, qtd_aereo: 4,
  transacoes: 22, transactions: 22, sessions: 1100, sessoes: 1100, impressions: 52000, impressoes: 30000,
  clicks: 950, cliques: 600, reach: 21000, messages: 35, add_to_cart: 60, landing_page_views: 520, purchases: 14,
  conversions: 9, conversoes: 7, resultados: 9, conversas: 30, compradores: 18, passagens: 4, n: 12, total: 900,
};
const RAZAO: Record<string, [number, number]> = {
  ctr: [0.8, 3.2], cpc: [0.6, 2.4], cpm: [12, 38], roas: [2.5, 9], taxa_conv: [0.8, 4.5], margem_pct: [12, 34],
  margem_media: [180, 620], cost_per_conversion: [25, 90], dias: [0, 2], horas: [1, 20], parcelas: [1, 12],
};

function diasEntre(a: string, b: string) {
  const d = (Date.parse(b) - Date.parse(a)) / 864e5;
  return Number.isFinite(d) ? Math.max(1, Math.round(d) + 1) : 30;
}
function addDias(a: string, n: number) {
  return new Date(Date.parse(a) + n * 864e5).toISOString().slice(0, 10);
}
const fmt = (v: number, dec = 2) => (Number.isInteger(v) && dec === 0 ? String(v) : v.toFixed(dec));

function literaisCase(expr: string): string[] {
  if (!/\bcase\b/i.test(expr)) return [];
  const out: string[] = [];
  for (const m of expr.matchAll(/\b(?:then|else)\s+'([^']*)'/gi)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

function ehMoney(alias: string, sql: string, key: string) {
  if (alias === "total") return /spend|cost|valor_final|custo|api_(pix|cc)/i.test(sql) || /cost|total$|api_/.test(key);
  return MONEY.test(alias);
}

// ------------------------------------------------------------------ casos sem colunas declaradas
function especial(key: string, r: () => number): Row[] | null {
  if (key === "kpis") {
    const out: Row[] = [];
    for (const bloco of ["evento", "estrutura"]) for (const tipo of ["receita", "despesa"]) {
      const v = (bloco === "evento" ? 1 : 0.18) * (tipo === "receita" ? 2600000 : 2050000) * (0.9 + r() * 0.2);
      const pago = v * (0.75 + r() * 0.2);
      out.push({ bloco, tipo, valor: fmt(v), valor_pago: fmt(pago), valor_em_aberto: fmt(v - pago), n: String(80 + Math.floor(r() * 400)) });
    }
    return out;
  }
  if (key === "por_edicao") {
    return VOC.edicao.map((edicao, i) => {
      const rec = (2600000 - i * 380000) * (0.9 + r() * 0.2), des = rec * (0.68 + r() * 0.2);
      return { edicao, receita: fmt(rec), despesa: fmt(des), resultado: fmt(rec - des), n: String(300 + Math.floor(r() * 500)) };
    });
  }
  return null;
}

// ------------------------------------------------------------------ gerador principal
export function fakeQuery(sql: string, key: string, startDate: string, endDate: string): Row[] {
  const r = rng(`${key}|${startDate}|${endDate}|${sql.length}`);
  const esp = especial(key, r);
  if (esp) return esp;

  const { cols, grupo, limite, distinto } = analisar(sql);
  if (!cols.length) return [];
  const anterior = /(_prev|_cm25|25_janela|_prev_)/.test(key) ? 0.84 : 1;
  const dias = diasEntre(startDate, endDate);

  const dims = cols.filter((c) => !AGREGADO.test(c.expr) && !/^\s*(coalesce\s*\(\s*)?\d/.test(c.expr) && !(c.alias in RAZAO)
    && !(c.alias in BASE) && !MONEY.test(c.alias));
  const medidas = cols.filter((c) => !dims.includes(c));

  // valores possíveis de cada dimensão
  const dominio = (c: { alias: string; expr: string }): string[] => {
    const a = c.alias, e = c.expr.toLowerCase();
    if (/^(data|date|campaign_date|dia|date_start)$/.test(a)) {
      const n = Math.min(dias, 120);
      return Array.from({ length: n }, (_, i) => addDias(endDate, -i)).reverse();
    }
    if (a === "mes") {
      if (/extract\s*\(\s*month/.test(e)) {
        const m0 = Number(startDate.slice(5, 7)), m1 = Number(endDate.slice(5, 7));
        const ms: string[] = [];
        for (let m = m0; m !== m1 + 1 && ms.length < 12; m = (m % 12) + 1) ms.push(String(m));
        return ms;
      }
      return Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.parse(endDate)); d.setUTCMonth(d.getUTCMonth() - 11 + i); return d.toISOString().slice(0, 7); });
    }
    if (/^(last_date|ultima_data|quando)$/.test(a)) return [a === "quando" ? `${addDias(endDate, 0)}T08:00:00` : addDias(endDate, -1)];
    const lit = literaisCase(c.expr);
    if (lit.length) return lit;
    if (a === "evento_id") return ["89311", "89312"];
    if (a === "Evento_ID") return (sql.match(/Evento_ID\s+IN\s*\(([^)]*)\)/i)?.[1].split(",").map((s) => s.trim()) ?? ["89311", "89312"]);
    if (a === "criativo_id") return Array.from({ length: 6 }, (_, i) => String(1780000000000 + i * 7919));
    if (a === "creative_image_url" || a === "url_publica") return ["https://placehold.co/600x600?text=Criativo"];
    if (a === "parcelas") return ["1", "2", "3", "4", "5", "6", "10", "12"];
    return VOC[a] ?? VOC[a.toLowerCase()] ?? [`${a} A`, `${a} B`, `${a} C`];
  };

  // linhas: produto cartesiano das dimensões (limitado)
  let linhas: Row[] = [{}];
  const dimsGera = dims.filter((c) => !/^(creative_image_url|url_publica)$/.test(c.alias));
  for (const d of dimsGera) {
    const vals = dominio(d);
    const novo: Row[] = [];
    for (const l of linhas) for (const v of vals) novo.push({ ...l, [d.alias]: v });
    linhas = novo;
    if (linhas.length > 600) break;
  }
  // consultas sem GROUP BY e sem dimensões = uma linha de totais; detalhe sem GROUP BY = amostra
  if (!dimsGera.length) linhas = [{}];
  else if (!grupo && !distinto && medidas.length) {
    linhas = Array.from({ length: Math.min(80, dias * 3) }, () => {
      const l: Row = {};
      for (const d of dimsGera) { const v = dominio(d); l[d.alias] = v[Math.floor(r() * v.length)]; }
      return l;
    }).sort((a, b) => String(b.data ?? "").localeCompare(String(a.data ?? "")));
  }
  if (limite) linhas = linhas.slice(0, limite);

  // pesos por linha (somam 1) para repartir os totais do período
  const pesos = linhas.map((l) => {
    let w = 0.4 + r();
    if (l.genero === "Feminino" || l.gender === "female") w *= 1.25;
    if (l.device === "mobile" || l.device_category === "mobile") w *= 3;
    if (l.estado === "SP" || l.region === "São Paulo") w *= 2.5;
    if (l.tipo === "cortesia") w *= 0.15;
    return w;
  });
  const soma = pesos.reduce((a, b) => a + b, 0) || 1;

  linhas.forEach((l, i) => {
    const parte = pesos[i] / soma;
    for (const m of medidas) {
      const a = m.alias;
      if (a in RAZAO) continue;
      const base = BASE[a] ?? (ehMoney(a, sql, key) ? 5000 : 30);
      const dinheiro = ehMoney(a, sql, key);
      let v = base * dias * anterior * (0.85 + r() * 0.3) * (linhas.length > 1 ? parte : 1);
      if (/^cortesia_/.test(key)) v *= 0.05;
      if (/^(desconto|total_desconto)$/.test(a)) v *= 0.6;
      l[a] = dinheiro ? fmt(v) : fmt(Math.max(0, Math.round(v)), 0);
    }
    // razões coerentes com as medidas da própria linha
    const n = (k: string) => Number(l[k] ?? NaN);
    for (const m of medidas) {
      const a = m.alias;
      if (!(a in RAZAO)) continue;
      const [lo, hi] = RAZAO[a];
      let v = lo + r() * (hi - lo);
      const imp = n("impressions") || n("impressoes"), cli = n("clicks") || n("cliques"), gasto = n("spend") || n("cost") || n("custo") || n("gasto");
      if (a === "ctr" && imp && cli) v = (cli / imp) * 100;
      if (a === "cpc" && cli && gasto) v = gasto / cli;
      if (a === "cpm" && imp && gasto) v = (gasto / imp) * 1000;
      if (a === "roas" && gasto && n("purchase_value")) v = n("purchase_value") / gasto;
      if (a === "margem_pct" && n("receita") && n("margem")) v = (n("margem") / n("receita")) * 100;
      l[a] = /^(dias|horas|parcelas)$/.test(a) ? String(Math.round(v)) : fmt(v);
    }
    for (const c of cols) if (/^(creative_image_url|url_publica)$/.test(c.alias)) l[c.alias] = "https://placehold.co/600x600?text=Criativo";
  });

  // margem = receita - custo quando as três existem
  for (const l of linhas) {
    if (l.receita != null && l.custo != null && l.margem != null) {
      const custo = Number(l.receita) * 0.72;
      l.custo = fmt(custo); l.margem = fmt(Number(l.receita) - custo);
    }
    if (l.receita != null && l.despesa != null && l.resultado != null) {
      l.despesa = fmt(Number(l.receita) * 0.74); l.resultado = fmt(Number(l.receita) - Number(l.despesa));
    }
  }
  return linhas;
}
