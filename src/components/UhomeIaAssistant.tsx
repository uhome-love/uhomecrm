import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import ReactMarkdown from "react-markdown";
import homiMascot from "@/assets/homi-mascot.png";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS: Record<string, { label: string; prompt: string }[]> = {
  corretor: [
    { label: "📞 Script de ligação", prompt: "Gere um script de ligação para um lead que pediu informações sobre um empreendimento e parou de responder há 7 dias." },
    { label: "💬 Quebrar objeção", prompt: "Me ajude a quebrar a objeção 'está caro' de um lead interessado em apartamento na planta em Porto Alegre." },
    { label: "✉️ Follow-up WhatsApp", prompt: "Gere uma mensagem curta de follow-up para WhatsApp para um lead que visitou o empreendimento mas não deu retorno." },
    { label: "🎯 Dicas de fechamento", prompt: "Quais são as melhores técnicas para fechar uma venda de imóvel na planta? Me dê dicas práticas." },
    { label: "📋 Como marcar visita", prompt: "Me ensine a melhor abordagem para marcar uma visita com um lead que demonstrou interesse inicial." },
  ],
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
  const { isAdmin, isCorretor } = useUserRole();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userRole = isAdmin ? "ceo" : isCorretor ? "corretor" : "gestor";
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
      {/* FAB — Homi mascot */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 group"
            title="Fale com o Homi"
          >
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-30" style={{ animationDuration: "3s" }} />
            <div className="relative h-16 w-16 rounded-full bg-card border-2 border-primary/30 shadow-elevated hover:shadow-glow transition-all duration-300 flex items-center justify-center overflow-hidden hover:scale-110">
              <img src={homiMascot} alt="Homi" className="h-14 w-14 object-contain" />
            </div>
            {/* Tooltip */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              Fale com o Homi 💬
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
            </div>
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
            <div className="flex items-center justify-between px-4 py-3 gradient-brand text-primary-foreground">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary-foreground/20 border border-primary-foreground/30 flex items-center justify-center overflow-hidden shrink-0">
                  <img src={homiMascot} alt="Homi" className="h-8 w-8 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-bold tracking-tight">Homi</p>
                  <p className="text-[10px] opacity-80">Assistente IA da UHome • {userRole === "ceo" ? "Modo CEO" : userRole === "corretor" ? "Modo Corretor" : "Modo Gerente"}</p>
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
                <div className="space-y-4">
                  {/* Welcome with Homi */}
                  <div className="flex flex-col items-center gap-2 py-2">
                    <img src={homiMascot} alt="Homi" className="h-20 w-20 object-contain" />
                    <p className="text-sm text-muted-foreground text-center">
                      Olá! Eu sou o <strong className="text-primary">Homi</strong>, seu assistente inteligente da UHome. Como posso ajudar?
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {actions.map((a) => (
                      <button
                        key={a.label}
                        onClick={() => send(a.prompt)}
                        className="w-full text-left text-xs px-3 py-2.5 rounded-xl border border-border hover:bg-accent/50 hover:border-primary/30 transition-all"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                    {msg.role === "assistant" && (
                      <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0 mt-0.5">
                        <img src={homiMascot} alt="Homi" className="h-6 w-6 object-contain" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
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
                <div className="flex justify-start gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                    <img src={homiMascot} alt="Homi" className="h-6 w-6 object-contain animate-pulse" />
                  </div>
                  <div className="bg-muted rounded-xl rounded-bl-md px-3 py-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick actions when in conversation */}
            {messages.length > 0 && !isLoading && (
              <div className="px-4 pb-1 flex gap-1.5 overflow-x-auto">
                <button onClick={() => send("Gere um checklist do dia.")} className="shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-border hover:bg-accent/50 hover:border-primary/30 transition-all">
                  📋 Checklist
                </button>
                <button onClick={() => send("Gere um plano de ação para 7 dias.")} className="shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-border hover:bg-accent/50 hover:border-primary/30 transition-all">
                  🎯 Plano 7 dias
                </button>
                <button onClick={() => send("Gere um script de ligação.")} className="shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-border hover:bg-accent/50 hover:border-primary/30 transition-all">
                  📞 Script
                </button>
                <button onClick={() => send("Gere mensagens de follow-up para WhatsApp.")} className="shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-border hover:bg-accent/50 hover:border-primary/30 transition-all">
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
                  placeholder="Pergunte ao Homi..."
                  className="min-h-[40px] max-h-[80px] resize-none text-sm rounded-xl"
                  rows={1}
                />
                <Button onClick={() => send(input)} disabled={!input.trim() || isLoading} size="sm" className="h-10 w-10 p-0 shrink-0 rounded-xl">
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
