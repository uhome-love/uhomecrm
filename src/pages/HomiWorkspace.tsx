import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Send, Loader2, PanelLeft, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useHomi } from "@/contexts/HomiContext";
import { useHomiThreads } from "@/hooks/useHomiThreads";
import ThreadSidebar from "@/components/homi/workspace/ThreadSidebar";
import PainelVivo from "@/components/homi/workspace/PainelVivo";
import MessageList from "@/components/homi/workspace/MessageList";

export default function HomiWorkspace() {
  const location = useLocation();
  const threadId = location.pathname.match(/^\/homi\/c\/(.+)$/)?.[1];
  const navigate = useNavigate();

  const {
    messages, sendMessage, isLoading, conversationId,
    loadConversation, startNewConversation, userName,
  } = useHomi();
  const { threads, fetchMessages, update, remove, reload } = useHomiThreads();

  const [input, setInput] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadedRef = useRef<string | null>(null);

  // Restaura a thread da URL (recarregar /homi/c/:id volta a mesma conversa)
  useEffect(() => {
    if (!threadId) {
      if (loadedRef.current !== null) {
        loadedRef.current = null;
        startNewConversation();
      }
      return;
    }
    if (loadedRef.current === threadId) return;
    loadedRef.current = threadId;
    fetchMessages(threadId).then((msgs) => loadConversation(threadId, msgs));
  }, [threadId, fetchMessages, loadConversation, startNewConversation]);

  // Conversa nova ganhou id no backend → navega para a URL dela
  useEffect(() => {
    if (conversationId && conversationId !== threadId) {
      loadedRef.current = conversationId;
      navigate(`/homi/c/${conversationId}`, { replace: true });
      reload();
    }
  }, [conversationId, threadId, navigate, reload]);

  // Foco no campo de texto
  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus();
  }, [isLoading, threadId]);

  const enviar = (texto?: string) => {
    const t = (texto ?? input).trim();
    if (!t || isLoading) return;
    setInput("");
    setMenuAberto(false);
    setPainelAberto(false);
    sendMessage(t);
  };

  // Prompt contextual vindo de outra página: /homi?p=...
  const [searchParams, setSearchParams] = useSearchParams();
  const promptRef = useRef<string | null>(null);
  useEffect(() => {
    const p = searchParams.get("p");
    if (!p || promptRef.current === p) return;
    promptRef.current = p;
    setSearchParams({}, { replace: true });
    sendMessage(p);
  }, [searchParams, setSearchParams, sendMessage]);


  const novaConversa = () => {
    loadedRef.current = null;
    startNewConversation();
    setMenuAberto(false);
    navigate("/homi");
  };

  const selecionar = (id: string) => {
    setMenuAberto(false);
    navigate(`/homi/c/${id}`);
  };

  const sidebar = (
    <ThreadSidebar
      threads={threads}
      activeId={threadId}
      onSelect={selecionar}
      onNew={novaConversa}
      onUpdate={update}
      onRemove={(id) => { remove(id); if (id === threadId) novaConversa(); }}
    />
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-0 overflow-hidden rounded-xl border border-border bg-background">
      {/* Conversas — desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-muted/30 lg:block">{sidebar}</aside>

      {/* Conversa */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuAberto(true)} aria-label="Conversas">
            <PanelLeft className="h-4 w-4" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
            {threads.find(t => t.id === threadId)?.titulo || "HOMI"}
          </h1>
          <Button variant="ghost" size="sm" className="gap-1.5 xl:hidden" onClick={() => setPainelAberto(true)}>
            <Sparkles className="h-4 w-4" /> Painel
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <MessageList messages={messages} isLoading={isLoading} userName={userName} onPrompt={enviar} />
        </div>

        <div className="border-t border-border p-3">
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
              }}
              placeholder="Pergunte, peça uma mensagem ou uma ação no CRM..."
              rows={1}
              className="max-h-40 min-h-[44px] resize-none text-sm"
            />
            <Button onClick={() => enviar()} disabled={isLoading || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </main>

      {/* Painel vivo — desktop */}
      <aside className="hidden w-72 shrink-0 border-l border-border bg-muted/20 xl:block">
        <PainelVivo onPrompt={enviar} busy={isLoading} />
      </aside>

      {/* Mobile: conversas */}
      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="left" className="w-72 p-0">
          <div className="h-full pt-8">{sidebar}</div>
        </SheetContent>
      </Sheet>

      {/* Mobile: painel vivo */}
      <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
        <SheetContent side="right" className="w-80 p-0">
          <div className="h-full pt-8"><PainelVivo onPrompt={enviar} busy={isLoading} /></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
