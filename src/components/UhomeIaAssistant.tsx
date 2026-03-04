import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS: Record<string, { label: string; prompt: string }[]> = {
  gestor: [
    { label: "📋 Checklist do dia", prompt: "Gere meu checklist de tarefas para hoje como gerente Uhome. Considere rotinas de cobrança, acompanhamento e foco em visitas." },
    { label: "🎯 Plano de ação", prompt: "Gere um plano de ação para esta semana focado em destravar gargalos de conversão e aumentar visitas." },
    { label: "📞 O que cobrar do time", prompt: "Liste o que devo cobrar do meu time de corretores hoje para manter a cadência e disciplina." },
    { label: "💬 Script de ligação", prompt: "Gere um script de ligação para um lead que pediu informações sobre um empreendimento e parou de responder há 7 dias." },
    { label: "📊 Diagnóstico rápido", prompt: "Faça um diagnóstico rápido da minha operação. Quais são os gargalos mais comuns em equipes imobiliárias e como identificar rapidamente?" },
  ],
  ceo: [
    { label: "📊 Visão macro", prompt: "Faça um resumo executivo do que devo monitorar esta semana como CEO de uma imobiliária focada em lançamentos." },
    { label: "🏆 Ranking e decisões", prompt: "Como estruturar um ranking eficiente de gerentes e corretores? Quais métricas priorizar?" },
    { label: "⚠️ Gargalos e intervenções", prompt: "Quais são os sinais de que uma equipe precisa de intervenção urgente? Liste critérios práticos." },
    { label: "📋 Pauta de alinhamento", prompt: "Gere uma pauta curta para reunião de alinhamento com meus gerentes focada em resultados e próximos passos." },
    { label: "💡 Decisões estratégicas", prompt: "Quais decisões estratégicas um CEO de imobiliária deve tomar semanalmente para maximizar VGV?" },
  ],
};

export default function UhomeIaAssistant() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userRole = isAdmin ? "ceo" : "gestor";
  const actions = QUICK_ACTIONS[userRole] || QUICK_ACTIONS.gestor;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  const streamChat = useCallback(async (allMessages: Message[]) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uhome-ia-core`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: allMessages,
        role: userRole,
        module: "general",
      }),
    });

    if (!resp.ok || !resp.body) throw new Error("Stream failed");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantContent = "";

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
            assistantContent += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
          }
        } catch { /* partial JSON */ }
      }
    }
  }, [userRole]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      await streamChat(newMessages);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: "assistant", content: "Erro ao processar. Tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, streamChat]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center transition-shadow"
            title="UHOME IA"
          >
            <Bot className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[420px] max-h-[600px] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <div>
                  <p className="text-sm font-bold">UHOME IA</p>
                  <p className="text-[10px] opacity-80">Cérebro do Sistema • {userRole === "ceo" ? "Modo CEO" : "Modo Gerente"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => { setMessages([]); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[380px]">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    Olá! Sou a <strong>UHOME IA</strong>. Como posso ajudar?
                  </p>
                  <div className="space-y-1.5">
                    {actions.map((a) => (
                      <button
                        key={a.label}
                        onClick={() => send(a.prompt)}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick actions when in conversation */}
            {messages.length > 0 && !isLoading && (
              <div className="px-4 pb-1 flex gap-1.5 overflow-x-auto">
                <button onClick={() => send("Gere um checklist do dia.")} className="shrink-0 text-[10px] px-2 py-1 rounded-full border border-border hover:bg-muted/50 transition-colors">
                  📋 Checklist
                </button>
                <button onClick={() => send("Gere um plano de ação para 7 dias.")} className="shrink-0 text-[10px] px-2 py-1 rounded-full border border-border hover:bg-muted/50 transition-colors">
                  🎯 Plano 7 dias
                </button>
                <button onClick={() => send("Gere um script de ligação.")} className="shrink-0 text-[10px] px-2 py-1 rounded-full border border-border hover:bg-muted/50 transition-colors">
                  📞 Script
                </button>
                <button onClick={() => send("Gere mensagens de follow-up para WhatsApp.")} className="shrink-0 text-[10px] px-2 py-1 rounded-full border border-border hover:bg-muted/50 transition-colors">
                  💬 Follow-up
                </button>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte à UHOME IA..."
                  className="min-h-[40px] max-h-[80px] resize-none text-sm"
                  rows={1}
                />
                <Button onClick={() => send(input)} disabled={!input.trim() || isLoading} size="sm" className="h-10 w-10 p-0 shrink-0">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
