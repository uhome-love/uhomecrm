import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, ExternalLink, Smartphone, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadWhatsAppTabProps {
  leadId: string;
  telefone?: string | null;
}

interface WaMensagem {
  id: string;
  body: string;
  direction: string;
  timestamp: string;
}

export default function LeadWhatsAppTab({ leadId, telefone }: LeadWhatsAppTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<WaMensagem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasInstance, setHasInstance] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !leadId) return;
    loadData();
  }, [user?.id, leadId]);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch profiles.id for the logged-in user
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      const profileId = profile?.id;

      const [msgRes, instRes] = await Promise.all([
        supabase
          .from("whatsapp_mensagens")
          .select("id, body, direction, timestamp", { count: "exact" })
          .eq("lead_id", leadId)
          .order("timestamp", { ascending: false })
          .limit(3),
        profileId
          ? supabase
              .from("whatsapp_instancias")
              .select("id")
              .eq("corretor_id", profileId)
              .eq("status", "conectado")
              .limit(1)
          : Promise.resolve({ data: [] }),
      ]);

      setMessages(msgRes.data ?? []);
      setTotalCount(msgRes.count ?? 0);
      setHasInstance((instRes.data?.length ?? 0) > 0);
    } catch (e) {
      console.error("LeadWhatsAppTab load error:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!telefone) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4">
        <AlertTriangle className="h-8 w-8 text-yellow-500" />
        <p className="text-sm font-medium text-foreground">Lead sem telefone cadastrado</p>
        <p className="text-xs text-muted-foreground">Adicione um telefone ao lead para usar o WhatsApp.</p>
      </div>
    );
  }

  if (!hasInstance) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4 text-center px-4">
        <Smartphone className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">WhatsApp não conectado</p>
        <p className="text-xs text-muted-foreground">Conecte seu WhatsApp para conversar com leads.</p>
        <Button size="sm" onClick={() => navigate("/configuracoes/whatsapp")}>
          Conectar WhatsApp
        </Button>
      </div>
    );
  }

  // ESTADO A — Sem histórico
  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4 text-center px-4">
        <span className="text-4xl">💬</span>
        <p className="text-sm font-semibold text-foreground">Iniciar conversa no WhatsApp</p>
        <p className="text-xs text-muted-foreground">Nenhuma conversa ainda. Inicie agora pelo UhomeSales.</p>
        <Button size="sm" onClick={() => navigate(`/whatsapp?lead=${leadId}`)}>
          <MessageSquare className="h-4 w-4 mr-1" />
          Iniciar conversa
        </Button>
      </div>
    );
  }

  // ESTADO B — Com histórico
  const lastMsg = messages[0];
  const timeAgo = lastMsg
    ? formatDistanceToNow(new Date(lastMsg.timestamp), { addSuffix: true, locale: ptBR })
    : "";

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
        <div className="text-xs text-green-800 dark:text-green-300 font-medium">
          {totalCount} mensagem{totalCount !== 1 ? "s" : ""} · Última: {timeAgo}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-green-700 dark:text-green-400 gap-1"
          onClick={() => navigate(`/whatsapp?lead=${leadId}`)}
        >
          Abrir no Inbox <ExternalLink className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {[...messages].reverse().map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
              msg.direction === "sent"
                ? "self-end bg-[#4F46E5] text-white"
                : "self-start bg-muted text-foreground"
            }`}
          >
            <p className="break-words">{msg.body || "(mídia)"}</p>
            <span className={`text-[10px] mt-1 block ${
              msg.direction === "sent" ? "text-white/70" : "text-muted-foreground"
            }`}>
              {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full text-xs gap-1"
        onClick={() => navigate(`/whatsapp?lead=${leadId}`)}
      >
        <MessageSquare className="h-4 w-4" />
        Abrir conversa completa no WhatsApp Inbox
      </Button>
    </div>
  );
}
