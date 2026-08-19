import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRT } from "@/lib/brtTime";

interface Props {
  leadId: string;
}

interface LiaMsg {
  role: string;
  conteudo: string | null;
  created_at: string;
}

const MIDIA_RE = /\[\[midia:[^\]]*\]\]/g;

function renderConteudo(raw: string | null) {
  const texto = raw ?? "";
  if (!MIDIA_RE.test(texto)) return texto;
  MIDIA_RE.lastIndex = 0;
  const limpo = texto.replace(MIDIA_RE, "").trim();
  return limpo ? `📎 imagem/arquivo enviado\n${limpo}` : "📎 imagem/arquivo enviado";
}

export default function DrawerLiaConversaTab({ leadId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["lead-lia-conversa", leadId],
    queryFn: async (): Promise<LiaMsg[]> => {
      const { data: estado, error: estadoErr } = await supabase
        .from("lia_estado")
        .select("telefone")
        .eq("lead_id", leadId)
        .maybeSingle();
      if (estadoErr) throw estadoErr;
      const telefone = estado?.telefone;
      if (!telefone) return [];

      const { data: msgs, error } = await supabase
        .from("lia_conversas")
        .select("role, conteudo, created_at")
        .eq("telefone", telefone)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (msgs ?? []) as LiaMsg[];
    },
    staleTime: 30_000,
  });

  // Copiloto: sugere a próxima mensagem pro corretor mandar.
  const [sugestao, setSugestao] = useState("");
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function sugerir() {
    setGerando(true);
    setSugestao("");
    setCopiado(false);
    try {
      const msgs = (data ?? [])
        .map((m) => ({ role: m.role, content: m.conteudo ?? "" }))
        .filter((m) => m.content && (m.role === "user" || m.role === "assistant"));
      const { data: res } = await supabase.functions.invoke("lia-chat", {
        body: { mode: "copiloto", messages: msgs },
      });
      setSugestao(String((res as { sugestao?: string } | null)?.sugestao ?? "").trim());
    } catch {
      setSugestao("");
    }
    setGerando(false);
  }

  function copiar() {
    if (!sugestao) return;
    navigator.clipboard?.writeText(sugestao);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  if (isLoading) {
    return (
      <div className="space-y-3 px-5 py-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="ml-auto h-12 w-2/3" />
        <Skeleton className="h-12 w-1/2" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhuma conversa registrada.
      </p>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-5">
      {/* Copiloto da LIA: sugere a próxima mensagem pro corretor */}
      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Copiloto da LIA
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={sugerir}
            disabled={gerando}
            className="h-7 text-xs"
          >
            {gerando ? "Pensando..." : sugestao ? "Sugerir outra" : "Sugerir resposta"}
          </Button>
        </div>
        {sugestao && (
          <div className="mt-2 rounded-lg border border-border bg-background p-2.5">
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">{sugestao}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={copiar}
              className="mt-1.5 h-6 gap-1 px-2 text-xs"
            >
              {copiado ? (
                <>
                  <Check className="h-3 w-3" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copiar
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {data.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} className={cn("flex", isUser ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[80%]",
                  isUser
                    ? "rounded-bl-sm bg-muted text-foreground"
                    : "rounded-br-sm bg-primary/10 text-foreground"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{renderConteudo(m.conteudo)}</p>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {formatBRT(m.created_at, "dd/MM HH:mm")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
