import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Send, Loader2, PanelLeft, Sparkles, X, Paperclip, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHomi, type HomiAnexo } from "@/contexts/HomiContext";
import { useHomiThreads } from "@/hooks/useHomiThreads";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [anexos, setAnexos] = useState<HomiAnexo[]>([]);
  const [subindo, setSubindo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadedRef = useRef<string | null>(null);

  const LIMITE_MB = 8;

  const lerDataUrl = (f: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(f);
    });

  // Anexa imagens/PDF: sobe pro storage (histórico) e guarda o base64 para esta pergunta.
  const anexar = async (files: File[]) => {
    if (!files?.length) return;
    setSubindo(true);
    try {

      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      const novos: HomiAnexo[] = [];
      for (const f of files.slice(0, 4)) {

        if (f.size > LIMITE_MB * 1024 * 1024) {
          toast.error(`${f.name} passa de ${LIMITE_MB}MB`);
          continue;
        }
        const dataUrl = await lerDataUrl(f);
        let url: string | undefined;
        if (uid) {
          const path = `${uid}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
          const { error } = await supabase.storage.from("homi-anexos").upload(path, f, { contentType: f.type });
          if (!error) {
            const { data: signed } = await supabase.storage.from("homi-anexos").createSignedUrl(path, 60 * 60 * 24 * 365);
            url = signed?.signedUrl;
          }
        }
        novos.push({ nome: f.name, tipo: f.type || "application/octet-stream", dataUrl, url });
      }
      
      if (novos.length) setAnexos((prev) => [...prev, ...novos]);

    } catch (e) {
      console.error("Anexo HOMI:", e);
      toast.error("Não consegui ler o arquivo");
    } finally {
      setSubindo(false);
    }
  };


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
    if ((!t && anexos.length === 0) || isLoading) return;
    setInput("");
    setMenuAberto(false);
    setPainelAberto(false);
    sendMessage(t, anexos.length ? anexos : undefined);
    setAnexos([]);
  };


  // Prompt contextual vindo de outra página: /homi?p=...
  const [searchParams, setSearchParams] = useSearchParams();
  const promptRef = useRef<string | null>(null);
  useEffect(() => {
    const p = searchParams.get("p") ?? sessionStorage.getItem("homi:prompt-pendente");
    if (!p || promptRef.current === p) return;
    sessionStorage.removeItem("homi:prompt-pendente");
    promptRef.current = p;
    sendMessage(p);
    if (searchParams.get("p")) {
      window.setTimeout(() => setSearchParams({}, { replace: true }), 300);
    }
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
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-0 overflow-hidden border-y border-border bg-background sm:h-[calc(100vh-7rem)] sm:rounded-xl sm:border">
      {/* Conversas — desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-muted/30 lg:block">{sidebar}</aside>

      {/* Conversa */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-2 py-2 sm:px-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuAberto(true)} aria-label="Conversas">
            <PanelLeft className="h-4 w-4" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
            {threads.find(t => t.id === threadId)?.titulo || "HOMI"}
          </h1>
          <Button variant="ghost" size="sm" className="gap-1.5 xl:hidden" onClick={() => setPainelAberto(true)}>
            <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Painel</span>
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <MessageList messages={messages} isLoading={isLoading} userName={userName} onPrompt={enviar} />
        </div>

        <div className="border-t border-border p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
          <div className="mx-auto w-full max-w-3xl space-y-2">

            {anexos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {anexos.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs">
                    {a.tipo.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5 text-primary" /> : <FileText className="h-3.5 w-3.5 text-primary" />}
                    <span className="max-w-[160px] truncate">{a.nome}</span>
                    <button type="button" onClick={() => setAnexos(prev => prev.filter((_, j) => j !== i))} aria-label={`Remover ${a.nome}`}>
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex w-full items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; anexar(fs); }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => fileRef.current?.click()}
                disabled={isLoading || subindo}
                aria-label="Anexar imagem ou PDF"
              >
                {subindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </Button>
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
              <Button onClick={() => enviar()} disabled={isLoading || (!input.trim() && anexos.length === 0)} size="icon" className="h-11 w-11 shrink-0">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

      </main>

      {/* Painel vivo — desktop */}
      <aside className="hidden w-72 shrink-0 border-l border-border bg-muted/20 xl:block">
        <PainelVivo onPrompt={enviar} busy={isLoading} />
      </aside>

      {/* Mobile: conversas */}
      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="left" className="w-[85vw] max-w-xs p-0">
          <div className="h-full pt-8">{sidebar}</div>
        </SheetContent>
      </Sheet>

      {/* Mobile: painel vivo (bottom-sheet no celular, lateral no tablet) */}
      <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "h-[75dvh] rounded-t-2xl p-0" : "w-80 p-0"}
        >
          <div className="h-full pt-8"><PainelVivo onPrompt={enviar} busy={isLoading} /></div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
