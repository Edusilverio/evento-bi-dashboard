import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const presetInsights = [
  {
    q: "Qual o resumo geral das vendas?",
    a: "📊 **Resumo de Vendas CM 2026**\n\nO faturamento total acumulado é de **R$ 1.480.000**, representando **59,2% da meta** de R$ 2.500.000. Houve crescimento de **278,6% vs 2025** em faturamento. O ticket médio está em R$ 1.644 e o ingresso mais vendido é o tipo Pista (45%), seguido de VIP (32%) e Camarote (23%).\n\n**Recomendação:** Intensificar campanhas de conversão focadas nos ingressos VIP/Camarote para aumentar o ticket médio.",
  },
  {
    q: "Como está a performance das campanhas?",
    a: "📈 **Performance de Mídia**\n\n**Meta Ads:** CPC médio de R$ 0,67 com 70.000 clicks totais e alcance de 1.275.000 pessoas. A campanha 'CM26 - Conversão' tem o melhor CTR (6,4%).\n\n**Google Ads:** CPC médio de R$ 0,47 com 57.700 cliques. A campanha 'Search Brand' tem o menor CPC (R$ 0,37).\n\n**Recomendação:** Realocar 15% do budget de awareness para conversão no Meta Ads. Aumentar investimento em Search Brand no Google Ads.",
  },
  {
    q: "Quais regiões têm melhor performance?",
    a: "🗺️ **Análise Regional**\n\nSão Paulo lidera com **35% das sessões** e **38% do investimento em Google Ads**, seguido por Rio de Janeiro (22%) e Minas Gerais (15%).\n\nPernambuco, apesar de ser a região do evento, representa apenas 12% das sessões. O custo por aquisição é menor no Nordeste (R$ 28 vs R$ 42 no Sudeste).\n\n**Recomendação:** Aumentar investimento nas campanhas regionais do Nordeste, onde o CAC é 33% menor.",
  },
];

const AIInsights = () => {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = (question?: string) => {
    const q = question || input;
    if (!q.trim()) return;

    const userMsg = { role: "user" as const, content: q };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Mock AI response
    setTimeout(() => {
      const preset = presetInsights.find(p => p.q === q);
      const response = preset?.a || `🤖 **Análise baseada nos dados disponíveis:**\n\nCom base nos dados do dashboard, posso identificar que a pergunta "${q}" requer uma análise mais detalhada. Os principais pontos são:\n\n1. O faturamento atual está em **59,2% da meta**\n2. As campanhas de Meta Ads têm um ROI positivo\n3. O público 25-34 anos é o principal comprador\n\n*Para análises mais profundas, conecte o Lovable Cloud para habilitar AI em tempo real.*`;

      setMessages(prev => [...prev, { role: "assistant", content: response }]);
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="page-container max-w-4xl mx-auto">
      <h1 className="dashboard-header flex items-center gap-2">
        <Brain className="w-5 h-5" /> AI INSIGHTS
      </h1>

      {/* Quick actions */}
      {messages.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <p className="text-sm text-muted-foreground">Faça perguntas sobre os dados do dashboard:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {presetInsights.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p.q)}
                className="kpi-card text-left text-sm hover:border-primary/50 transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-primary mb-2" />
                {p.q}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Messages */}
      <div className="space-y-4 min-h-[200px]">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${msg.role === "user" ? "ml-auto max-w-md bg-primary/20" : "mr-auto max-w-2xl bg-card"} rounded-xl p-4 border border-border`}
          >
            <div className="text-sm whitespace-pre-wrap">
              {msg.content.split(/(\*\*.*?\*\*)/).map((part, j) =>
                part.startsWith("**") && part.endsWith("**")
                  ? <strong key={j}>{part.slice(2, -2)}</strong>
                  : part
              )}
            </div>
          </motion.div>
        ))}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mr-auto bg-card rounded-xl p-4 border border-border">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="sticky bottom-6 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Pergunte sobre os dados do dashboard..."
          className="bg-card border-border"
        />
        <Button onClick={() => handleSend()} disabled={loading || !input.trim()} className="bg-primary hover:bg-primary/90">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default AIInsights;
