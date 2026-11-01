import "https://deno.land/x/xhr@0.1.0/mod.ts";

import { fakeQuery } from "./demo.ts";
const DEMO = Deno.env.get("CM_DEMO_MODE") === "true";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── In-memory cache (5 min TTL) ───
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  if (entry) cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
  // Evict old entries if cache grows too large
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.ts > CACHE_TTL) cache.delete(k);
    }
  }
}

// ─── Google Auth ───
async function createGoogleJWT(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/bigquery https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const encode = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${encode(header)}.${encode(payload)}`;
  const pemContents = serviceAccount.private_key.replace(/<CHAVE_PRIVADA_REMOVIDA>/, '').replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsignedToken));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${unsignedToken}.${signatureB64}`;
}

// Cache access token (valid 1h)
let tokenCache: { token: string; exp: number } | null = null;

async function getAccessToken(serviceAccount: any): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;
  const jwt = await createGoogleJWT(serviceAccount);
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Token error: ${JSON.stringify(data)}`);
  tokenCache = { token: data.access_token, exp: Date.now() + 50 * 60 * 1000 }; // 50 min
  return data.access_token;
}

async function runQuery(accessToken: string, projectId: string, query: string, queryKey: string): Promise<any[]> {
  const baseUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}`;
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  console.log(`[dashboard-data] Running query '${queryKey}'`);

  const startResp = await fetch(`${baseUrl}/queries`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, useLegacySql: false, maxResults: 10000 }),
  });

  let result = await startResp.json();
  if (!startResp.ok || result.error) {
    throw new Error(`BQ: ${JSON.stringify(result.error || result)}`);
  }

  let attempts = 0;
  while (result.jobComplete === false && attempts < 8) {
    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
    const location = result.jobReference?.location ? `&location=${encodeURIComponent(result.jobReference.location)}` : "";
    const pollResp = await fetch(`${baseUrl}/queries/${result.jobReference.jobId}?maxResults=10000${location}`, { method: "GET", headers });
    result = await pollResp.json();
    if (!pollResp.ok || result.error) throw new Error(`BQ (poll): ${JSON.stringify(result.error || result)}`);
  }

  if (result.jobComplete === false) return [];
  if (!result.rows) return [];

  const fields = result.schema.fields.map((f: any) => f.name);
  return result.rows.map((row: any) => Object.fromEntries(fields.map((f: string, i: number) => [f, row.f[i].v])));
}

// Accent-insensitive normalized ticket name. Defined once and used by every
// Ingresso text filter so 'Brisa' and 'Brisa' collapse to the same value.
const N = `REGEXP_REPLACE(NORMALIZE(LOWER(Ingresso), NFD), r'\\pM', '')`;

const CM_UNION = `(SELECT * FROM \`coral-moment.ingresse_api.CM25\` UNION ALL SELECT * FROM \`coral-moment.ingresse_api.CM26\`)`;

