import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CA_BASE = "https://api-v2.contaazul.com";
const BQ_PROJECT = "coral-moment";
const BQ_DATASET = "conta_azul";

// ---------------------------------------------------------------------------
// Google / BigQuery auth (same service account as bigquery-query)
// ---------------------------------------------------------------------------
async function createGoogleJWT(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/bigquery",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const encode = (obj: any) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  const pemContents = serviceAccount.private_key
    .replace(/<CHAVE_PRIVADA_REMOVIDA>/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken),
  );
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${unsignedToken}.${signatureB64}`;
}

async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await createGoogleJWT(serviceAccount);
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Google token error: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function runBigQueryRows(accessToken: string, query: string): Promise<any[]> {
  const resp = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${BQ_PROJECT}/queries`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, useLegacySql: false, timeoutMs: 120000 }),
    },
  );
  const result = await resp.json();
  if (!resp.ok || result.error) {
    throw new Error(`BigQuery error: ${JSON.stringify(result.error || result)}`);
  }
  return result.rows ?? [];
}

async function runBigQuery(accessToken: string, query: string): Promise<void> {
  await runBigQueryRows(accessToken, query);
}


// ---------------------------------------------------------------------------
// SQL literal helpers
// ---------------------------------------------------------------------------
const sqlStr = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "NULL";
  return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, " ")}'`;
};
const sqlNum = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "NULL";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "NULL";
};
const sqlBool = (v: unknown): string => (v === null || v === undefined ? "NULL" : v ? "TRUE" : "FALSE");
const sqlDate = (v: unknown): string =>
  v ? `DATE('${String(v).slice(0, 10)}')` : "NULL";
const sqlTs = (v: unknown): string => {
  if (!v) return "NULL";
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? "NULL" : `TIMESTAMP('${d.toISOString()}')`;
};

// ---------------------------------------------------------------------------
// Refresh token storage (public.integracao_tokens, service role only)
// ---------------------------------------------------------------------------
const TOKEN_SERVICO = "conta_azul";

function supabaseRest(path: string, init: RequestInit = {}) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function readStoredRefreshToken(): Promise<string | null> {
  const resp = await supabaseRest(
    `integracao_tokens?servico=eq.${TOKEN_SERVICO}&select=refresh_token`,
  );
  if (!resp.ok) {
    console.error(`Could not read stored refresh token [${resp.status}]: ${await resp.text()}`);
    return null;
  }
  const rows = await resp.json();
  return rows?.[0]?.refresh_token ?? null;
}

async function storeRefreshToken(token: string): Promise<void> {
  const resp = await supabaseRest("integracao_tokens?on_conflict=servico", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      servico: TOKEN_SERVICO,
      refresh_token: token,
      atualizado_em: new Date().toISOString(),
    }),
  });
  if (!resp.ok) {
    // Persisting is critical: without it the next scheduled run fails.
    throw new Error(`Failed to persist refresh token [${resp.status}]: ${await resp.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Registro de execução (public.sync_execucoes, RLS sem policy — service role).
// Sem isso, uma falha da carga (principalmente em ?bg=1) some num console.error.
// ---------------------------------------------------------------------------
async function logInicio(): Promise<number | null> {
  try {
    const resp = await supabaseRest("sync_execucoes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ servico: TOKEN_SERVICO, status: "em_andamento" }),
    });
    if (!resp.ok) {
      console.error(`log inicio falhou [${resp.status}]: ${await resp.text()}`);
      return null;
    }
    const rows = await resp.json();
    return rows?.[0]?.id ?? null;
  } catch (e) {
    console.error("log inicio falhou:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function logFim(
  id: number | null,
  status: "ok" | "erro",
  extra: { linhas?: unknown; erro?: string },
): Promise<void> {
  if (id === null) return;
  try {
    const resp = await supabaseRest(`sync_execucoes?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        terminado_em: new Date().toISOString(),
        linhas: extra.linhas ?? null,
        erro: extra.erro ?? null,
      }),
    });
    if (!resp.ok) console.error(`log fim falhou [${resp.status}]: ${await resp.text()}`);
  } catch (e) {
    console.error("log fim falhou:", e instanceof Error ? e.message : String(e));
  }
}

class RefreshTokenLost extends Error {}


