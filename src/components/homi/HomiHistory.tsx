import { useState } from "react";
import { ArrowLeft, MessageSquare, PhoneCall, RefreshCw, ShieldQuestion, MapPin, MessageCircle, Trash2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import homiMascot from "@/assets/homi-mascot.png";

const ACAO_ICONS: Record<string, typeof MessageSquare> = {
  responder_whatsapp: MessageSquare,
  criar_followup: RefreshCw,
  script_ligacao: PhoneCall,
  quebrar_objecao: ShieldQuestion,
  preparar_visita: MapPin,
  chat: MessageCircle,
};

const ACAO_LABELS: Record<string, string> = {
  responder_whatsapp: "Responder WhatsApp",
  criar_followup: "Follow Up",
  script_ligacao: "Script Ligação",
  quebrar_objecao: "Quebrar Objeção",
  preparar_visita: "Preparar Visita",
  chat: "Chat Livre",
};

interface Conversation {
  id: string;
  tipo: string;
  acao: string | null;
  empreendimento: string | null;
  situacao: string | null;
  objetivo: string | null;
  titulo: string | null;
  mensagens: { role: string; content: string }[];
  resultado: string | null;
  created_at: string;
}

interface Props {
  onBack: () => void;
}

export default function HomiHistory({ onBack }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Conversation | null>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["homi-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("homi_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as Conversation[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("homi_conversations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homi-history"] });
      setSelected(null);
      toast.success("Conversa excluída");
    },
  });

  if (selected) {
    const Icon = ACAO_ICONS[selected.acao || selected.tipo] || MessageCircle;
    const label = ACAO_LABELS[selected.acao || selected.tipo] || "Conversa";

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao histórico
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-base text-foreground truncate">
              {selected.titulo || label}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {format(new Date(selected.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
              {selected.empreendimento && ` · ${selected.empreendimento}`}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="text-destructive/60 hover:text-destructive" onClick={() => deleteMutation.mutate(selected.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Acao result */}
        {selected.tipo === "acao" && selected.resultado && (
          <div className="rounded-xl border border-border bg-card p-4 prose prose-sm max-w-none text-foreground prose-p:my-1.5 prose-strong:text-foreground prose-headings:font-display leading-relaxed">
            <ReactMarkdown>{selected.resultado}</ReactMarkdown>
          </div>
        )}

        {/* Chat messages */}
        {selected.tipo === "chat" && selected.mensagens && (
          <div className="space-y-3">
            {(selected.mensagens as { role: string; content: string }[]).map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <img src={homiMascot} alt="HOMI" className="h-7 w-7 rounded-lg shrink-0 mt-1" />
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card border border-border rounded-bl-md"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none text-foreground prose-p:my-1 prose-strong:text-foreground">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">Histórico</h2>
          <p className="text-xs text-muted-foreground">Suas consultas anteriores com o HOMI</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12">
          <img src={homiMascot} alt="HOMI" className="h-14 w-14 mx-auto rounded-xl opacity-40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {conversations.map((c, i) => {
              const Icon = ACAO_ICONS[c.acao || c.tipo] || MessageCircle;
              const label = ACAO_LABELS[c.acao || c.tipo] || "Conversa";
              const preview = c.titulo || (c.tipo === "chat" && c.mensagens?.length > 0
                ? (c.mensagens[0] as { content: string }).content?.slice(0, 60) + "..."
                : c.empreendimento || label);

              return (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelected(c)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{preview}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {label} · {format(new Date(c.created_at), "dd/MM HH:mm")}
                      {c.empreendimento && ` · ${c.empreendimento}`}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
