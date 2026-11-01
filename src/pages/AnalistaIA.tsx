import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Send, Sparkles, FileText, Download, BarChart3,
  TrendingUp, TrendingDown, Minus, ArrowRightLeft, Table2, FileDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type Msg = { role: "user" | "assistant"; content: string };

interface VizData {
  kpis?: { label: string; value: string; variation?: string; trend?: "up" | "down" | "neutral" }[];
  charts?: { type: "bar" | "line" | "pie"; title: string; data: any[]; dataKeys?: string[]; xAxisKey?: string }[];
  tables?: { title: string; columns: string[]; rows: string[][] }[];
  summary?: string;
}

const CHART_COLORS = [
  "hsl(180, 73%, 18%)", "hsl(180, 60%, 28%)", "hsl(38, 92%, 50%)",
  "hsl(145, 60%, 40%)", "hsl(0, 72%, 50%)", "hsl(215, 14%, 45%)",
  "hsl(280, 60%, 50%)", "hsl(200, 70%, 45%)",
];

const SUGGESTED_QUESTIONS = [
  "Qual campanha teve melhor ROAS este mês?",
  "Compare as vendas CC vs Pix e me diga qual canal priorizar",
  "Qual o risco de não bater a meta de R$2.5M?",
  "Me gere um relatório completo do período atual",
  "Quais produtos estão vendendo menos e por quê?",
  "Qual a melhor estratégia para as próximas 4 semanas?",
  "Compare este ano vs ano anterior e me diga o que mudou",
  "Qual o percentual de assertividade das campanhas de Meta vs Google?",
];

function parseVizFromContent(content: string): { text: string; viz: VizData | null } {
  const vizMatch = content.match(/~~~viz_json\s*([\s\S]*?)\s*~~~/);
  if (!vizMatch) return { text: content, viz: null };
  try {
    const viz = JSON.parse(vizMatch[1]);
    const text = content.replace(/~~~viz_json[\s\S]*?~~~/g, "").trim();
    return { text, viz };
  } catch {
    return { text: content, viz: null };
  }
}

