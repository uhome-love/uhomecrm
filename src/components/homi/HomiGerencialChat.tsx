import { useState, useRef, useEffect } from "react";
import { Send, Loader2, BarChart3, ClipboardCheck, Phone, CalendarDays, FileText, GraduationCap, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const homiMascot = "/images/homi-mascot-opt.png";
type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homi-gerencial`;

const QUICK_ACTIONS = [
  { id: "analisar_checkpoint", label: "Analisar Checkpoint", icon: ClipboardCheck, color: "text-amber-600" },
  { id: "analisar_oferta_ativa", label: "Analisar Oferta Ativa", icon: Phone, color: "text-blue-600" },
  { id: "ver_visitas", label: "Ver Visitas", icon: CalendarDays, color: "text-emerald-600" },
  { id: "ver_pdn", label: "Analisar PDN", icon: BarChart3, color: "text-violet-600" },
  { id: "gerar_relatorio", label: "Gerar Relatório", icon: FileText, color: "text-rose-600" },
  { id: "criar_treinamento", label: "Criar Treinamento", icon: GraduationCap, color: "text-cyan-600" },
] as const;

const SUGGESTIONS = [
  "Como está meu PDN este mês?",
  "Quem está abaixo da meta hoje?",
  "Gera um script de ligação para Shift",
  "Relatório da semana do time",
  "Quais negócios estão parados?",
  "Cria um roleplay de objeção de preço",
];

export default function HomiGerencialChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages]);

  const saveConversation = async (msgs: Msg[]) => {
    if (!user || msgs.length < 2) return;
    const titulo = `[Gerencial] ${msgs[0]?.content?.slice(0, 80)}`;
    try {
      if (conversationId) {
        await supabase.from("homi_conversations").update({
          mensagens: msgs as any, titulo, updated_at: new Date().toISOString(),
        }).eq("id", conversationId);
      } else {
        const { data } = await supabase.from("homi_conversations").insert({
          user_id: user.id, tipo: "gerencial", titulo, mensagens: msgs as any,
        }).select("id").single();
        if (data) setConversationId(data.id);
      }
    } catch (e) { console.error("Save error:", e); }
  };

  const streamResponse = async (allMessages: Msg[], quickAction?: string) => {
    setIsLoading(true);
    let assistantSoFar = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        toast.error("Você precisa estar logado para usar o HOMI");
        setIsLoading(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: allMessages, quickAction }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        if (resp.status === 429) toast.error("Rate limit excedido, aguarde.");
        else if (resp.status === 402) toast.error("Créditos esgotados.");
        else toast.error(errorData.error || "Erro ao conectar com o HOMI");
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || !line.trim() || !line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw || !raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {}
        }
      }

      const finalMessages = [...allMessages, { role: "assistant" as const, content: assistantSoFar }];
      setMessages(finalMessages);
      saveConversation(finalMessages);
    } catch (e) {
      console.error("Chat error:", e);
      toast.error("Erro ao comunicar com o HOMI");
    }

    setIsLoading(false);
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMsg: Msg = { role: "user", content: messageText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    await streamResponse(newMessages);
  };

  const handleQuickAction = async (actionId: string) => {
    if (isLoading) return;
    const actionLabels: Record<string, string> = {
      analisar_checkpoint: "Analise o checkpoint do meu time hoje",
      analisar_oferta_ativa: "Analise a oferta ativa do time hoje",
      ver_visitas: "Como estão as visitas da semana do time?",
      ver_pdn: "Analise o PDN do meu time este mês",
      gerar_relatorio: "Gere um relatório executivo do time",
      criar_treinamento: "Crie um mini treinamento para meu time",
    };
    const text = actionLabels[actionId] || actionId;
    const userMsg: Msg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    await streamResponse(newMessages, actionId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
        <img src={homiMascot} alt="HOMI" className="h-8 w-8 rounded-lg" />
        <div className="flex-1">
          <p className="font-display font-bold text-sm text-foreground">HOMI Gerencial</p>
          <p className="text-[11px] text-muted-foreground">Assistente com dados reais do seu time</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center">
              <img src={homiMascot} alt="HOMI" className="h-16 w-16 mx-auto rounded-2xl shadow-lg mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">Fala, líder! 🎯</p>
              <p className="text-xs text-muted-foreground max-w-md">
                Eu tenho acesso aos dados reais do seu time. Pergunte sobre PDN, checkpoint, visitas, oferta ativa ou peça scripts e treinamentos.
              </p>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-lg">
              {QUICK_ACTIONS.map((action, i) => (
                <motion.button key={action.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => handleQuickAction(action.id)}
                  className="flex items-center gap-2 text-left text-xs p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <action.icon className={`h-4 w-4 shrink-0 ${action.color}`} />
                  <span className="text-muted-foreground">{action.label}</span>
                </motion.button>
              ))}
            </div>

            {/* Suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s, i) => (
                <motion.button key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                  onClick={() => sendMessage(s)}
                  className="text-left text-xs p-2.5 rounded-xl border border-dashed border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground"
                >
                  💬 {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && <img src={homiMascot} alt="HOMI" className="h-7 w-7 rounded-lg shrink-0 mt-1" />}
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border rounded-bl-md"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none text-foreground prose-p:my-1 prose-strong:text-foreground prose-headings:font-display prose-headings:text-base prose-headings:mt-3 prose-headings:mb-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : <p>{msg.content}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
            <img src={homiMascot} alt="HOMI" className="h-7 w-7 rounded-lg shrink-0 mt-1" />
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions bar when in conversation */}
      {messages.length > 0 && !isLoading && (
        <div className="flex gap-1.5 px-4 py-1.5 overflow-x-auto border-t border-border/50">
          {QUICK_ACTIONS.map(a => (
            <button key={a.id} onClick={() => handleQuickAction(a.id)}
              className="shrink-0 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all text-muted-foreground">
              <a.icon className={`h-3 w-3 ${a.color}`} />
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card/50 px-4 py-3">
        <div className="flex gap-2 items-end">
          <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre o time, peça análises, scripts ou relatórios..." rows={1}
            className="resize-none text-sm min-h-[40px] max-h-[120px]" disabled={isLoading} />
          <Button size="icon" onClick={() => sendMessage()} disabled={!input.trim() || isLoading} className="shrink-0 h-10 w-10 rounded-xl">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