// ─── Lote F: metas de lote por DATA (não por rótulo do ingresso) ───
// Decisão fechada com a cliente: meta e realizado usam a mesma régua, o calendário.
// A meta de cada lote é o faturamento/passaportes da MESMA janela de calendário em
// 2025, +10%. O rótulo escrito no ingresso ("1º Lote") continua existindo, mas serve
// para análise de preço, não para medir o lote.
//
// RESSALVA CONHECIDA E ACEITA (não é bug): as janelas não coincidem perfeitamente
// entre os anos. Em 2025 a estrutura de lotes era outra (a pré-venda rodou até junho)
// e o Carnaval mudou de lugar (04/03/2025 vs 17/02/2026). "Mesma data de calendário"
// não é o mesmo que "mesma posição no ciclo de venda": maio/2025 foi o pico do ano
// porque a pré-venda de 2025 rodava em maio; em 2026 o pico correspondente caiu em junho.
// Hoje no fuso America/Sao_Paulo, formato YYYY-MM-DD.
function hojeSP(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// O 4º lote é o ÚNICO com janela aberta (ainda está vendendo). Por isso não pode ter
// data fim fixa: se 2026 para em "hoje" e 2025 pega o resto do ano inteiro (evento de
// setembro incluído), a comparação fica injusta e aparece um -91% falso. As duas janelas
// terminam em HOJE e na mesma data com ano -1, crescendo um dia por dia.
function loteJanelas(): Record<string, { start26: string; end26: string; start25: string; end25: string }> {
  const hoje = hojeSP();
  const hojeAnoAnterior = `${Number(hoje.slice(0, 4)) - 1}${hoje.slice(4)}`;
  return {
    'metas-pv':    { start26: '2026-01-13', end26: '2026-04-23', start25: '2025-01-13', end25: '2025-04-23' },
    'metas-lote1': { start26: '2026-04-24', end26: '2026-06-11', start25: '2025-04-24', end25: '2025-06-11' },
    'metas-lote2': { start26: '2026-06-12', end26: '2026-07-16', start25: '2025-06-12', end25: '2025-07-16' },
    'metas-lote3': { start26: '2026-07-17', end26: '2026-08-20', start25: '2025-07-17', end25: '2025-08-20' },
    'metas-lote4': { start26: '2026-08-21', end26: hoje, start25: '2025-08-21', end25: hojeAnoAnterior },
  };
}

// Parcela aérea embutida no COMBO: AÉREO + PASSAPORTE, por lote/gênero (mesma tabela
// usada no faturamento de aéreo). Sai da base da meta porque é repasse a terceiro.
const PARCELA_AEREA = `CASE WHEN lote = 'PV' THEN 2900 WHEN lote = 'L1' THEN 2750 WHEN lote = 'L2' AND genero = 'F' THEN 2600 WHEN lote = 'L2' THEN 2700 WHEN lote = 'L3' THEN 3100 ELSE 2800 END`;

// Base da meta: só ingressos com margem cheia.
// Fora: hospedagem/pousada/bangalô e passagem aérea avulsa (produtora é comissionada,
// dinheiro é repassado) e a Corrida Endorfina (Evento_ID 104146, meta própria).
const BASE_META_FILTRO = `Meio_de_Pagamento NOT IN ('cortesia','none','free') AND Evento_ID <> 104146 AND NOT (n LIKE '%pousada%' OR n LIKE '%hospedagem%' OR n LIKE '%bangalo%') AND NOT (n LIKE '%aereo%' AND n NOT LIKE '%combo%')`;

function baseMetaCTE(from: string, to: string) {
  return `WITH base AS (SELECT ${N} AS n, Qtd, Evento_ID, Meio_de_Pagamento, Valor_Final - IFNULL(CAST(Desconto AS FLOAT64), 0) AS net FROM ${CM_UNION} WHERE Data BETWEEN '${from}' AND '${to}'), classificado AS (SELECT *, CASE WHEN REGEXP_CONTAINS(n, r'pre[ -]?venda') THEN 'PV' WHEN REGEXP_CONTAINS(n, r'1\\s*[ºo°]?\\s*lote') THEN 'L1' WHEN REGEXP_CONTAINS(n, r'2\\s*[ºo°]?\\s*lote') THEN 'L2' WHEN REGEXP_CONTAINS(n, r'3\\s*[ºo°]?\\s*lote') THEN 'L3' WHEN REGEXP_CONTAINS(n, r'4\\s*[ºo°]?\\s*lote') THEN 'L4' ELSE 'ND' END AS lote, CASE WHEN n LIKE '%masc%' THEN 'M' WHEN n LIKE '%fem%' THEN 'F' ELSE 'ND' END AS genero FROM base WHERE ${BASE_META_FILTRO})`;
}

// Faturamento da janela: combo aéreo entra só com a parte do passaporte.
function faturamentoLote(from: string, to: string) {
  return `${baseMetaCTE(from, to)} SELECT ROUND(COALESCE(SUM(CASE WHEN n LIKE '%combo%' AND n LIKE '%aereo%' THEN net - (${PARCELA_AEREA}) ELSE net END), 0), 2) AS faturamento FROM classificado`;
}

// Passaportes da janela: combo conta como passaporte (regra que veio do Lote D).
function passaportesLote(from: string, to: string) {
  return `${baseMetaCTE(from, to)} SELECT COALESCE(SUM(Qtd), 0) AS qtd FROM classificado WHERE n LIKE '%passaporte%' OR n LIKE '%combo%'`;
}

function metasLoteQueries(page: string): Record<string, string> {
  const j = loteJanelas()[page];
  return {
    fat_cm26: faturamentoLote(j.start26, j.end26),
    fat_cm25: faturamentoLote(j.start25, j.end25),
    count_cm26: passaportesLote(j.start26, j.end26),
    count_cm25: passaportesLote(j.start25, j.end25),
    pass_cm26: passaportesLote(j.start26, j.end26),
    pass_cm25: passaportesLote(j.start25, j.end25),
  };
}


// Literal SQL string seguro (só para parâmetros vindos do cliente).
function sqlStr(v: string) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildQueries(page: string, startDate: string, endDate: string, edicao?: string): Record<string, string> {

  const sd = new Date(startDate);
  const ed = new Date(endDate);
  const prevStart = `${sd.getFullYear() - 1}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}`;
  const prevEnd = `${ed.getFullYear() - 1}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}`;

  switch (page) {
    case 'consolidado-cm':
      return {
        totals: `SELECT COALESCE(SUM(Valor_Final), 0) as faturamento, COALESCE(SUM(Qtd), 0) as total_ingressos, COALESCE(SUM(CAST(Desconto AS FLOAT64)), 0) as total_desconto FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        totals_prev: `SELECT COALESCE(SUM(Valor_Final), 0) as faturamento, COALESCE(SUM(Qtd), 0) as total_ingressos, COALESCE(SUM(CAST(Desconto AS FLOAT64)), 0) as total_desconto FROM ${CM_UNION} WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free') AND NOT (${N} LIKE '%opening%' OR ${N} LIKE '%openning%')`,
        // Quebra por loja de venda (Evento_ID). A Corrida (104146) é evento único, sem lojas
        // separadas, então entra pelo meio de pagamento real.
        fat_evento_89311: `SELECT COALESCE(SUM(Valor_Final), 0) as total, COALESCE(SUM(CAST(Desconto AS FLOAT64)), 0) as desconto FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND (Evento_ID = 89311 OR (Evento_ID = 104146 AND Meio_de_Pagamento IN ('credit_card','debit_card','wallet'))) AND Meio_de_Pagamento NOT IN ('free','none','cortesia')`,
        fat_evento_89312: `SELECT COALESCE(SUM(Valor_Final), 0) as total, COALESCE(SUM(CAST(Desconto AS FLOAT64)), 0) as desconto FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND (Evento_ID = 89312 OR (Evento_ID = 104146 AND Meio_de_Pagamento IN ('pix','money'))) AND Meio_de_Pagamento NOT IN ('free','none','cortesia')`,
        passaportes: `SELECT COALESCE(SUM(Qtd), 0) as qtd_passaportes FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%passaporte%' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        passaportes_prev: `SELECT COALESCE(SUM(Qtd), 0) as qtd_passaportes FROM ${CM_UNION} WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND ${N} LIKE '%passaporte%' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        gauge_pv_receita: `SELECT COALESCE(SUM(Valor_Final), 0) as receita_pv FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND REGEXP_CONTAINS(${N}, r'pre[ -]?venda') AND ${N} LIKE '%passaporte%' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        gauge_pv_qtd: `SELECT COALESCE(SUM(Qtd), 0) as qtd_pv FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND REGEXP_CONTAINS(${N}, r'pre[ -]?venda') AND ${N} LIKE '%passaporte%' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        monthly: `SELECT EXTRACT(MONTH FROM Data) as mes, COALESCE(SUM(Valor_Final), 0) as faturamento, COALESCE(SUM(Qtd), 0) as ingressos FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free') GROUP BY mes ORDER BY mes`,
        monthly_prev: `SELECT EXTRACT(MONTH FROM Data) as mes, COALESCE(SUM(Valor_Final), 0) as faturamento, COALESCE(SUM(Qtd), 0) as ingressos FROM ${CM_UNION} WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free') GROUP BY mes ORDER BY mes`,
        detail: `SELECT FORMAT_DATE('%Y-%m-%d', Data) as data, Ingresso as ingresso, Qtd as qtd, Valor_Final as receita, Meio_de_Pagamento as pagamento FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free') ORDER BY Data DESC`,
        ingressos_total_current: `SELECT COALESCE(SUM(Qtd), 0) as total_ingressos FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        ingressos_aereo_no_total: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free') AND ${N} NOT LIKE '%pousada%' AND ${N} NOT LIKE '%hospedagem%' AND ${N} NOT LIKE '%bangalo%' AND ${N} LIKE '%aereo%' AND ${N} NOT LIKE '%combo%'`,
        ingressos_abertura_no_total: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free') AND ${N} NOT LIKE '%pousada%' AND ${N} NOT LIKE '%hospedagem%' AND ${N} NOT LIKE '%bangalo%' AND (${N} LIKE '%opening%' OR ${N} LIKE '%openning%')`,
        ingressos_total_prev: `SELECT COALESCE(SUM(Qtd), 0) as total_ingressos FROM ${CM_UNION} WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free') AND NOT (${N} LIKE '%opening%' OR ${N} LIKE '%openning%')`,
        hospedagem_current: `SELECT COALESCE(SUM(Qtd), 0) as qtd_hospedagem FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%titular%' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        hospedagem_prev: `SELECT COALESCE(SUM(Qtd), 0) as qtd_hospedagem FROM ${CM_UNION} WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND (${N} LIKE '%pousada%' OR ${N} LIKE '%hospedagem%' OR ${N} LIKE '%bangalo%') AND ${N} NOT LIKE '%extra%' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        fat_hospedagem: `SELECT COALESCE(SUM(Valor_Final), 0) - COALESCE(SUM(Desconto), 0) as fat_hospedagem FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND (${N} LIKE '%pousada%' OR ${N} LIKE '%hospedagem%' OR ${N} LIKE '%bangalo%' OR ${N} LIKE '%extra%') AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        fat_hospedagem_prev: `SELECT COALESCE(SUM(Valor_Final), 0) - COALESCE(SUM(Desconto), 0) as fat_hospedagem FROM ${CM_UNION} WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND (${N} LIKE '%pousada%' OR ${N} LIKE '%hospedagem%' OR ${N} LIKE '%bangalo%' OR ${N} LIKE '%extra%') AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        aereo_current: `SELECT COALESCE(SUM(Qtd), 0) as qtd_aereo FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND (${N} LIKE '%aereo%') AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        aereo_prev: `SELECT COALESCE(SUM(Qtd), 0) as qtd_aereo FROM ${CM_UNION} WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND (${N} LIKE '%aereo%') AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        // Soma bruta das linhas que contem aereo (inclui a parte de passaporte dos combos).
        fat_bruto_linhas_com_aereo: `SELECT COALESCE(SUM(Valor_Final), 0) as fat_aereo FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND (${N} LIKE '%aereo%') AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        // Faturamento real do aereo: avulso pelo valor cheio da linha; combo pela parcela
        // aerea do lote/genero (preco do combo menos o preco do passaporte equivalente).
        // TODO: quando a cliente definir o preco do 4o lote, acrescentar `WHEN lote = 'L4' THEN <valor>`
        // no CASE abaixo — hoje o 4o lote cai no fallback de 2800.
        fat_aereo: `WITH base AS (SELECT ${N} AS n, Valor_Final - IFNULL(CAST(Desconto AS FLOAT64), 0) AS net FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')), aereo AS (SELECT net, (n LIKE '%combo%') AS eh_combo, CASE WHEN REGEXP_CONTAINS(n, r'pre[ -]?venda') THEN 'PV' WHEN REGEXP_CONTAINS(n, r'1\\s*[ºo°]?\\s*lote') THEN 'L1' WHEN REGEXP_CONTAINS(n, r'2\\s*[ºo°]?\\s*lote') THEN 'L2' WHEN REGEXP_CONTAINS(n, r'3\\s*[ºo°]?\\s*lote') THEN 'L3' WHEN REGEXP_CONTAINS(n, r'4\\s*[ºo°]?\\s*lote') THEN 'L4' ELSE 'ND' END AS lote, CASE WHEN n LIKE '%masc%' THEN 'M' WHEN n LIKE '%fem%' THEN 'F' ELSE 'ND' END AS genero FROM base WHERE n LIKE '%aereo%') SELECT COUNT(*) AS qtd_aereo, ROUND(SUM(CASE WHEN NOT eh_combo THEN net WHEN lote = 'PV' THEN 2900 WHEN lote = 'L1' THEN 2750 WHEN lote = 'L2' AND genero = 'F' THEN 2600 WHEN lote = 'L2' THEN 2700 WHEN lote = 'L3' THEN 3100 ELSE 2800 END), 2) AS fat_aereo FROM aereo`,
        cortesia_total: `SELECT COUNT(*) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE ${N} LIKE '%cortesia%'`,
        cortesia_fem: `SELECT COUNT(*) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE ${N} LIKE '%cortesia%' AND (Ingresso LIKE '%Feminino%' OR Ingresso LIKE '%Fem%')`,
        cortesia_masc: `SELECT COUNT(*) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE ${N} LIKE '%cortesia%' AND (Ingresso LIKE '%Masculino%' OR Ingresso LIKE '%Masc%')`,
        cortesia_passaporte: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE ${N} LIKE '%cortesia%' AND ${N} LIKE '%passaporte%'`,
        cortesia_brunch: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE ${N} LIKE '%cortesia%' AND ${N} LIKE '%brunch%'`,
        cortesia_spritz: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE ${N} LIKE '%cortesia%' AND ${N} LIKE '%sunset boat party spritz%'`,
        cortesia_escuna: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE ${N} LIKE '%cortesia%' AND ${N} LIKE '%sunset boat party azul%'`,
        cortesia_festas: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE ${N} LIKE '%cortesia%' AND ${N} NOT LIKE '%passaporte%' AND ${N} NOT LIKE '%brunch%' AND ${N} NOT LIKE '%sunset boat party spritz%' AND ${N} NOT LIKE '%sunset boat party azul%'`,
        cortesia_corrida: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Evento_ID = 104146 AND Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento IN ('cortesia','none','free')`,
      };

    case 'ga4':
      return {
        totals: `SELECT COALESCE(SUM(receita_total), 0) as receita, COALESCE(SUM(total_ingressos), 0) as transacoes, COALESCE(SUM(qtd_sessoes), 0) as sessoes FROM \`coral-moment.analytics_000000000.vw_relatorio\` WHERE data_sessao BETWEEN '${startDate}' AND '${endDate}'`,
        sessions_by_source: `SELECT
          CASE WHEN LOWER(COALESCE(page_path, '')) LIKE '%ingresse%' THEN 'Ingresse' ELSE 'LP' END as source,
          COALESCE(SUM(qtd_sessoes), 0) as sessoes,
          COALESCE(SUM(receita_total), 0) as receita,
          COALESCE(SUM(total_ingressos), 0) as transacoes
        FROM \`coral-moment.analytics_000000000.vw_relatorio\`
        WHERE data_sessao BETWEEN '${startDate}' AND '${endDate}'
        GROUP BY source ORDER BY sessoes DESC`,
        devices: `SELECT dispositivo as device_category, SUM(qtd_sessoes) as total FROM \`coral-moment.analytics_000000000.vw_relatorio\` WHERE data_sessao BETWEEN '${startDate}' AND '${endDate}' GROUP BY dispositivo ORDER BY total DESC LIMIT 10`,
        regions: `SELECT estado as region, SUM(qtd_sessoes) as sessoes, SUM(receita_total) as receita FROM \`coral-moment.analytics_000000000.vw_relatorio\` WHERE data_sessao BETWEEN '${startDate}' AND '${endDate}' GROUP BY estado ORDER BY sessoes DESC LIMIT 10`,
        os: `SELECT sistema_operacional as operating_system, SUM(qtd_sessoes) as total FROM \`coral-moment.analytics_000000000.vw_relatorio\` WHERE data_sessao BETWEEN '${startDate}' AND '${endDate}' GROUP BY sistema_operacional ORDER BY total DESC LIMIT 10`,
        campaigns: `SELECT origem_midia as campaign, SUM(receita_total) as revenue, SUM(total_ingressos) as transactions, SUM(qtd_sessoes) as sessions FROM \`coral-moment.analytics_000000000.vw_relatorio\` WHERE data_sessao BETWEEN '${startDate}' AND '${endDate}' GROUP BY origem_midia ORDER BY revenue DESC LIMIT 20`,
        region_perf: `SELECT estado as region, SUM(qtd_sessoes) as sessions, SUM(receita_total) as revenue, SUM(total_ingressos) as transacoes FROM \`coral-moment.analytics_000000000.vw_relatorio\` WHERE data_sessao BETWEEN '${startDate}' AND '${endDate}' GROUP BY estado ORDER BY revenue DESC LIMIT 15`,
      };

    case 'meta-ads': {
      const actionSum = (actionType: string, alias: string) =>
        `COALESCE(SUM((SELECT CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64) FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = '${actionType}' LIMIT 1)), 0) as ${alias}`;
      const actionValueSum = (actionType: string, alias: string) =>
        `COALESCE(SUM((SELECT CAST(JSON_EXTRACT_SCALAR(a, '$.28d_click') AS FLOAT64) FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = '${actionType}' LIMIT 1)), 0) as ${alias}`;

      return {
        totals: `SELECT
          COALESCE(SUM(impressions), 0) as impressions,
          COALESCE(SUM(clicks), 0) as clicks,
          COALESCE(SUM(reach), 0) as reach,
          COALESCE(SUM(CAST(spend AS FLOAT64)), 0) as spend,
          ${actionSum('purchase', 'purchases')},
          ${actionValueSum('purchase', 'purchase_value')},
          ${actionSum('onsite_conversion.messaging_conversation_started_7d', 'messages')},
          ${actionSum('add_to_cart', 'add_to_cart')},
          ${actionSum('landing_page_view', 'landing_page_views')}
        FROM \`coral-moment.facebook.ads_insights\`
        WHERE date_start BETWEEN '${startDate}' AND '${endDate}'`,

        campaigns: `SELECT
          campaign_name,
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 as ctr,
          ${actionSum('add_to_cart', 'add_to_cart')},
          ${actionSum('onsite_conversion.messaging_conversation_started_7d', 'messages')},
          ${actionSum('purchase', 'purchases')},
          SAFE_DIVIDE(
            SUM((SELECT CAST(JSON_EXTRACT_SCALAR(a, '$.28d_click') AS FLOAT64) FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'purchase' LIMIT 1)),
            NULLIF(SUM(CAST(spend AS FLOAT64)), 0)
          ) as roas,
          SUM(CAST(spend AS FLOAT64)) as spend
        FROM \`coral-moment.facebook.ads_insights\`
        WHERE date_start BETWEEN '${startDate}' AND '${endDate}'
        GROUP BY campaign_name ORDER BY spend DESC LIMIT 50`,

        adsets: `SELECT
          ad_name as adset_name,
          campaign_name,
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 as ctr,
          ${actionSum('add_to_cart', 'add_to_cart')},
          ${actionSum('onsite_conversion.messaging_conversation_started_7d', 'messages')},
          ${actionSum('purchase', 'purchases')},
          SAFE_DIVIDE(
            SUM((SELECT CAST(JSON_EXTRACT_SCALAR(a, '$.28d_click') AS FLOAT64) FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'purchase' LIMIT 1)),
            NULLIF(SUM(CAST(spend AS FLOAT64)), 0)
          ) as roas,
          SUM(CAST(spend AS FLOAT64)) as spend
        FROM \`coral-moment.facebook.ads_insights\`
        WHERE date_start BETWEEN '${startDate}' AND '${endDate}'
        GROUP BY ad_name, campaign_name ORDER BY spend DESC LIMIT 50`,

        demographics: `SELECT age, gender, SUM(impressions) as impressions, SUM(clicks) as clicks FROM \`coral-moment.facebook.ads_insights_age_and_gender\` WHERE date_start BETWEEN '${startDate}' AND '${endDate}' GROUP BY age, gender ORDER BY clicks DESC LIMIT 30`,

        devices: `SELECT device_platform as device, COUNT(*) as impressions FROM \`coral-moment.facebook.ads_insights_delivery_device\` WHERE date_start BETWEEN '${startDate}' AND '${endDate}' GROUP BY device_platform ORDER BY impressions DESC LIMIT 10`,

        creatives: `SELECT COALESCE(ad_name, creative_name) as creative_name, creative_image_url, SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(reach) as reach, SUM(CAST(spend AS FLOAT64)) as spend, SAFE_DIVIDE(SUM(CAST(spend AS FLOAT64)), SUM(clicks)) as cpc, SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 as ctr FROM \`coral-moment.facebook.v_ads_insights_com_imagem\` WHERE date_start BETWEEN '${startDate}' AND '${endDate}' GROUP BY creative_name, ad_name, creative_image_url ORDER BY impressions DESC LIMIT 20`,
      };
    }

    case 'google-ads':
      return {
        totals: `SELECT
          COALESCE(SUM(CAST(REPLACE(daily_cost, ',', '.') AS FLOAT64)), 0) as custo,
          COALESCE(SUM(total_impressions), 0) as impressions,
          COALESCE(SUM(total_clicks), 0) as clicks,
          SAFE_DIVIDE(SUM(CAST(REPLACE(daily_cost, ',', '.') AS FLOAT64)), NULLIF(SUM(total_clicks), 0)) as cpc,
          COALESCE((SELECT SUM(CAST(metrics_conversions AS FLOAT64)) FROM \`coral-moment.google_ads.ads_CampaignConversionStats_4148116144\` c WHERE c.segments_date BETWEEN '${startDate}' AND '${endDate}' AND CAST(c.campaign_id AS STRING) IN (SELECT DISTINCT CAST(campaign_id AS STRING) FROM \`coral-moment.google_ads.vw_campaign\` WHERE campaign_name LIKE '%STEP%')), 0) as conversions,
          COALESCE((SELECT SUM(CAST(metrics_conversions_value AS FLOAT64)) FROM \`coral-moment.google_ads.ads_CampaignConversionStats_4148116144\` c WHERE c.segments_date BETWEEN '${startDate}' AND '${endDate}' AND CAST(c.campaign_id AS STRING) IN (SELECT DISTINCT CAST(campaign_id AS STRING) FROM \`coral-moment.google_ads.vw_campaign\` WHERE campaign_name LIKE '%STEP%')), 0) as conversion_value
        FROM \`coral-moment.google_ads.vw_campaign\`
        WHERE campaign_date BETWEEN '${startDate}' AND '${endDate}' AND campaign_name LIKE '%STEP%'`,

        campaigns_list: `SELECT DISTINCT campaign_name FROM \`coral-moment.google_ads.vw_campaign\` WHERE campaign_date BETWEEN '${startDate}' AND '${endDate}' AND campaign_name LIKE '%STEP%' ORDER BY campaign_name LIMIT 50`,

        timeline: `SELECT FORMAT_DATE('%Y-%m-%d', campaign_date) as campaign_date, campaign_name, SUM(CAST(REPLACE(daily_cost, ',', '.') AS FLOAT64)) as cost, SAFE_DIVIDE(SUM(CAST(REPLACE(daily_cost, ',', '.') AS FLOAT64)), NULLIF(SUM(total_clicks), 0)) as cpc, SUM(total_impressions) as impressions, SUM(total_clicks) as clicks FROM \`coral-moment.google_ads.vw_campaign\` WHERE campaign_date BETWEEN '${startDate}' AND '${endDate}' AND campaign_name LIKE '%STEP%' GROUP BY campaign_date, campaign_name ORDER BY campaign_date LIMIT 500`,

        devices: `SELECT dispositivo as device, SUM(qtd_sessoes) as total FROM \`coral-moment.analytics_000000000.vw_relatorio\` WHERE data_sessao BETWEEN '${startDate}' AND '${endDate}' AND origem_midia = 'google / cpc' GROUP BY dispositivo ORDER BY total DESC LIMIT 10`,

        regions: `SELECT
          estado as region,
          COALESCE(SUM(qtd_sessoes), 0) as sessoes,
          COALESCE(SUM(total_ingressos), 0) as transacoes,
          SAFE_DIVIDE(SUM(total_ingressos), NULLIF(SUM(qtd_sessoes), 0)) * 100 as taxa_conv,
          COALESCE(SUM(receita_total), 0) as receita
        FROM \`coral-moment.analytics_000000000.vw_relatorio\`
        WHERE data_sessao BETWEEN '${startDate}' AND '${endDate}' AND origem_midia = 'google / cpc'
        GROUP BY estado ORDER BY sessoes DESC LIMIT 20`,

        os: `SELECT sistema_operacional as operating_system, SUM(qtd_sessoes) as total FROM \`coral-moment.analytics_000000000.vw_relatorio\` WHERE data_sessao BETWEEN '${startDate}' AND '${endDate}' AND origem_midia = 'google / cpc' GROUP BY sistema_operacional ORDER BY total DESC LIMIT 10`,

        keywords: `SELECT
          k.ad_group_criterion_keyword_text as keyword,
          SUM(s.metrics_impressions) as impressions,
          SUM(s.metrics_clicks) as clicks,
          SAFE_DIVIDE(SUM(s.metrics_clicks), NULLIF(SUM(s.metrics_impressions), 0)) * 100 as ctr,
          SUM(s.metrics_cost_micros) / 1000000.0 as custo,
          COALESCE(SUM(s.metrics_conversions), 0) as conversions,
          SAFE_DIVIDE(SUM(s.metrics_cost_micros) / 1000000.0, NULLIF(SUM(s.metrics_conversions), 0)) as cost_per_conversion
        FROM \`coral-moment.google_ads.ads_KeywordBasicStats_4148116144\` s
        JOIN \`coral-moment.google_ads.ads_Keyword_4148116144\` k
          ON s.ad_group_criterion_criterion_id = k.ad_group_criterion_criterion_id
          AND s.ad_group_id = k.ad_group_id
          AND s.campaign_id = k.campaign_id
        WHERE s.segments_date BETWEEN '${startDate}' AND '${endDate}'
        GROUP BY keyword ORDER BY custo DESC LIMIT 50`,

        age: `SELECT
          idade as age_range,
          COALESCE(SUM(total_ingressos), 0) as clicks,
          COALESCE(SUM(qtd_sessoes), 0) as sessions
        FROM \`coral-moment.analytics_000000000.vw_relatorio\`
        WHERE data_sessao BETWEEN '${startDate}' AND '${endDate}' AND origem_midia = 'google / cpc' AND idade IS NOT NULL AND idade != ''
        GROUP BY idade ORDER BY clicks DESC LIMIT 10`,
      };

    case 'investimento':
      return {
        meta_cost: `SELECT SUM(CAST(spend AS FLOAT64)) as total, EXTRACT(MONTH FROM date_start) as mes FROM \`coral-moment.facebook.ads_insights\` WHERE date_start BETWEEN '${startDate}' AND '${endDate}' GROUP BY mes ORDER BY mes`,
        google_cost: `SELECT SUM(CAST(REPLACE(daily_cost, ',', '.') AS FLOAT64)) as total, EXTRACT(MONTH FROM campaign_date) as mes FROM \`coral-moment.google_ads.vw_campaign\` WHERE campaign_date BETWEEN '${startDate}' AND '${endDate}' AND campaign_name LIKE '%STEP%' GROUP BY mes ORDER BY mes`,
        meta_cost_prev: `SELECT SUM(CAST(spend AS FLOAT64)) as total, EXTRACT(MONTH FROM date_start) as mes FROM \`coral-moment.facebook.ads_insights\` WHERE date_start BETWEEN '${prevStart}' AND '${prevEnd}' GROUP BY mes ORDER BY mes`,
        google_cost_prev: `SELECT SUM(CAST(REPLACE(daily_cost, ',', '.') AS FLOAT64)) as total, EXTRACT(MONTH FROM campaign_date) as mes FROM \`coral-moment.google_ads.vw_campaign\` WHERE campaign_date BETWEEN '${prevStart}' AND '${prevEnd}' AND campaign_name LIKE '%STEP%' GROUP BY mes ORDER BY mes`,
        meta_total: `SELECT COALESCE(SUM(CAST(spend AS FLOAT64)), 0) as total FROM \`coral-moment.facebook.ads_insights\` WHERE date_start BETWEEN '${startDate}' AND '${endDate}'`,
        google_total: `SELECT COALESCE(SUM(CAST(REPLACE(daily_cost, ',', '.') AS FLOAT64)), 0) as total FROM \`coral-moment.google_ads.vw_campaign\` WHERE campaign_date BETWEEN '${startDate}' AND '${endDate}' AND campaign_name LIKE '%STEP%'`,
        meta_total_prev: `SELECT COALESCE(SUM(CAST(spend AS FLOAT64)), 0) as total FROM \`coral-moment.facebook.ads_insights\` WHERE date_start BETWEEN '${prevStart}' AND '${prevEnd}'`,
        google_total_prev: `SELECT COALESCE(SUM(CAST(REPLACE(daily_cost, ',', '.') AS FLOAT64)), 0) as total FROM \`coral-moment.google_ads.vw_campaign\` WHERE campaign_date BETWEEN '${prevStart}' AND '${prevEnd}' AND campaign_name LIKE '%STEP%'`,
        google_last_date: `SELECT FORMAT_DATE('%Y-%m-%d', MAX(campaign_date)) AS last_date FROM \`coral-moment.google_ads.vw_campaign\` WHERE campaign_name LIKE '%STEP%'`,
        // Freshness das integracoes de midia. Sem isso, uma integracao pode parar de
        // trazer dado por meses e o card so parece "queda de verba".
        google_ads_ultimo_dado: `SELECT FORMAT_DATE('%d/%m/%Y', MAX(_DATA_DATE)) as ultima_data, DATE_DIFF(CURRENT_DATE(), MAX(_DATA_DATE), DAY) as dias FROM \`coral-moment.google_ads.ads_CampaignBasicStats_4148116144\``,
        meta_ultimo_dado: `SELECT FORMAT_DATE('%d/%m/%Y', MAX(date_start)) as ultima_data, DATE_DIFF(CURRENT_DATE(), MAX(date_start), DAY) as dias FROM \`coral-moment.facebook.ads_insights\``,
        
      };

    case 'consolidado-pr':
      return {
        totals: `SELECT COALESCE(SUM(CASE WHEN Meio_de_Pagamento IN ('credit_card', 'pix') THEN Valor_Final ELSE 0 END), 0) as faturamento, COALESCE(SUM(CASE WHEN Meio_de_Pagamento IN ('credit_card', 'pix') THEN Qtd ELSE 0 END), 0) as total_ingressos, COALESCE(SUM(CASE WHEN Meio_de_Pagamento = 'credit_card' THEN Valor_Final ELSE 0 END), 0) as fat_cc, COALESCE(SUM(CASE WHEN Meio_de_Pagamento = 'pix' THEN Valor_Final ELSE 0 END), 0) as fat_pix FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento IN ('credit_card', 'pix')`,
        totals_prev: `SELECT COALESCE(SUM(CASE WHEN Meio_de_Pagamento IN ('credit_card', 'pix') THEN Valor_Final ELSE 0 END), 0) as faturamento, COALESCE(SUM(CASE WHEN Meio_de_Pagamento IN ('credit_card', 'pix') THEN Qtd ELSE 0 END), 0) as total_ingressos FROM ${CM_UNION} WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND Meio_de_Pagamento IN ('credit_card', 'pix')`,
        detail: `SELECT FORMAT_DATE('%Y-%m-%d', Data) as data, Ingresso as ingresso, Qtd as qtd, Valor_Final as receita, Meio_de_Pagamento as pagamento FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' ORDER BY Data DESC`,
      };

    case 'auditoria':
      return {
        site_values: `SELECT COALESCE(SUM(CASE WHEN Meio_de_Pagamento = 'pix' THEN Valor_Final ELSE 0 END), 0) as pix, COALESCE(SUM(CASE WHEN Meio_de_Pagamento = 'credit_card' THEN Valor_Final ELSE 0 END), 0) as cc FROM ${CM_UNION}`,
        api_pix: `SELECT COALESCE(SUM(CAST(ticket_raw_value AS FLOAT64)), 0) as total FROM \`coral-moment.Auditoria.vw_auditoria_pix\` WHERE payment_type = 'money'`,
        api_cc: `SELECT COALESCE(SUM(CAST(ticket_raw_value AS FLOAT64)), 0) as total FROM \`coral-moment.Auditoria.vw_auditoria_credito\` WHERE payment_type = 'credit_card'`,
        deductions: `SELECT COALESCE(SUM(CAST(Desconto AS FLOAT64)), 0) as desconto FROM ${CM_UNION} WHERE CAST(Desconto AS FLOAT64) > 0`,
      };

    case 'metas-pv':
      return {
        ...metasLoteQueries('metas-pv'),
        // Recorte da janela 10/05–13/06/2025 (usado só na nota de rodapé do card de Pré Venda).
        pv25_janela: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM ${CM_UNION} WHERE Data BETWEEN '2025-05-10' AND '2025-06-13' AND Meio_de_Pagamento NOT IN ('cortesia','none','free') AND ${N} LIKE '%passaporte%'`,
        gender_fem_pv: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND REGEXP_CONTAINS(${N}, r'pre[ -]?venda') AND ${N} LIKE '%fem%' AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento IN ('credit_card','pix')`,
        gender_masc_pv: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND REGEXP_CONTAINS(${N}, r'pre[ -]?venda') AND ${N} LIKE '%masc%' AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento IN ('credit_card','pix')`,
        meta_conversas: `SELECT COALESCE(SUM((SELECT CAST(JSON_EXTRACT_SCALAR(a,'$.value') AS INT64) FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a WHERE JSON_EXTRACT_SCALAR(a,'$.action_type') = 'onsite_conversion.messaging_conversation_started_7d' LIMIT 1)), 0) as conversas, COALESCE(SUM(CAST(spend AS FLOAT64)), 0) as spend FROM \`coral-moment.facebook.ads_insights\` WHERE date_start BETWEEN '${startDate}' AND '${endDate}'`,
        // Custo marginal: so campanhas de WhatsApp. O total acima inclui campanhas de
        // conversao que nao geram conversa nenhuma; as duas leituras convivem.
        meta_conversas_wpp: `SELECT COALESCE(SUM((SELECT CAST(JSON_EXTRACT_SCALAR(a,'$.value') AS INT64) FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a WHERE JSON_EXTRACT_SCALAR(a,'$.action_type') = 'onsite_conversion.messaging_conversation_started_7d' LIMIT 1)), 0) as conversas, COALESCE(SUM(CAST(spend AS FLOAT64)), 0) as spend FROM \`coral-moment.facebook.ads_insights\` WHERE date_start BETWEEN '${startDate}' AND '${endDate}' AND (REGEXP_REPLACE(NORMALIZE(LOWER(campaign_name), NFD), r'\\pM','') LIKE '%wpp%' OR REGEXP_REPLACE(NORMALIZE(LOWER(campaign_name), NFD), r'\\pM','') LIKE '%whats%')`,
      };

    case 'metas-lote1':
    case 'metas-lote2':
    case 'metas-lote3':
    case 'metas-lote4':
      return metasLoteQueries(page);


    case 'passaporte-cm':
      return {
        count_cm26: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND (${N} LIKE '%passaporte%' OR ${N} LIKE '%combo%') AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento IN ('credit_card','pix','wallet','money','debit_card')`,
        count_cm25: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND (${N} LIKE '%passaporte%' OR ${N} LIKE '%combo%') AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento IN ('credit_card','pix','wallet','money','debit_card')`,
        count_all_cm26: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND (${N} LIKE '%passaporte%' OR ${N} LIKE '%combo%')`,
        count_by_payment_cm26: `SELECT CASE WHEN ${N} LIKE '%cortesia%' OR Meio_de_Pagamento IN ('cortesia','free','none') THEN 'cortesia' WHEN Meio_de_Pagamento = 'credit_card' THEN 'credit_card' WHEN Meio_de_Pagamento = 'pix' THEN 'pix' WHEN Meio_de_Pagamento = 'wallet' THEN 'wallet' WHEN Meio_de_Pagamento = 'money' THEN 'money' ELSE 'outro' END as tipo, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND (${N} LIKE '%passaporte%' OR ${N} LIKE '%combo%') GROUP BY tipo`,
        // Genero sai do NOME DO INGRESSO; a coluna Genero do banco nao entra (ver bloco genero-festa).
        gender_cm26: `SELECT CASE WHEN ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND (${N} LIKE '%passaporte%' OR ${N} LIKE '%combo%') GROUP BY genero`,
        fat_cm26: `SELECT COALESCE(SUM(CASE WHEN ${N} LIKE '%combo%' THEN Valor_Final/2 ELSE Valor_Final END), 0) as faturamento, COALESCE(SUM(CASE WHEN ${N} LIKE '%combo%' THEN CAST(Desconto AS FLOAT64)/2 ELSE CAST(Desconto AS FLOAT64) END), 0) as desconto FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND (${N} LIKE '%passaporte%' OR ${N} LIKE '%combo%') AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento IN ('credit_card','pix','wallet','money')`,
        fat_cm25: `SELECT COALESCE(SUM(Valor_Final), 0) as faturamento, COALESCE(SUM(CAST(Desconto AS FLOAT64)), 0) as desconto FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND (${N} LIKE '%passaporte%' OR ${N} LIKE '%combo%') AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento IN ('credit_card','pix','wallet','money')`,
        lote1_gender_cm26: `SELECT CASE WHEN ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%passaporte%' AND REGEXP_CONTAINS(${N}, r'1\\s*[ºo°]?\\s*lote') AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento IN ('credit_card','pix','wallet','money') GROUP BY genero`,
        lote1_gender_cm25: `SELECT CASE WHEN ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.f_vendas_CM26\` WHERE ano = 2025 AND ${N} LIKE '%passaporte%' AND REGEXP_CONTAINS(${N}, r'1\\s*[ºo°]?\\s*lote') AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento IN ('credit_card','pix','wallet','money') GROUP BY genero`,
        lote2_gender_cm26: `SELECT CASE WHEN ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%passaporte%' AND REGEXP_CONTAINS(${N}, r'2\\s*[ºo°]?\\s*lote') AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento IN ('credit_card','pix','wallet','money') GROUP BY genero`,
        lote2_gender_cm25: `SELECT CASE WHEN ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.f_vendas_CM26\` WHERE ano = 2025 AND ${N} LIKE '%passaporte%' AND REGEXP_CONTAINS(${N}, r'2\\s*[ºo°]?\\s*lote') AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento IN ('credit_card','pix','wallet','money') GROUP BY genero`,
      };

    case 'sunset-boat-sexta':
      return {
        count_current: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sexta%' AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        count_prev: `SELECT COUNT(DISTINCT Transacao_ID) as qtd FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sexta%' AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        count_all: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ((${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sexta%') OR (${N} LIKE '%cortesia%' AND ${N} LIKE '%sunset boat party azul%'))`,
        count_equipe: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sexta%' AND ${N} LIKE '%cortesia%'`,
        gender: `SELECT CASE WHEN ${N} LIKE '%masculino%' OR ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%feminino%' OR ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ((${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sexta%') OR (${N} LIKE '%cortesia%' AND ${N} LIKE '%sunset boat party azul%')) GROUP BY genero`,
        fat: `SELECT COALESCE(SUM(Valor_Final), 0) as faturamento, COALESCE(SUM(CAST(Desconto AS FLOAT64)), 0) as desconto FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sexta%' AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        prevenda_current: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sexta%' AND (${N} LIKE '%pre venda%' OR ${N} LIKE '%pre-venda%')`,
        prevenda_prev: `SELECT COUNT(DISTINCT Transacao_ID) as qtd FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sexta%' AND (${N} LIKE '%pre venda%' OR ${N} LIKE '%pre-venda%')`,
        prevenda_gender: `SELECT CASE WHEN ${N} LIKE '%masculino%' OR ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%feminino%' OR ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sexta%' AND (${N} LIKE '%pre venda%' OR ${N} LIKE '%pre-venda%') GROUP BY genero`,
        prevenda_gender_prev: `SELECT CASE WHEN ${N} LIKE '%masculino%' OR ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%feminino%' OR ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sol%' AND (${N} LIKE '%pre venda%' OR ${N} LIKE '%pre-venda%') GROUP BY genero`,
        lote1_current: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sexta%' AND ${N} LIKE '%1º lote%'`,
        lote1_prev: `SELECT COUNT(DISTINCT Transacao_ID) as qtd FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%stanley%' AND ${N} LIKE '%1º lote%'`,
        lote1_gender: `SELECT CASE WHEN ${N} LIKE '%masculino%' OR ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%feminino%' OR ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sexta%' AND ${N} LIKE '%1º lote%' GROUP BY genero`,
        lote1_gender_prev: `SELECT CASE WHEN ${N} LIKE '%masculino%' OR ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%feminino%' OR ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%stanley%' AND ${N} LIKE '%1º lote%' GROUP BY genero`,
      };

    case 'sunset-boat-sabado':
      return {
        count_current: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ((${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sabado%') OR (${N} LIKE '%cortesia%' AND ${N} LIKE '%sunset boat party spritz%'))`,
        count_meta: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sabado%' AND ${N} NOT LIKE '%cortesia%' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        count_prev: `SELECT COUNT(DISTINCT Transacao_ID) as qtd FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sabado%'`,
        count_all: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ((${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sabado%') OR (${N} LIKE '%cortesia%' AND ${N} LIKE '%sunset boat party spritz%'))`,
        count_equipe: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sabado%' AND ${N} LIKE '%cortesia%'`,
        gender: `SELECT CASE WHEN ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ((${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sabado%') OR (${N} LIKE '%cortesia%' AND ${N} LIKE '%sunset boat party spritz%')) GROUP BY genero`,
        fat: `SELECT COALESCE(SUM(Valor_Final), 0) as faturamento, COALESCE(SUM(CAST(Desconto AS FLOAT64)), 0) as desconto FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sabado%'`,
        prevenda_current: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sabado%' AND (${N} LIKE '%pre venda%' OR ${N} LIKE '%pre-venda%')`,
        prevenda_prev: `SELECT COUNT(DISTINCT Transacao_ID) as qtd FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sabado%' AND (${N} LIKE '%pre venda%' OR ${N} LIKE '%pre-venda%')`,
        prevenda_gender: `SELECT CASE WHEN ${N} LIKE '%masculino%' OR ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%feminino%' OR ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sabado%' AND (${N} LIKE '%pre venda%' OR ${N} LIKE '%pre-venda%') GROUP BY genero`,
        prevenda_gender_prev: `SELECT CASE WHEN ${N} LIKE '%masculino%' OR ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%feminino%' OR ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND Ingresso LIKE '%Sunset Boat Party Spritz - Sábado%' AND Ingresso LIKE '%Pré Venda%' GROUP BY genero`,
        lote1_current: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sabado%' AND ${N} LIKE '%1º lote%'`,
        lote1_prev: `SELECT COUNT(DISTINCT Transacao_ID) as qtd FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND Ingresso LIKE '%Sunset Boat Party Spritz - Sábado%' AND Ingresso LIKE '%1º Lote%'`,
        lote1_gender: `SELECT CASE WHEN ${N} LIKE '%masculino%' OR ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%feminino%' OR ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${N} LIKE '%sunset boat party%' AND ${N} LIKE '%sabado%' AND ${N} LIKE '%1º lote%' GROUP BY genero`,
        lote1_gender_prev: `SELECT CASE WHEN ${N} LIKE '%masculino%' OR ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%feminino%' OR ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND Ingresso LIKE '%Sunset Boat Party Spritz - Sábado%' AND Ingresso LIKE '%1º Lote%' GROUP BY genero`,
      };

    case 'brunch':
    case 'lumen':
    case 'brisa':
    case 'opening-party': {
      const keyword = page === 'brunch' ? 'brunch' : page === 'lumen' ? 'lumen' : page === 'brisa' ? 'brisa' : 'opening party';
      const kwClause = `${N} LIKE '%${keyword}%'`;
      // Lumen/Brisa are counted by ticket name only (the client's rule). The old
      // Evento_ID isolation split cross-sold tickets out of the card.
      const eventoClause = '';
      // O genero sai do NOME DO INGRESSO em todo o painel, sem excecao. A coluna Genero
      // do banco esta preenchida em so parte da base e diverge do ingresso comprado.
      return {
        count_ccpix: `SELECT COALESCE(SUM(Qtd), 0) as qtd, COALESCE(SUM(Valor_Final), 0) - COALESCE(SUM(CAST(Desconto AS FLOAT64)), 0) as faturamento FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${kwClause} ${eventoClause} AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        count_ccpix_prev: `SELECT COALESCE(SUM(Qtd), 0) as qtd, COALESCE(SUM(Valor_Final), 0) - COALESCE(SUM(CAST(Desconto AS FLOAT64)), 0) as faturamento FROM \`coral-moment.ingresse_api.CM25\` WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND ${kwClause} AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        count_total: `SELECT COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${kwClause} ${eventoClause}`,
        gender: `SELECT CASE WHEN ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END as genero, COALESCE(SUM(Qtd), 0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND ${kwClause} ${eventoClause} GROUP BY genero`,
      };
    }

    case 'corrida-endorfina':
      return {
        asfalto_paid: `SELECT COALESCE(SUM(Qtd),0) as qtd, COALESCE(SUM(Valor_Final),0) - COALESCE(SUM(CAST(Desconto AS FLOAT64)),0) as faturamento FROM \`coral-moment.ingresse_api.CM26\` WHERE Evento_ID = 104146 AND ${N} LIKE '%asfalto%' AND Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        asfalto_total: `SELECT COALESCE(SUM(Qtd),0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Evento_ID = 104146 AND ${N} LIKE '%asfalto%' AND Data BETWEEN '${startDate}' AND '${endDate}'`,
        trilha_paid: `SELECT COALESCE(SUM(Qtd),0) as qtd, COALESCE(SUM(Valor_Final),0) - COALESCE(SUM(CAST(Desconto AS FLOAT64)),0) as faturamento FROM \`coral-moment.ingresse_api.CM26\` WHERE Evento_ID = 104146 AND ${N} LIKE '%trilha%' AND Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free')`,
        trilha_total: `SELECT COALESCE(SUM(Qtd),0) as qtd FROM \`coral-moment.ingresse_api.CM26\` WHERE Evento_ID = 104146 AND ${N} LIKE '%trilha%' AND Data BETWEEN '${startDate}' AND '${endDate}'`,
        // Valor de face das cortesias (payment_type = 'free' com Valor_Final cheio).
        // NÃO é receita: nenhuma query de faturamento inclui 'free'.
        asfalto_cortesia_valor: `SELECT COALESCE(SUM(Qtd),0) as qtd, COALESCE(SUM(Valor_Final),0) as valor FROM \`coral-moment.ingresse_api.CM26\` WHERE Evento_ID = 104146 AND ${N} LIKE '%asfalto%' AND Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento IN ('cortesia','none','free')`,
        trilha_cortesia_valor: `SELECT COALESCE(SUM(Qtd),0) as qtd, COALESCE(SUM(Valor_Final),0) as valor FROM \`coral-moment.ingresse_api.CM26\` WHERE Evento_ID = 104146 AND ${N} LIKE '%trilha%' AND Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento IN ('cortesia','none','free')`,
      };

    case 'demografico':
      return {
        age_bars: `SELECT Faixa_Etaria as faixa, COALESCE(SUM(Qtd), 0) as qtd FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND LOWER(Meio_de_Pagamento) NOT IN ('none') AND Faixa_Etaria != 'Outras Idades' GROUP BY Faixa_Etaria ORDER BY qtd DESC`,
        age_pie: `SELECT Faixa_Etaria as faixa, COALESCE(SUM(Qtd), 0) as qtd FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND LOWER(Meio_de_Pagamento) NOT IN ('free','none','cortesia') AND Faixa_Etaria != 'Outras Idades' GROUP BY Faixa_Etaria ORDER BY qtd DESC`,
        // Combo nao e mais excluido inteiro: conta 1 ingresso e entra so com a parcela
        // do passaporte (net - parcela aerea do lote/genero). Aereo avulso segue fora.
        total_cc_pix: `WITH base AS (SELECT ${N} AS n, Ingresso, Qtd, Valor_Final - IFNULL(CAST(Desconto AS FLOAT64), 0) AS net FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free') AND LOWER(Ingresso) NOT LIKE '%único%'), classificado AS (SELECT *, CASE WHEN REGEXP_CONTAINS(n, r'pre[ -]?venda') THEN 'PV' WHEN REGEXP_CONTAINS(n, r'1\\s*[ºo°]?\\s*lote') THEN 'L1' WHEN REGEXP_CONTAINS(n, r'2\\s*[ºo°]?\\s*lote') THEN 'L2' WHEN REGEXP_CONTAINS(n, r'3\\s*[ºo°]?\\s*lote') THEN 'L3' WHEN REGEXP_CONTAINS(n, r'4\\s*[ºo°]?\\s*lote') THEN 'L4' ELSE 'ND' END AS lote, CASE WHEN n LIKE '%masc%' THEN 'M' WHEN n LIKE '%fem%' THEN 'F' ELSE 'ND' END AS genero FROM base) SELECT COALESCE(SUM(Qtd), 0) as qtd, ROUND(COALESCE(SUM(CASE WHEN n LIKE '%combo%' AND n LIKE '%aereo%' THEN net - (${PARCELA_AEREA}) ELSE net END), 0), 2) as faturamento FROM classificado WHERE n NOT LIKE '%pousada%' AND n NOT LIKE '%hospedagem%' AND n NOT LIKE '%bangalo%' AND NOT (n LIKE '%aereo%' AND n NOT LIKE '%combo%')`,
        total_cc_pix_prev: `SELECT COALESCE(SUM(Qtd), 0) as qtd, COALESCE(SUM(Valor_Final), 0) - COALESCE(SUM(CAST(Desconto AS FLOAT64)), 0) as faturamento FROM ${CM_UNION} WHERE Data BETWEEN '${prevStart}' AND '${prevEnd}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free') AND ${N} NOT LIKE '%pousada%' AND ${N} NOT LIKE '%hospedagem%' AND ${N} NOT LIKE '%bangalo%' AND ${N} NOT LIKE '%aereo%' AND LOWER(Ingresso) NOT LIKE '%único%' AND ${N} NOT LIKE '%opening%' AND ${N} NOT LIKE '%openning%'`,
        // Meio de pagamento efetivo, base cheia (sem filtro de faixa etária).
        // 'money' é contabilizado como Pix (episódio operacional na loja Pix, sem uso de dinheiro).
        // 'debit_card' tem fatia própria ("Débito"), não soma no crédito.
        payment_bars: `SELECT CASE WHEN LOWER(Meio_de_Pagamento) IN ('pix','money') THEN 'pix' ELSE LOWER(Meio_de_Pagamento) END as meio, COALESCE(SUM(Qtd), 0) as qtd FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND LOWER(Meio_de_Pagamento) IN ('credit_card','pix','wallet','money','debit_card') GROUP BY meio ORDER BY qtd DESC`,
        region: `SELECT Estado as estado, COALESCE(SUM(Qtd), 0) as qtd FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND LOWER(Meio_de_Pagamento) NOT IN ('none') AND Faixa_Etaria != 'Outras Idades' GROUP BY Estado ORDER BY qtd DESC LIMIT 15`,
      };

    case 'genero-festa': {
      // O genero vale pelo NOME DO INGRESSO, que e a faixa de preco comprada.
      // A coluna Genero do banco e quem esta cadastrado, esta preenchida em so ~62%
      // da base e diverge do ingresso em 58 casos (gente comprando o ingresso do outro).
      // Ela NAO entra aqui.
      const genderCase = `CASE WHEN ${N} LIKE '%masc%' THEN 'Masculino' WHEN ${N} LIKE '%fem%' THEN 'Feminino' ELSE 'Outro' END`;
      const base = `\`coral-moment.ingresse_api.CM26\``;
      const dateClause = `Data BETWEEN '${startDate}' AND '${endDate}'`;
      const passClause = `(${N} LIKE '%passaporte%' OR ${N} LIKE '%combo%')`;
      // A festa e vendida nas duas lojas, entao nao ha isolamento por Evento_ID.
      const lumenClause = `(${N} LIKE '%lumen%')`;
      const brisaClause = `(${N} LIKE '%brisa%')`;
      const openClause = `(${N} LIKE '%opening party%' OR ${N} LIKE '%openning%')`;
      return {
        gender_opening: `SELECT ${genderCase} as genero, COALESCE(SUM(Qtd), 0) as qtd FROM ${base} WHERE ${dateClause} AND (${openClause} OR ${passClause}) GROUP BY genero HAVING genero IN ('Masculino','Feminino') ORDER BY genero`,
        gender_lumen: `SELECT ${genderCase} as genero, COALESCE(SUM(Qtd), 0) as qtd FROM ${base} WHERE ${dateClause} AND (${lumenClause} OR ${passClause}) GROUP BY genero HAVING genero IN ('Masculino','Feminino') ORDER BY genero`,
        gender_brisa: `SELECT ${genderCase} as genero, COALESCE(SUM(Qtd), 0) as qtd FROM ${base} WHERE ${dateClause} AND (${brisaClause} OR ${passClause}) GROUP BY genero HAVING genero IN ('Masculino','Feminino') ORDER BY genero`,
        gender_opening_festa: `SELECT ${genderCase} as genero, COALESCE(SUM(Qtd), 0) as qtd FROM ${base} WHERE ${dateClause} AND (${openClause}) GROUP BY genero HAVING genero IN ('Masculino','Feminino') ORDER BY genero`,
        gender_lumen_festa: `SELECT ${genderCase} as genero, COALESCE(SUM(Qtd), 0) as qtd FROM ${base} WHERE ${dateClause} AND (${lumenClause}) GROUP BY genero HAVING genero IN ('Masculino','Feminino') ORDER BY genero`,
        gender_brisa_festa: `SELECT ${genderCase} as genero, COALESCE(SUM(Qtd), 0) as qtd FROM ${base} WHERE ${dateClause} AND (${brisaClause}) GROUP BY genero HAVING genero IN ('Masculino','Feminino') ORDER BY genero`,
        // Passaporte puro: as tres variantes antigas geravam SQL identico, viraram um campo so.
        gender_pass: `SELECT ${genderCase} as genero, COALESCE(SUM(Qtd), 0) as qtd FROM ${base} WHERE ${dateClause} AND (${passClause}) GROUP BY genero HAVING genero IN ('Masculino','Feminino') ORDER BY genero`,
      };

    }


    case 'parcelamentos':
      return {
        parcelas: `SELECT CAST(Parcelas AS STRING) as parcelas, COALESCE(SUM(Qtd), 0) as qtd FROM ${CM_UNION} WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento = 'credit_card' AND Faixa_Etaria != 'Outras Idades' GROUP BY Parcelas ORDER BY qtd DESC`,
      };

    // ─── Financeiro (Conta Azul) ───
    // Bloco 'evento' x 'estrutura' x 'financeiro' vem do centro de custo (cobertura 99,8%).
    // Nunca use a coluna `situacao` crua: o ERP repete o dicionário de receita nas despesas
    // (conta paga aparece como RECEBIDO). O rótulo sai de `status`, via vw_movimento.
    case 'financeiro-cm': {
      const MV = '`coral-moment.conta_azul.vw_movimento`';
      const edFilter = edicao ? ` AND edicao = ${sqlStr(edicao)}` : '';
      return {
        kpis: `SELECT * FROM \`coral-moment.conta_azul.vw_fin_kpis\``,
        por_edicao: `SELECT * FROM \`coral-moment.conta_azul.vw_fin_por_edicao\``,
        kpis_edicao: `SELECT
            ROUND(SUM(IF(tipo='receita', valor, 0)),2) AS receita,
            ROUND(SUM(IF(tipo='despesa', valor, 0)),2) AS despesa,
            ROUND(SUM(IF(tipo='receita', valor, 0)) - SUM(IF(tipo='despesa', valor, 0)),2) AS resultado,
            ROUND(SUM(IF(tipo='receita', valor_em_aberto, 0)),2) AS a_receber,
            ROUND(SUM(IF(tipo='despesa', valor_em_aberto, 0)),2) AS a_pagar
          FROM ${MV} WHERE bloco = 'evento'${edFilter}`,
        mensal: `SELECT mes, tipo, ROUND(SUM(valor),2) AS valor FROM \`coral-moment.conta_azul.vw_fin_mensal\` WHERE TRUE${edFilter} GROUP BY 1,2 ORDER BY 1`,
        categorias_despesa: `SELECT categoria_nome, valor, n FROM \`coral-moment.conta_azul.vw_fin_categorias\` WHERE tipo='despesa' AND bloco='evento'${edFilter} ORDER BY valor DESC LIMIT 10`,
        categorias_receita: `SELECT categoria_nome, valor, n FROM \`coral-moment.conta_azul.vw_fin_categorias\` WHERE tipo='receita' AND bloco='evento'${edFilter} ORDER BY valor DESC LIMIT 10`,
        movimentacao: `SELECT centro_custo_nome,
            ROUND(SUM(IF(tipo='receita', valor, 0)),2) AS entradas,
            ROUND(SUM(IF(tipo='despesa', valor, 0)),2) AS saidas,
            COUNT(*) AS n
          FROM ${MV} WHERE bloco = 'financeiro' GROUP BY 1 ORDER BY (SUM(valor)) DESC`,
        nao_classificado: `SELECT tipo, COUNT(*) AS n, ROUND(SUM(valor),2) AS valor FROM ${MV} WHERE bloco = 'nao_classificado' GROUP BY 1`,
        edicoes: `SELECT DISTINCT edicao FROM ${MV} WHERE edicao IS NOT NULL ORDER BY edicao DESC`,
        ultimo_sync: `SELECT FORMAT_TIMESTAMP('%d/%m/%Y %H:%M', MAX(_sincronizado_em), 'America/Sao_Paulo') AS quando, TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(_sincronizado_em), HOUR) AS horas FROM ${MV}`,
      };
    }


    case 'tiktok': {
      const gastoNum = `SAFE_CAST(REPLACE(REPLACE(REPLACE(gasto,'R$ ',''),'.',''),',','.') AS FLOAT64)`;
      const gastoNumB = `SAFE_CAST(REPLACE(REPLACE(REPLACE(b.gasto,'R$ ',''),'.',''),',','.') AS FLOAT64)`;
      return {
        totals: `SELECT
          COALESCE(SUM(${gastoNum}),0) AS gasto,
          COALESCE(SUM(impressoes),0) AS impressoes,
          COALESCE(SUM(cliques),0) AS cliques,
          COALESCE(SUM(conversoes),0) AS conversoes,
          COALESCE(SUM(resultados),0) AS resultados,
          SAFE_DIVIDE(SUM(cliques), SUM(impressoes)) * 100 AS ctr,
          SAFE_DIVIDE(SUM(${gastoNum}), NULLIF(SUM(cliques),0)) AS cpc,
          SAFE_DIVIDE(SUM(${gastoNum}), NULLIF(SUM(impressoes),0)) * 1000 AS cpm
        FROM \`coral-moment.tiktok.base_projecao\`
        WHERE data_inicio <= '${endDate}' AND data_fim >= '${startDate}'`,
        creatives: `SELECT
          b.criativo_id AS criativo_id,
          ANY_VALUE(c.string_field_2) AS descricao,
          ANY_VALUE(c.string_field_4) AS url_publica,
          SUM(${gastoNumB}) AS gasto,
          SUM(b.impressoes) AS impressoes,
          SUM(b.cliques) AS cliques,
          SUM(b.resultados) AS resultados,
          SAFE_DIVIDE(SUM(b.cliques), SUM(b.impressoes)) * 100 AS ctr,
          SAFE_DIVIDE(SUM(${gastoNumB}), NULLIF(SUM(b.cliques),0)) AS cpc
        FROM \`coral-moment.tiktok.base_projecao\` b
        LEFT JOIN \`coral-moment.tiktok.criativos\` c ON b.criativo_id = c.string_field_0
        WHERE b.data_inicio <= '${endDate}' AND b.data_fim >= '${startDate}'
        GROUP BY b.criativo_id
        ORDER BY impressoes DESC`,
        // NAO adicionar aqui uma query de "ultimo dado" da base_projecao: ela e tabela
        // externa apoiada no Google Drive e devolve "Access Denied: Permission denied
        // while getting Drive credentials". O aviso do TikTok e fixo no frontend.
      };
    }

    // Margem da parcela aerea. A view custos.vw_aereo_margem ja cruza a receita da
    // parcela aerea de cada ingresso com o custo do trecho e devolve a margem pronta.
    // O custo NAO vem do data lake: custos.aereo_trecho foi digitado a partir da
    // planilha "Passagens Azul_Coral Moment 2026", aba "Resumo Aéreo".
    case 'aereo-margem':
      return {
        // nao_classificado = linha sem trecho identificavel e receita abaixo do custo do
        // trecho mais barato (GIG). Dar custo medio a ela inventa prejuizo: fica fora do
        // calculo, mas continua no dado (contada em nao_classificados).
        margem_total: `SELECT COUNT(*) as passagens, ROUND(SUM(receita_aerea),2) as receita, ROUND(SUM(custo_aereo),2) as custo, ROUND(SUM(margem),2) as margem, ROUND(100*SAFE_DIVIDE(SUM(margem), SUM(receita_aerea)),1) as margem_pct FROM \`coral-moment.custos.vw_aereo_margem\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND NOT nao_classificado`,
        margem_por_trecho: `SELECT trecho, COUNT(*) as passagens, ROUND(SUM(receita_aerea),2) as receita, ROUND(SUM(custo_aereo),2) as custo, ROUND(SUM(margem),2) as margem, ROUND(AVG(margem),2) as margem_media FROM \`coral-moment.custos.vw_aereo_margem\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND NOT nao_classificado GROUP BY trecho ORDER BY margem DESC`,
        margem_trecho_lote: `SELECT trecho, lote, COUNT(*) as passagens, ROUND(AVG(margem),2) as margem_media FROM \`coral-moment.custos.vw_aereo_margem\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND eh_combo AND NOT nao_classificado GROUP BY trecho, lote ORDER BY trecho, lote`,
        nao_classificados: `SELECT COUNT(*) as qtd FROM \`coral-moment.custos.vw_aereo_margem\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND nao_classificado`,
      };

    // Concierge x venda direta. A classificacao e POR TRANSACAO, nunca por pessoa:
    // ha compradores que aparecem nas duas lojas.
    case 'concierge': {
      // Regra de concierge por loja, COM VIGENCIA. Em 2027 a operacao deve mudar.
      // Nao transformar isso em numero solto no meio de uma query.
      const CONCIERGE_POR_LOJA = [{ evento_id: 89312, ate: '2026-12-31' }];
      // A segunda fonte (telefone do comprador numa conversa de WhatsApp iniciada ate
      // 60 dias antes da compra) ainda nao existe — a lista de conversas nao chegou.
      // Ate la nada fora das lojas acima e classificado: fica 'a_apurar', nunca
      // "venda direta", que seria afirmar algo que nao foi medido.
      const lojasVigentes = CONCIERGE_POR_LOJA.filter((l) => l.ate >= startDate).map((l) => l.evento_id);
      const conciergeCase = lojasVigentes.length
        ? `CASE WHEN Evento_ID IN (${lojasVigentes.join(',')}) THEN 'concierge' ELSE 'a_apurar' END`
        : `'a_apurar'`;
      return {
        concierge: `SELECT ${conciergeCase} as classe, Evento_ID, COALESCE(SUM(Qtd),0) as ingressos, COUNT(DISTINCT Transacao_ID) as transacoes, COUNT(DISTINCT COALESCE(NULLIF(Telefone,''), NULLIF(Email,''), CAST(Transacao_ID AS STRING))) as compradores, ROUND(SUM(Valor_Final - IFNULL(CAST(Desconto AS FLOAT64),0)),2) as faturamento FROM \`coral-moment.ingresse_api.CM26\` WHERE Data BETWEEN '${startDate}' AND '${endDate}' AND Meio_de_Pagamento NOT IN ('cortesia','none','free') GROUP BY classe, Evento_ID ORDER BY Evento_ID`,
      };
    }

    default:
      return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKey && !DEMO) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");

    const serviceAccount = DEMO ? {} : JSON.parse(serviceAccountKey!);
    const { page, startDate, endDate, edicao } = await req.json();

    if (!page || !startDate || !endDate) {
      throw new Error("page, startDate, and endDate are required");
    }

    // ── Authorization gate: only the 'financeiro' role may read company finance data ──
    if (page === 'financeiro-cm') {
      const denied = () => new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : "";
      if (!token) return denied();

      const supaUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      // Validate the JWT belongs to a real signed-in user (anon key / api keys resolve to no user)
      const userResp = await fetch(`${supaUrl}/auth/v1/user`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      });
      if (!userResp.ok) return denied();
      const userJson = await userResp.json();
      const userId = userJson?.id;
      if (!userId) return denied();

      // Confirm the explicit 'financeiro' role (service role read, bypasses RLS)
      const roleResp = await fetch(
        `${supaUrl}/rest/v1/user_roles?select=role&user_id=eq.${userId}&role=eq.financeiro`,
        {
          headers: serviceKey.startsWith("sb_")
            ? { apikey: serviceKey, "Accept-Profile": Deno.env.get("CM_DB_SCHEMA") ?? "public" }
            : { apikey: serviceKey, "Accept-Profile": Deno.env.get("CM_DB_SCHEMA") ?? "public", Authorization: `Bearer ${serviceKey}` },
        },
      );
      if (!roleResp.ok) return denied();
      const roles = await roleResp.json();
      if (!Array.isArray(roles) || roles.length === 0) {
        console.warn(`[dashboard-data] financeiro-cm denied for user ${userId}`);
        return denied();
      }
    }


    // Check cache
    const cacheKey = `${page}:${startDate}:${endDate}:${edicao ?? ''}`;
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`[dashboard-data] Cache HIT for ${cacheKey}`);
      return new Response(JSON.stringify({ data: cached }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[dashboard-data] Cache MISS for ${cacheKey}`);

    const queries = buildQueries(page, startDate, endDate, edicao);
    if (Object.keys(queries).length === 0) {
      throw new Error(`Unknown page: ${page}`);
    }

    const accessToken = DEMO ? "" : await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id || "coral-moment";

    // Run all queries in parallel
    const entries = Object.entries(queries);
    const results = await Promise.allSettled(
      entries.map(([key, query]) => DEMO ? Promise.resolve(fakeQuery(query, key, startDate, endDate)) : runQuery(accessToken, projectId, query, key))
    );

    const data: Record<string, any> = {};
    entries.forEach(([key], i) => {
      const result = results[i];
      if (result.status === 'fulfilled') {
        data[key] = result.value;
      } else {
        console.error(`Query '${key}' failed:`, result.reason);
        data[key] = [];
      }
    });

    // Store in cache
    setCache(cacheKey, data);

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Dashboard data error:", error);
    return new Response(JSON.stringify({ data: null, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
