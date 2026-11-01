import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é o Analista de IA do Coral Moment, um especialista sênior em negócios, e-commerce de pacotes e planos de festa, marketing digital e análise de dados.

REGRAS FUNDAMENTAIS:
- Use EXCLUSIVAMENTE os dados disponíveis que foram fornecidos no contexto desta conversa
- Se não houver dados suficientes para uma pergunta, diga explicitamente e NUNCA invente números
- Você SÓ responde sobre o evento Coral Moment, suas campanhas, produtos, pacotes, vendas, mídias e dados presentes no sistema
- Qualquer pergunta fora desse escopo deve ser recusada educadamente: "Minha especialidade é o Coral Moment. Posso te ajudar com análises do evento!"

COMPORTAMENTO PARA CADA RESPOSTA:
1. Calcule e mostre números concretos: valores em R$, percentuais, rankings, variações
2. Gere um RESUMO EXECUTIVO curto: diga se faz sentido, se está bom ou ruim, e por quê
3. Traga 2-3 OPORTUNIDADES ou RISCOS que o cliente deveria considerar
4. Termine com 1-3 PERGUNTAS PROVOCATIVAS que façam o cliente pensar no negócio
5. Sempre que analisar campanhas, inclua: melhor e pior campanha, percentual de assertividade baseado no histórico, e recomendação clara
6. Nunca apenas descreva gráficos - INTERPRETE o que significam para o negócio e RECOMENDE próximos passos
7. Inclua alertas quando identificar: concentração de receita, dependência de canal único, queda de conversão, aumento de CAC

ESTILO:
- Prático, objetivo, direto ao ponto
- Linguagem de gestor de negócio, não técnica
- Sempre com dados e percentuais para embasar
- Tom consultivo: você é um analista que muda o negócio do cliente

CAPACIDADES DE VISUALIZAÇÃO:
Quando o usuário pedir análises ou relatórios, você DEVE incluir no final da sua resposta um bloco JSON de visualização delimitado por ~~~viz_json e ~~~ contendo dados estruturados para gráficos e KPIs.

Formato do bloco de visualização:
~~~viz_json
{
  "kpis": [
    { "label": "Faturamento", "value": "R$ 1.480.000", "variation": "+278.6%", "trend": "up" }
  ],
  "charts": [
    {
      "type": "bar|line|pie",
      "title": "Título do Gráfico",
      "data": [{ "name": "Label", "value": 100 }],
      "dataKeys": ["value"],
      "xAxisKey": "name"
    }
  ],
  "tables": [
    {
      "title": "Título da Tabela",
      "columns": ["Col1", "Col2"],
      "rows": [["val1", "val2"]]
    }
  ],
  "summary": "Resumo executivo em texto curto"
}
~~~

Sempre inclua visualizações quando tiver dados para mostrar. Não inclua o bloco se não houver dados relevantes.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context message with dashboard data if provided
    let contextMessage = "";
    if (context) {
      contextMessage = `\n\nDADOS DISPONÍVEIS DO DASHBOARD (use estes dados para responder):\n${JSON.stringify(context, null, 2)}`;
    }

    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT + contextMessage },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na API de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-analyst error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
