import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, X, Send, BarChart3, Users, Target, TrendingUp, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

interface Alert {
  icon: string;
  message: string;
  action: string;
  link?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  dashboardData: Record<string, any>;
}

export default function HomiCeoFloating({ dashboardData }: Props) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate alerts from dashboard data
  const generateAlerts = useCallback(() => {
    const als: Alert[] = [];
    const kpis = dashboardData.kpis || {};
    const alertas = dashboardData.alertas || [];
    const filaCeo = dashboardData.filaCeoCount || 0;
    const pipelineStages = dashboardData.pipelineStages || [];

    // Fila CEO
    if (filaCeo > 0) {
      als.push({
        icon: "⏰",
        message: `${filaCeo} leads na Fila CEO aguardando distribuição`,
        action: "Ver pipeline",
        link: "/pipeline",
      });
    }

    // Leads parados
    for (const a of alertas) {
      if (a.tipo === "red") {
        als.push({ icon: "📉", message: a.mensagem, action: "Ver pipeline", link: "/pipeline" });
      }
    }

    // Visitas
    if (kpis.visitasMarcadas > 0 && kpis.visitasRealizadas === 0) {
      als.push({
        icon: "📅",
        message: `${kpis.visitasMarcadas} visitas marcadas mas 0 realizadas`,
        action: "Ver visitas",
        link: "/visitas",
      });
    }

    // VGV check
    if (kpis.vgvAssinado === 0 && kpis.propostas > 0) {
      als.push({
        icon: "💰",
        message: `${kpis.propostas} propostas ativas sem VGV assinado`,
        action: "Ver negócios",
        link: "/negocios",
      });
    }

    // Pipeline bottleneck: qualificação
    const qualStage = pipelineStages.find((s: any) => s.nome?.toLowerCase().includes("qualifica"));
    if (qualStage && qualStage.count > 10) {
      als.push({
        icon: "🔥",
        message: `${qualStage.count} leads acumulados em ${qualStage.nome}`,
        action: "Ver pipeline",
        link: "/pipeline",
      });
    }

    setAlerts(als);
  }, [dashboardData]);

  useEffect(() => { generateAlerts(); }, [generateAlerts]);

  // Refresh alerts every 30s
  useEffect(() => {
    const interval = setInterval(generateAlerts, 30000);
    return () => clearInterval(interval);
  }, [generateAlerts]);

  // Stream chat via homi-ceo
  const sendMessage = useCallback(async (text: string) => {
    if (!session?.access_token || !text.trim()) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput("");
    setStreaming(true);

    let assistantContent = "";

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homi-ceo`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: allMsgs.map(m => ({ role: m.role, content: m.content })),
          }),
        }
      );

      if (!resp.ok) {
        if (resp.status === 429) { toast.error("Rate limit, tente novamente."); setStreaming(false); return; }
        if (resp.status === 402) { toast.error("Créditos insuficientes."); setStreaming(false); return; }
        throw new Error("Erro na resposta");
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch { /* partial */ }
        }
      }
    } catch {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setStreaming(false);
    }
  }, [session, messages]);

  const handleQuickAction = (action: string) => {
    const prompts: Record<string, string> = {
      pipeline: "Analise o pipeline de leads agora. Quais gargalos existem? Onde estão as maiores oportunidades?",
      team: "Avalie a performance do time hoje. Quem está se destacando e quem precisa de atenção?",
      corretor: "Qual corretor devo focar hoje? Quem tem mais potencial de fechamento?",
      forecast: "Qual a projeção de fechamento do mês? Vamos bater a meta? O que preciso ajustar?",
    };
    sendMessage(prompts[action] || action);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-white shadow-xl hover:shadow-2xl transition-all hover:scale-105 flex items-center justify-center group"
        title="HOMI CEO"
      >
        <img src="/images/homi-mascot-official.png" alt="HOMI" className="h-10 w-10 object-contain" />
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
            {alerts.length}
          </span>
        )}
      </button>

      {/* Slide-out panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:w-[420px] p-0 flex flex-col">
          <SheetHeader className="p-4 pb-3 border-b bg-gradient-to-r from-slate-900 to-slate-800 text-white">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-white flex items-center gap-2">
                <Brain className="h-5 w-5" /> 🧠 HOMI CEO
              </SheetTitle>
              <Button size="icon" variant="ghost" className="text-white/70 hover:text-white h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {/* Alerts section */}
              {alerts.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Alertas Ativos
                  </p>
                  <div className="space-y-2">
                    {alerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border bg-destructive/5 border-destructive/20">
                        <span className="text-sm shrink-0">{a.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground">{a.message}</p>
                          {a.link && (
                            <button
                              onClick={() => { navigate(a.link!); setOpen(false); }}
                              className="text-[10px] text-primary font-medium flex items-center gap-0.5 mt-1 hover:underline"
                            >
                              {a.action} <ExternalLink className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Ações Rápidas
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="text-xs h-9 justify-start gap-1.5" onClick={() => handleQuickAction("pipeline")}>
                    <BarChart3 className="h-3.5 w-3.5 text-primary" /> Analisar pipeline
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-9 justify-start gap-1.5" onClick={() => handleQuickAction("team")}>
                    <Users className="h-3.5 w-3.5 text-primary" /> Performance time
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-9 justify-start gap-1.5" onClick={() => handleQuickAction("corretor")}>
                    <Target className="h-3.5 w-3.5 text-primary" /> Qual corretor focar
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-9 justify-start gap-1.5" onClick={() => handleQuickAction("forecast")}>
                    <TrendingUp className="h-3.5 w-3.5 text-primary" /> Forecast do mês
                  </Button>
                </div>
              </div>

              {/* Chat messages */}
              {messages.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Chat
                  </p>
                  <div className="space-y-3">
                    {messages.map((m, i) => (
                      <div key={i} className={`rounded-lg p-3 text-sm ${m.role === "user" ? "bg-primary/10 ml-8" : "bg-muted/50 mr-2"}`}>
                        {m.role === "assistant" ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p>{m.content}</p>
                        )}
                      </div>
                    ))}
                    {streaming && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> HOMI está pensando...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Chat input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Pergunte ao HOMI..."
                className="min-h-[40px] max-h-[80px] text-sm resize-none"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              />
              <Button
                size="icon"
                className="shrink-0 h-10 w-10"
                disabled={streaming || !input.trim()}
                onClick={() => sendMessage(input)}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