// ---------------------------------------------------------------------------
// Conta Azul
// ---------------------------------------------------------------------------
async function refreshContaAzulToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const resp = await fetch(`${CA_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const body = await resp.text();
  if (!resp.ok) {
    if (resp.status === 400 && body.includes("invalid_grant")) {
      throw new RefreshTokenLost(
        "O refresh token da Conta Azul foi perdido ou já foi usado (invalid_grant). " +
          "É necessário refazer a autorização manual (novo authorization code) e gravar o " +
          "refresh token resultante em public.integracao_tokens (servico = 'conta_azul').",
      );
    }
    throw new Error(`Conta Azul token error [${resp.status}]: ${body}`);
  }
  const data = JSON.parse(body);
  // Conta Azul rotates the refresh token on every use and invalidates the
  // previous one immediately — persist BEFORE doing any other API work.
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await storeRefreshToken(data.refresh_token);
    console.log("Refresh token rotated and persisted.");
  }
  if (!data.access_token) throw new Error(`Conta Azul token response without access_token: ${body}`);
  return data.access_token as string;
}


async function caGet(accessToken: string, path: string, params: Record<string, string>) {
  const url = `${CA_BASE}${path}?${new URLSearchParams(params)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Conta Azul GET ${path} failed [${resp.status}]: ${text}`);
  return JSON.parse(text);
}

// Financeiro endpoints: pagina / tamanho_pagina, total em itens_totais.
// A primeira página revela itens_totais; as demais são buscadas em paralelo
// (lotes de 6) para caber no tempo de execução da function em janelas largas.
async function fetchFinanceiro(
  accessToken: string,
  path: string,
  de: string,
  ate: string,
): Promise<any[]> {
  const size = 200;
  const get = (page: number) =>
    caGet(accessToken, path, {
      data_vencimento_de: de,
      data_vencimento_ate: ate,
      pagina: String(page),
      tamanho_pagina: String(size),
    });

  const first = await get(1);
  const total = Number(first.itens_totais ?? 0);
  const items: any[] = [...(first.itens ?? [])];
  const lastPage = Math.min(Math.ceil(total / size), 1000);

  for (let page = 2; page <= lastPage; page += 6) {
    const pages = [];
    for (let p = page; p < page + 6 && p <= lastPage; p++) pages.push(get(p));
    const results = await Promise.all(pages);
    for (const r of results) items.push(...(r.itens ?? []));
  }
  return items;
}


// /v1/pessoas: pagina / tamanho_pagina (page/size are ignored and always
// return the first page), envelope is totalItems / items.
async function fetchPessoas(accessToken: string): Promise<any[]> {
  const size = 100;
  const items: any[] = [];
  const seen = new Set<string>();
  let page = 1;
  let total = Infinity;
  while (items.length < total && page <= 200) {
    const data = await caGet(accessToken, "/v1/pessoas", {
      pagina: String(page),
      tamanho_pagina: String(size),
    });
    total = Number(data.totalItems ?? 0);
    const batch: any[] = data.items ?? [];
    const fresh = batch.filter((it) => it?.id && !seen.has(it.id));
    fresh.forEach((it) => seen.add(it.id));
    items.push(...fresh);
    if (fresh.length === 0) break;
    page++;
  }
  return items;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------
function mapEventoFinanceiro(it: any): string {
  const cat = Array.isArray(it.categorias) ? it.categorias[0] : null;
  const cc = Array.isArray(it.centros_de_custo) ? it.centros_de_custo[0] : null;
  // Contas a pagar may carry the counterpart under a different key — read with fallback.
  const pessoa = it.cliente ?? it.fornecedor ?? it.pessoa ?? null;
  return [
    sqlStr(it.id),
    sqlStr(it.descricao),
    sqlNum(it.total),
    sqlNum(it.pago),
    sqlNum(it.nao_pago),
    sqlStr(it.status),
    sqlStr(it.status_traduzido),
    sqlDate(it.data_vencimento),
    sqlDate(it.data_competencia),
    sqlTs(it.data_criacao),
    sqlTs(it.data_alteracao),
    sqlStr(cat?.id),
    sqlStr(cat?.nome),
    sqlStr(cc?.nome),
    sqlStr(pessoa?.id),
    sqlStr(pessoa?.nome),
    "CURRENT_TIMESTAMP()",
  ].join(",");
}

// /v1/pessoas responds in Portuguese snake_case — no camelCase fallbacks.
function mapPessoa(it: any): string {
  const perfis = Array.isArray(it.perfis)
    ? it.perfis.map((p: any) => (typeof p === "string" ? p : p?.nome)).filter(Boolean).join(",")
    : null;
  return [
    sqlStr(it.id),
    sqlStr(it.nome),
    sqlStr(it.documento),
    sqlStr(it.email),
    sqlStr(it.telefone),
    sqlBool(it.ativo ?? null),
    sqlStr(it.tipo_pessoa),
    sqlStr(perfis),
    sqlTs(it.data_criacao),
    sqlTs(it.data_alteracao),
    "CURRENT_TIMESTAMP()",
  ].join(",");
}

const RECEIVABLE_COLS =
  "id,descricao,valor,valor_pago,valor_em_aberto,status,situacao,data_vencimento,data_competencia,data_criacao,data_alteracao,categoria_id,categoria_nome,centro_custo_nome,pessoa_id,pessoa_nome,_sincronizado_em";
const CUSTOMER_COLS =
  "id,nome,documento,email,telefone,ativo,tipo_pessoa,perfis,data_criacao,data_alteracao,_sincronizado_em";

// Recarga integral via STAGING + SWAP atômico. Nunca DROP.
//
// O BigQuery limita o texto de uma query (script incluído) a 1 MB, e 7.5k
// payables não cabem num script só — os INSERT precisam ser fatiados em vários
// scripts independentes. Por isso a carga NÃO acontece na tabela real: ela é
// feita na gêmea `<tabela>_stg` e só depois é trocada. Se um pedaço falhar no
// meio, a tabela real continua intacta com o dado da carga anterior.
//
// Fluxo: DELETE stg -> INSERT em pedaços na stg -> guarda de sanidade
// (staging < 50% da real e real não vazia => aborta sem trocar) -> swap dentro
// de uma única transação, que é um script pequeno e cabe com folga no limite.
const MAX_SCRIPT_CHARS = 800_000;
const GUARDA_MIN_RAZAO = 0.5;

async function ensureStaging(accessToken: string, table: string) {
  // Sem particionamento e sem expiração, igual às tabelas reais.
  await runBigQuery(
    accessToken,
    `CREATE TABLE IF NOT EXISTS \`${BQ_PROJECT}.${BQ_DATASET}.${table}_stg\` LIKE \`${BQ_PROJECT}.${BQ_DATASET}.${table}\``,
  );
}

