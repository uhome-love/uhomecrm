import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Copy, Check, Camera, Film, CalendarDays, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

const homiMascot = "/images/homi-mascot-opt.png";
type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  { label: "📸 Ideia de Post", prompt: "Me dê 5 ideias de posts para Instagram da Uhome para esta semana. Inclua: tema, formato, legenda completa com emojis e hashtags." },
  { label: "🎬 Roteiro Reels", prompt: "Crie um roteiro completo de Reels de 30-60 segundos para a Uhome. Inclua: gancho, desenvolvimento, CTA final, sugestão de música." },
  { label: "📅 Plano Semanal", prompt: "Monte um calendário de conteúdo para esta semana (Seg a Sex). Para cada dia: 1 post + 1 story. Formato tabela: Dia | Formato | Empreendimento | Tema | Horário" },
  { label: "✍️ Legenda Pronta", prompt: "Crie uma legenda completa para post do Instagram da Uhome. Inclua emojis, CTA forte e hashtags otimizadas. Pronta para copiar e colar." },
];

export default function HomiIdeiasChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: msg };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("homi-ana", {
        body: { messages: updated },
      });
      if (error) throw error;
      const reply = data?.reply || data?.message || "Sem resposta.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      console.error("[HomiIdeiasChat] Chat error:", e);
      toast.error("Erro ao conectar com HOMI. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const [copied, setCopied] = useState<number | null>(null);

  return (
    <div className="flex flex-col h-[60vh] bg-card rounded-xl border border-border overflow-hidden">
      {/* Quick prompts */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 overflow-x-auto scrollbar-none">
        <img src={homiMascot} alt="HOMI" className="h-6 w-6 object-contain shrink-0" />
        <span className="text-xs font-semibold text-foreground shrink-0">HOMI Ana</span>
        <div className="flex gap-1.5 ml-2">
          {QUICK_PROMPTS.map((q, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="text-[10px] h-7 px-2.5 shrink-0"
              onClick={() => send(q.prompt)}
              disabled={loading}
            >
              {q.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <img src={homiMascot} alt="HOMI" className="h-14 w-14 object-contain opacity-60" />
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Peça ideias de conteúdo, roteiros, legendas ou calendários editoriais!
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} group/msg`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
              m.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}>
              {m.role === "assistant" ? (
                <>
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity"
                    onClick={() => {
                      navigator.clipboard.writeText(m.content);
                      setCopied(i);
                      setTimeout(() => setCopied(null), 2000);
                    }}
                  >
                    {copied === i ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    {copied === i ? "Copiado!" : "Copiar"}
                  </Button>
                </>
              ) : m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">HOMI está criando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 flex gap-2">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Peça ideias de conteúdo, roteiros, legendas..."
          className="resize-none min-h-[40px] max-h-24 text-sm"
          rows={1}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        <Button size="icon" onClick={() => send()} disabled={loading || !input.trim()} className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
