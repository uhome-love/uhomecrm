import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2, Code, Bug, Sparkles, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConversationMeta {
  id: string;
  titulo: string;
  created_at: string;
}

const QUICK_PROMPTS = [
  { label: "Analisar código", icon: Code, prompt: "Analise a arquitetura do sistema e explique como funciona o " },
  { label: "Corrigir bug", icon: Bug, prompt: "Preciso de ajuda para corrigir um bug: " },
  { label: "Criar feature", icon: Sparkles, prompt: "Quero criar uma nova funcionalidade: " },
  { label: "Explicar sistema", icon: BookOpen, prompt: "Explique detalhadamente como funciona " },
];

export default function DevAIPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversation history
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("homi_conversations")
      .select("id, titulo, created_at")
      .eq("user_id", user.id)
      .eq("tipo", "dev_ai")
      .order("updated_at", { ascending: false })
      .limit(20);
    setConversations((data || []) as ConversationMeta[]);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversation = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("homi_conversations")
      .select("mensagens")
      .eq("id", id)
      .single();
    if (data?.mensagens) {
      setMessages(data.mensagens as unknown as Message[]);
      setCurrentConvId(id);
    }
  }, []);

  const saveConversation = useCallback(async (msgs: Message[]) => {
    if (!user || msgs.length === 0) return;
    const titulo = msgs[0].content.slice(0, 60) + (msgs[0].content.length > 60 ? "..." : "");
    if (currentConvId) {
      await supabase
        .from("homi_conversations")
        .update({ mensagens: msgs as any, updated_at: new Date().toISOString() })
        .eq("id", currentConvId);
    } else {
      const { data } = await supabase
        .from("homi_conversations")
        .insert({ user_id: user.id, tipo: "dev_ai", titulo, mensagens: msgs as any })
        .select("id")
        .single();
      if (data) setCurrentConvId(data.id);
    }
    loadConversations();
  }, [user, currentConvId, loadConversations]);

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: msgText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const { data: { session } } = await (supabase.auth as any).getSession();
      if (!session?.access_token) { toast.error("Sessão expirada"); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dev-ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: newMessages }),
        }
      );

      if (response.status === 429) { toast.error("Limite de requisições excedido"); setLoading(false); return; }
      if (response.status === 402) { toast.error("Créditos de IA insuficientes"); setLoading(false); return; }
      if (!response.ok || !response.body) throw new Error("Erro na resposta");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                }
                return [...prev, { role: "assistant", content: assistantText }];
              });
            }
          } catch { /* partial */ }
        }
      }

      // Save after streaming completes
      const finalMessages = [...newMessages, { role: "assistant" as const, content: assistantText }];
      setMessages(finalMessages);
      saveConversation(finalMessages);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar com IA");
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, saveConversation]);

  const newConversation = () => {
    setMessages([]);
    setCurrentConvId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] gap-4">
      {/* Sidebar - Histórico */}
      <div className="w-64 shrink-0 hidden lg:flex flex-col border-r border-border pr-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico</h3>
          <Button variant="ghost" size="sm" onClick={newConversation} className="h-6 text-[10px] gap-1">
            <Sparkles className="h-3 w-3" /> Nova
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {conversations.map(c => (
              <button
                key={c.id}
                onClick={() => loadConversation(c.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors hover:bg-muted/50 ${currentConvId === c.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}
              >
                <p className="truncate">{c.titulo}</p>
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="text-[10px] text-muted-foreground/50 text-center py-4">Nenhuma conversa ainda</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              Dev AI
              <Badge variant="outline" className="text-[9px] font-normal">Beta</Badge>
            </h1>
            <p className="text-xs text-muted-foreground">Consultor técnico do UhomeSales — analisa, sugere e explica código</p>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 pr-2" ref={scrollRef as any}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent mb-4">
                <Code className="h-12 w-12 text-primary/40" />
              </div>
              <h2 className="text-base font-semibold mb-1">O que você quer explorar?</h2>
              <p className="text-xs text-muted-foreground mb-6 max-w-sm">
                Eu conheço profundamente a arquitetura do UhomeSales — banco de dados, APIs, componentes e regras de negócio.
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => setInput(qp.prompt)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
                  >
                    <qp.icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs font-medium">{qp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 border border-border"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:bg-background [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-xs">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-muted/50 border border-border rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Analisando...
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="pt-3 border-t border-border mt-auto">
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte algo sobre o sistema..."
              className="min-h-[52px] max-h-[120px] pr-12 resize-none text-sm rounded-xl"
              disabled={loading}
            />
            <Button
              size="sm"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="absolute bottom-2 right-2 h-8 w-8 p-0 rounded-lg"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">
            O Dev AI conhece o schema do banco, componentes e regras do UhomeSales. Ele sugere código mas não o executa.
          </p>
        </div>
      </div>
    </div>
  );
}