function exportTableCSV(title: string, columns: string[], rows: string[][]) {
  const csv = [columns.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

import React from "react";

const VizPanel = React.forwardRef<HTMLDivElement, { viz: VizData | null }>(({ viz }, ref) => {
  if (!viz) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <BarChart3 className="w-16 h-16 opacity-20" />
        <p className="text-sm text-center max-w-xs">
          Faça uma pergunta ao Analista e os gráficos, KPIs e tabelas aparecerão aqui automaticamente.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div ref={ref} className="space-y-4 p-4">
        {/* Summary */}
        {viz.summary && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Resumo Executivo
              </p>
              <p className="text-sm text-muted-foreground mt-1">{viz.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        {viz.kpis && viz.kpis.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {viz.kpis.map((kpi, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-bold mt-1">{kpi.value}</p>
                  {kpi.variation && (
                    <span className={`text-xs flex items-center gap-1 mt-1 ${
                      kpi.trend === "up" ? "text-green-600" : kpi.trend === "down" ? "text-red-500" : "text-muted-foreground"
                    }`}>
                      {kpi.trend === "up" ? <TrendingUp className="w-3 h-3" /> :
                       kpi.trend === "down" ? <TrendingDown className="w-3 h-3" /> :
                       <Minus className="w-3 h-3" />}
                      {kpi.variation}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Charts */}
        {viz.charts?.map((chart, i) => (
          <Card key={i}>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm">{chart.title}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={250}>
                {chart.type === "bar" ? (
                  <BarChart data={chart.data} margin={{ top: 20 }}>
                    <XAxis dataKey={chart.xAxisKey || "name"} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    {(chart.dataKeys || ["value"]).map((dk, j) => (
                      <Bar key={dk} dataKey={dk} fill={CHART_COLORS[j % CHART_COLORS.length]} radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fill: "hsl(var(--foreground))" }} />
                    ))}
                  </BarChart>
                ) : chart.type === "line" ? (
                  <LineChart data={chart.data}>

                    <XAxis dataKey={chart.xAxisKey || "name"} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    {(chart.dataKeys || ["value"]).map((dk, j) => (
                      <Line key={dk} type="monotone" dataKey={dk} stroke={CHART_COLORS[j % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                ) : (
                  <PieChart>
                    <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {chart.data.map((_, j) => <Cell key={j} fill={CHART_COLORS[j % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}

        {/* Tables */}
        {viz.tables?.map((table, i) => (
          <Card key={i}>
            <CardHeader className="pb-2 px-4 pt-4 flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Table2 className="w-4 h-4" />{table.title}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => exportTableCSV(table.title, table.columns, table.rows)}>
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-4 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {table.columns.map((c, j) => <th key={j} className="text-left py-2 px-2 font-medium text-muted-foreground">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-border/50">
                      {row.map((cell, ci) => <td key={ci} className="py-1.5 px-2">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
});

// ─── Main Page ───
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${import.meta.env.VITE_FUNCTIONS_PREFIX ?? ""}ai-analyst`;

const AnalistaIA = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentViz, setCurrentViz] = useState<VizData | null>(null);
  const [dashboardContext, setDashboardContext] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const vizPanelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load dashboard context on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke(((import.meta.env.VITE_FUNCTIONS_PREFIX as string | undefined) ?? "") + "dashboard-data", {
          body: { page: "consolidado-cm", startDate: "2026-01-01", endDate: "2026-12-31" },
        });
        if (data?.data) setDashboardContext(data.data);
      } catch (e) {
        console.error("Failed to load dashboard context", e);
      }
    })();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: allMessages, context: dashboardContext }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(err.error || `Erro ${resp.status}`);
    }
    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullContent += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullContent } : m);
              }
              return [...prev, { role: "assistant", content: fullContent }];
            });
          }
        } catch { /* partial JSON, skip */ }
      }
    }

    // Parse viz from final content
    const { viz } = parseVizFromContent(fullContent);
    if (viz) setCurrentViz(viz);
  }, [dashboardContext]);

  const handleSend = async (question?: string) => {
    const q = question || input.trim();
    if (!q || loading) return;

    const userMsg: Msg = { role: "user", content: q };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      await streamChat(updated);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = useCallback(async () => {
    if (!currentViz || !vizPanelRef.current) {
      toast({ title: "Nada para exportar", description: "Faça uma pergunta primeiro para gerar visualizações.", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let cursorY = margin;

      // Title
      pdf.setFontSize(16);
      pdf.text("Relatório Analista de IA", margin, cursorY);
      cursorY += 8;
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margin, cursorY);
      pdf.setTextColor(0);
      cursorY += 10;

      // Last assistant text
      const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
      if (lastAssistant) {
        const { text } = parseVizFromContent(lastAssistant.content);
        const cleaned = text.replace(/[#*_~`]/g, "");
        pdf.setFontSize(10);
        const lines = pdf.splitTextToSize(cleaned, pageW - margin * 2);
        for (const line of lines) {
          if (cursorY > pageH - margin) { pdf.addPage(); cursorY = margin; }
          pdf.text(line, margin, cursorY);
          cursorY += 5;
        }
        cursorY += 5;
      }

      // Capture viz panel as image
      const canvas = await html2canvas(vizPanelRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height / canvas.width) * imgW;

      // Split across pages if needed
      if (cursorY + imgH > pageH - margin) {
        pdf.addPage();
        cursorY = margin;
      }

      // If image is taller than one page, scale to fit or split
      if (imgH > pageH - margin * 2) {
        const fitH = pageH - margin * 2;
        const fitW = (canvas.width / canvas.height) * fitH;
        pdf.addImage(imgData, "PNG", margin, cursorY, fitW, fitH);
      } else {
        pdf.addImage(imgData, "PNG", margin, cursorY, imgW, imgH);
      }

      pdf.save("relatorio-analista-ia.pdf");
      toast({ title: "PDF exportado!", description: "O relatório foi baixado com sucesso." });
    } catch (e: any) {
      console.error("PDF export error", e);
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [currentViz, messages, toast]);

  const quickActions = [
    { label: "Gerar Relatório", icon: FileText, q: "Me gere um relatório completo do período atual com todos os KPIs, gráficos e recomendações" },
    { label: "Exportar Planilha", icon: Download, q: "Gere uma tabela completa com todos os dados de vendas, campanhas e métricas para eu exportar" },
    { label: "Análise Completa", icon: BarChart3, q: "Faça uma análise completa de todos os dados disponíveis: vendas, campanhas, mídias e público" },
    { label: "Comparar Períodos", icon: ArrowRightLeft, q: "Compare o desempenho do período atual com o período anterior e destaque as principais mudanças" },
  ];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Left Panel - Visualizations */}
      <div className="hidden md:flex flex-col w-[60%] border-r border-border bg-muted/30">
        <div className="h-12 flex items-center justify-between px-4 border-b border-border bg-card/50">
          <div className="flex items-center">
            <BarChart3 className="w-4 h-4 text-primary mr-2" />
            <span className="text-sm font-medium">Painel de Visualização</span>
          </div>
          {currentViz && (
            <Button variant="outline" size="sm" className="text-xs" onClick={exportPDF} disabled={exporting}>
              <FileDown className="w-3 h-3 mr-1" />
              {exporting ? "Exportando..." : "Exportar PDF"}
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <VizPanel ref={vizPanelRef} viz={currentViz} />
        </div>
      </div>

      {/* Right Panel - Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 flex items-center px-4 border-b border-border bg-card/50">
          <Brain className="w-4 h-4 text-primary mr-2" />
          <span className="text-sm font-medium">Analista de IA</span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Suggested questions when empty */}
            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="text-center py-6">
                  <Brain className="w-10 h-10 text-primary mx-auto mb-3 opacity-60" />
                  <h2 className="text-base font-semibold">Analista de IA</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pergunte sobre vendas, campanhas, metas e performance do Coral Moment
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      className="text-xs text-left px-3 py-2 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-primary inline mr-1.5" />
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Messages */}
            <AnimatePresence>
              {messages.map((msg, i) => {
                const { text } = msg.role === "assistant" ? parseVizFromContent(msg.content) : { text: msg.content };
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`${msg.role === "user"
                      ? "ml-auto max-w-[85%] bg-primary text-primary-foreground"
                      : "mr-auto max-w-[95%] bg-card border border-border"
                    } rounded-xl px-4 py-3`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none text-foreground [&_strong]:text-foreground [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:text-sm [&_li]:text-sm">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{text}</p>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mr-auto bg-card rounded-xl p-4 border border-border">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Quick Actions */}
        <div className="px-4 py-2 border-t border-border flex gap-2 overflow-x-auto">
          {quickActions.map((action, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => handleSend(action.q)}
              disabled={loading}
            >
              <action.icon className="w-3 h-3 mr-1" />
              {action.label}
            </Button>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-card/50">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Pergunte sobre vendas, campanhas, metas..."
              className="min-h-[44px] max-h-[120px] resize-none bg-background"
              rows={1}
            />
            <Button onClick={() => handleSend()} disabled={loading || !input.trim()} className="shrink-0 self-end">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalistaIA;
