import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="space-y-3 px-4 py-4 sm:px-5">
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
  );
}
