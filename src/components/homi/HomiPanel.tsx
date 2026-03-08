import { useRef, useEffect, memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHomi } from "@/contexts/HomiContext";
import ReactMarkdown from "react-markdown";
import HomiAnimated from "./HomiAnimated";
import type { HomiAnimState } from "./HomiAnimated";

const QUICK_ACTIONS: Record<string, { label: string; prompt: string }[]> = {
  corretor: [
    { label: "📞 Script de ligação", prompt: "Gere um script de ligação para um lead que pediu informações e parou de responder há 7 dias." },
    { label: "💬 Quebrar objeção", prompt: "Me ajude a quebrar a objeção 'está caro' de um lead interessado em apartamento na planta." },
    { label: "✉️ Follow-up WhatsApp", prompt: "Gere mensagem curta de follow-up WhatsApp para lead que visitou mas não deu retorno." },
    { label: "🎯 Próxima ação", prompt: "Qual deve ser minha próxima ação agora? Analise meu dia e sugira o que fazer." },
  ],
  gestor: [
    { label: "📋 Checklist do dia", prompt: "Gere meu checklist para hoje como gerente. Rotinas de cobrança e foco em visitas." },
    { label: "📊 Diagnóstico rápido", prompt: "Faça um diagnóstico rápido da minha operação. Identifique os gargalos principais." },
    { label: "🎯 O que cobrar do time", prompt: "Liste o que devo cobrar do time de corretores hoje para manter cadência." },
    { label: "📞 Script para corretor", prompt: "Gere um script de ligação para os corretores usarem com leads novos." },
  ],
  ceo: [
    { label: "📊 Resumo executivo", prompt: "Faça um resumo executivo do que devo monitorar esta semana como CEO." },
    { label: "⚠️ Gargalos e riscos", prompt: "Quais são os sinais de que uma equipe precisa de intervenção urgente?" },
    { label: "📋 Pauta alinhamento", prompt: "Gere pauta curta para reunião com meus gerentes focada em resultados." },
    { label: "💡 Decisões estratégicas", prompt: "Quais decisões estratégicas devo tomar semanalmente para maximizar VGV?" },
  ],
};

function HomiPanelInner() {
  const {
    isOpen, closeHomi, messages, sendMessage, clearMessages, isLoading, homiRole, userName,
  } = useHomi();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prevMsgCount, setPrevMsgCount] = useState(0);

  const actions = QUICK_ACTIONS[homiRole] || QUICK_ACTIONS.gestor;

  // Derive HOMI animation state
  const homiAnimState: HomiAnimState = isLoading
    ? (messages.length > 0 && messages[messages.length - 1]?.role === "user" ? "thinking" : "talking")
    : messages.length > prevMsgCount && messages[messages.length - 1]?.role === "assistant"
      ? "talking"
      : "idle";

  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      setPrevMsgCount(messages.length);
    }
  }, [isLoading, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const roleLabel = homiRole === "ceo" ? "Modo CEO" : homiRole === "corretor" ? "Modo Corretor" : "Modo Gerente";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/20 backdrop-blur-[2px] lg:hidden"
            onClick={closeHomi}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 z-[75] h-full w-[380px] max-w-[calc(100vw-48px)] flex flex-col bg-card border-l border-border shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary-foreground/20 border border-primary-foreground/30 flex items-center justify-center overflow-hidden shrink-0">
                  <HomiAnimated state={homiAnimState} size={36} />
                </div>
                <div>
                  <p className="text-sm font-bold tracking-tight flex items-center gap-1.5">
                    HOMI <Sparkles className="h-3.5 w-3.5 opacity-70" />
                  </p>
                  <p className="text-[10px] opacity-80">{roleLabel} • Pressione / para abrir</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/20" onClick={clearMessages} title="Nova conversa">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/20" onClick={closeHomi}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="space-y-4 pt-4">
                  <div className="flex flex-col items-center gap-2">
                    <HomiAnimated state="idle" size={80} />
                    <p className="text-sm text-muted-foreground text-center">
                      {userName ? `Fala, ${userName}!` : "Olá!"} 💪 Eu sou o <strong className="text-primary">HOMI</strong>.
                      <br />Como posso ajudar?
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {actions.map((a) => (
                      <button
                        key={a.label}
                        onClick={() => { sendMessage(a.prompt); }}
                        className="w-full text-left text-xs px-3 py-2.5 rounded-xl border border-border hover:bg-accent/50 hover:border-primary/30 transition-all"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-center pt-2">
                    <p className="text-[10px] text-muted-foreground/60">
                      Dica: pressione <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">/</kbd> em qualquer tela para me chamar
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                    {msg.role === "assistant" && (
                      <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0 mt-0.5">
                        <HomiAnimated
                          state={i === messages.length - 1 && isLoading ? "talking" : "idle"}
                          size={24}
                        />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
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
                    <HomiAnimated state="thinking" size={24} />
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
              <div className="px-3 pb-1 flex gap-1.5 overflow-x-auto shrink-0">
                <button onClick={() => sendMessage("Gere um checklist do dia.")} className="shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-border hover:bg-accent/50 hover:border-primary/30 transition-all">
                  📋 Checklist
                </button>
                <button onClick={() => sendMessage("Gere um script de ligação.")} className="shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-border hover:bg-accent/50 hover:border-primary/30 transition-all">
                  📞 Script
                </button>
                <button onClick={() => sendMessage("Gere mensagens de follow-up para WhatsApp.")} className="shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-border hover:bg-accent/50 hover:border-primary/30 transition-all">
                  💬 Follow-up
                </button>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-border shrink-0">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte ao HOMI..."
                  className="min-h-[40px] max-h-[80px] resize-none text-sm rounded-xl"
                  rows={1}
                />
                <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="sm" className="h-10 w-10 p-0 shrink-0 rounded-xl">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const HomiPanel = memo(HomiPanelInner);
export default HomiPanel;