async function countRows(accessToken: string, table: string): Promise<number> {
  const rows = await runBigQueryRows(
    accessToken,
    `SELECT COUNT(*) AS n FROM \`${BQ_PROJECT}.${BQ_DATASET}.${table}\``,
  );
  return Number(rows?.[0]?.f?.[0]?.v ?? 0);
}

async function reloadTable(
  accessToken: string,
  table: string,
  cols: string,
  rows: string[],
) {
  const stg = `\`${BQ_PROJECT}.${BQ_DATASET}.${table}_stg\``;
  const real = `\`${BQ_PROJECT}.${BQ_DATASET}.${table}\``;

  await ensureStaging(accessToken, table);

  const stmts = [`DELETE FROM ${stg} WHERE TRUE;`];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200).map((r) => `(${r})`).join(",");
    stmts.push(`INSERT INTO ${stg} (${cols}) VALUES ${chunk};`);
  }

  let batch: string[] = [];
  let size = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    await runBigQuery(accessToken, batch.join("\n"));
    batch = [];
    size = 0;
  };
  for (const stmt of stmts) {
    if (size + stmt.length > MAX_SCRIPT_CHARS) await flush();
    batch.push(stmt);
    size += stmt.length + 1;
  }
  await flush();

  // Guarda de sanidade: uma leitura parcial da API não pode apagar dado bom.
  const [nStg, nReal] = [
    await countRows(accessToken, `${table}_stg`),
    await countRows(accessToken, table),
  ];
  if (nReal > 0 && nStg < nReal * GUARDA_MIN_RAZAO) {
    throw new Error(
      `carga suspeita: staging tem ${nStg} linhas contra ${nReal} na tabela atual, troca abortada (${table})`,
    );
  }

  await runBigQuery(
    accessToken,
    `BEGIN TRANSACTION;\nDELETE FROM ${real} WHERE TRUE;\nINSERT INTO ${real} SELECT * FROM ${stg};\nCOMMIT TRANSACTION;`,
  );
  console.log(`swap ok ${table}: ${nStg} linhas (antes ${nReal})`);
}


// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const started = Date.now();
  // Toda execução deixa rastro em public.sync_execucoes, inclusive a que falha
  // em background — antes disso a falha morria num console.error.
  let execId: number | null = null;
  try {
    execId = await logInicio();
    const clientId = Deno.env.get("CONTA_AZUL_CLIENT_ID");
    const clientSecret = Deno.env.get("CONTA_AZUL_CLIENT_SECRET");
    const missing = [
      !clientId && "CONTA_AZUL_CLIENT_ID",
      !clientSecret && "CONTA_AZUL_CLIENT_SECRET",
    ].filter(Boolean);
    if (missing.length > 0) {
      const erro = `Missing environment variable(s): ${missing.join(", ")}`;
      await logFim(execId, "erro", { erro });
      return new Response(
        JSON.stringify({ error: erro, missing }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Stored token wins; the env var is only the bootstrap for the first run.
    const stored = await readStoredRefreshToken();
    const refreshToken = stored ?? Deno.env.get("CONTA_AZUL_REFRESH_TOKEN");
    if (!refreshToken) {
      const erro =
        "Nenhum refresh token disponível: public.integracao_tokens está vazia e CONTA_AZUL_REFRESH_TOKEN não está definido.";
      await logFim(execId, "erro", { erro });
      return new Response(
        JSON.stringify({ error: erro }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKey) {
      const erro = "Missing environment variable(s): GOOGLE_SERVICE_ACCOUNT_KEY";
      await logFim(execId, "erro", { erro });
      return new Response(
        JSON.stringify({ error: erro, missing: ["GOOGLE_SERVICE_ACCOUNT_KEY"] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const serviceAccount = JSON.parse(serviceAccountKey);


    // Janela de vencimento (exigida pela API). Padrão largo para não truncar
    // histórico silenciosamente: 6 anos para trás e 3 para frente.
    // Configurável por CONTA_AZUL_SYNC_ANOS_ATRAS / CONTA_AZUL_SYNC_ANOS_FRENTE.
    const url = new URL(req.url);
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const anosAtras = Number(Deno.env.get("CONTA_AZUL_SYNC_ANOS_ATRAS") ?? "6") || 6;
    const anosFrente = Number(Deno.env.get("CONTA_AZUL_SYNC_ANOS_FRENTE") ?? "3") || 3;
    const de = url.searchParams.get("de") ??
      iso(new Date(Date.UTC(today.getUTCFullYear() - anosAtras, today.getUTCMonth(), today.getUTCDate())));
    const ate = url.searchParams.get("ate") ??
      iso(new Date(Date.UTC(today.getUTCFullYear() + anosFrente, today.getUTCMonth(), today.getUTCDate())));

    const bg = url.searchParams.get("bg") === "1";

    const runSync = async () => {
      const caToken = await refreshContaAzulToken(clientId!, clientSecret!, refreshToken!);

      const [receivables, payables, pessoas] = [
        await fetchFinanceiro(caToken, "/v1/financeiro/eventos-financeiros/contas-a-receber/buscar", de, ate),
        await fetchFinanceiro(caToken, "/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar", de, ate),
        await fetchPessoas(caToken),
      ];

      const bqToken = await getGoogleAccessToken(serviceAccount);
      await reloadTable(bqToken, "receivables", RECEIVABLE_COLS, receivables.map(mapEventoFinanceiro));
      await reloadTable(bqToken, "payables", RECEIVABLE_COLS, payables.map(mapEventoFinanceiro));
      await reloadTable(bqToken, "customers", CUSTOMER_COLS, pessoas.map(mapPessoa));

      console.log(
        `sync ok janela=${de}..${ate} receivables=${receivables.length} payables=${payables.length} customers=${pessoas.length} em ${Date.now() - started}ms`,
      );
      const linhas = { receivables: receivables.length, payables: payables.length, customers: pessoas.length };
      await logFim(execId, "ok", { linhas });
      return linhas;
    };

    if (bg) {
      // @ts-ignore EdgeRuntime é global no runtime do Supabase
      EdgeRuntime.waitUntil(
        runSync().catch(async (e) => {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("sync bg falhou:", msg);
          await logFim(execId, "erro", { erro: msg });
        }),
      );
      return new Response(
        JSON.stringify({ ok: true, modo: "background", janela: { de, ate } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const linhas = await runSync();

    return new Response(
      JSON.stringify({
        ok: true,
        janela: { de, ate },
        linhas,
        duracao_ms: Date.now() - started,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("conta-azul-sync failed:", message);
    await logFim(execId, "erro", { erro: message });

    if (error instanceof RefreshTokenLost) {
      return new Response(
        JSON.stringify({
          ok: false,
          erro: "refresh_token_perdido",
          acao_necessaria: "reautorizacao_manual",
          error: message,
          duracao_ms: Date.now() - started,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ ok: false, error: message, duracao_ms: Date.now() - started }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
