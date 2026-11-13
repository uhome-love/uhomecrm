import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Phone, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatBRT } from "@/lib/brtTime";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const JANELA_HORAS = 48;

interface Aviso {
  id: string;
  mensagem: string;
  created_at: string;
  leadId: string;
  nome: string;
  telefone: string | null;
  empreendimento: string | null;
}

/** Extrai o texto respondido pelo cliente da mensagem gravada pelo webhook. */
function respostaCliente(msg: string): string | null {
  const m = msg.match(/Respondeu "([^"]*)"/);
  return m ? m[1] : null;
}

/**
 * Trava a tela do corretor quando um lead DELE no Pipeline respondeu SIM a um
 * disparo de reengajamento. Só informa: libera ao tocar em Ligar/WhatsApp
 * (marca o aviso como lido e abre a ficha). Nunca altera o lead.
 */
export default function ReengajamentoInteresseBloqueio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [saindo, setSaindo] = useState(false);
  const key = ["reengajamento-interesse-bloqueio", user?.id];

  const { data: avisos = [] } = useQuery({
    queryKey: key,
    enabled: !!user?.id,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Aviso[]> => {
      const desde = new Date(Date.now() - JANELA_HORAS * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("notifications")
        .select("id, mensagem, created_at, dados")
        .eq("user_id", user!.id)
        .eq("tipo", "lead_reengajado")
        .eq("lida", false)
        .eq("dados->>route", "pipeline_ativo_keep")
        .gte("created_at", desde)
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      const linhas = (data || []).map((n) => ({ ...n, leadId: String((n.dados as Record<string, unknown> | null)?.pipeline_lead_id || "") })).filter((n) => n.leadId);
      if (!linhas.length) return [];
      const { data: leads } = await supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, empreendimento")
        .in("id", [...new Set(linhas.map((l) => l.leadId))]);
      const mapa = new Map((leads || []).map((l) => [l.id, l]));
      return linhas.map((n) => {
        const l = mapa.get(n.leadId);
        return { id: n.id, mensagem: n.mensagem, created_at: n.created_at, leadId: n.leadId, nome: l?.nome || "Lead", telefone: l?.telefone || null, empreendimento: l?.empreendimento || null };
      });
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const onFocus = () => qc.invalidateQueries({ queryKey: key });
    window.addEventListener("focus", onFocus);
    const channel = supabase
      .channel(`reeng-bloqueio-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, onFocus)
      .subscribe();
    return () => { window.removeEventListener("focus", onFocus); supabase.removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const atual = avisos[0];
  if (!atual) return null;
  const resposta = respostaCliente(atual.mensagem);
  const digitos = (atual.telefone || "").replace(/\D/g, "");
  const waNumero = digitos.length <= 11 ? `55${digitos}` : digitos;

  async function confirmar(acao: "ligar" | "whatsapp") {
    if (saindo) return;
    setSaindo(true);
    try {
      await supabase.from("notifications").update({ lida: true, lida_em: new Date().toISOString() }).eq("id", atual.id);
      await qc.invalidateQueries({ queryKey: key });
      navigate(`/pipeline-leads?lead=${atual.leadId}`);
      if (digitos) {
        if (acao === "ligar" && isMobile) window.location.href = `tel:+${waNumero}`;
        if (acao === "whatsapp") window.open(`https://wa.me/${waNumero}`, "_blank", "noopener");
      }
    } finally {
      setSaindo(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => { /* bloqueado: só libera pelos botões */ }}>
      <DialogContent
        className="max-w-[440px] gap-0 rounded-2xl p-5 sm:p-6 [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-warning">
          <Flame className="h-4 w-4" /> Lead seu demonstrou interesse
          {avisos.length > 1 && <span className="normal-case">· 1 de {avisos.length}</span>}
        </p>
        <DialogTitle className="mt-2 text-xl font-bold leading-tight text-foreground">
          {atual.nome} respondeu SIM ao reengajamento
        </DialogTitle>
        <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
          {[atual.empreendimento, formatBRT(atual.created_at, "dd/MM HH:mm")].filter(Boolean).join(" · ")}
        </DialogDescription>
        {resposta && (
          <div className="mt-3 rounded-lg border-l-4 border-warning bg-warning/10 px-3 py-2.5 text-sm text-foreground">
            Resposta do cliente: <b>"{resposta}"</b>
          </div>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          O lead continua com você. Entre em contato agora, enquanto ele está quente.
        </p>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <Button className="h-11 flex-1" disabled={saindo} onClick={() => confirmar("ligar")}>
            <Phone className="mr-2 h-4 w-4" /> Ligar agora
          </Button>
          <Button variant="outline" className="h-11 flex-1 border-success text-success hover:bg-success/10" disabled={saindo} onClick={() => confirmar("whatsapp")}>
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
