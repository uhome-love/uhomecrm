import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, isToday, isTomorrow, isBefore, startOfDay, addHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, MessageCircle, CheckCircle2, Clock, Calendar, ClipboardList, ArrowRight, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

interface TarefaAgenda {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  status: string;
  vence_em: string | null;
  hora_vencimento: string | null;
  pipeline_lead_id: string;
  lead_nome?: string;
  lead_telefone?: string;
  lead_empreendimento?: string;
}

const TIPO_EMOJI: Record<string, string> = {
  follow_up: "🔄", ligar: "📞", whatsapp: "💬", enviar_proposta: "📄",
  enviar_material: "📎", marcar_visita: "📅", confirmar_visita: "✅", retornar_cliente: "↩️", outro: "📋",
};

const TIPO_LABELS: Record<string, string> = {
  follow_up: "Follow-up", ligar: "Ligar", whatsapp: "WhatsApp", enviar_proposta: "Enviar proposta",
  enviar_material: "Enviar material", marcar_visita: "Marcar visita", confirmar_visita: "Confirmar visita",
  retornar_cliente: "Retornar cliente", outro: "Outro",
};

function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  window.open(`https://wa.me/${full}`, "_blank");
}

export default function MinhaAgendaWidget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [adiarId, setAdiarId] = useState<string | null>(null);
  const [adiarData, setAdiarData] = useState("");
  const [adiarHora, setAdiarHora] = useState("");

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["agenda-widget", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("pipeline_tarefas")
        .select("*")
        .or(`responsavel_id.eq.${user.id},created_by.eq.${user.id}`)
        .eq("status", "pendente")
        .order("vence_em", { ascending: true })
        .order("hora_vencimento", { ascending: true })
        .limit(30);
      if (error) return [];
      const rows = (data || []) as any[];
      const leadIds = [...new Set(rows.map(r => r.pipeline_lead_id).filter(Boolean))];
      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("pipeline_leads")
          .select("id, nome, telefone, empreendimento")
          .in("id", leadIds);
        const leadMap = new Map((leads || []).map(l => [l.id, l]));
        rows.forEach(r => {
          const lead = leadMap.get(r.pipeline_lead_id);
          if (lead) { r.lead_nome = lead.nome; r.lead_telefone = lead.telefone; r.lead_empreendimento = lead.empreendimento; }
        });
      }
      return rows as TarefaAgenda[];
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const now = new Date();
  const todayStart = startOfDay(now);

  const atrasadas = useMemo(() => tarefas.filter(t => {
    if (!t.vence_em) return false;
    const d = new Date(t.vence_em);
    if (isBefore(d, todayStart)) return true;
    if (isToday(d) && t.hora_vencimento) {
      const [h, m] = t.hora_vencimento.split(":").map(Number);
      const taskTime = new Date(d);
      taskTime.setHours(h, m, 0);
      return isBefore(taskTime, now);
    }
    return false;
  }), [tarefas, now]);

  const proximas = useMemo(() => tarefas.filter(t => {
    if (!t.vence_em) return false;
    const d = new Date(t.vence_em);
    if (!isToday(d)) return false;
    if (!t.hora_vencimento) return true;
    const [h, m] = t.hora_vencimento.split(":").map(Number);
    const taskTime = new Date(d);
    taskTime.setHours(h, m, 0);
    return !isBefore(taskTime, now);
  }), [tarefas, now]);

  const amanha = useMemo(() => tarefas.filter(t => t.vence_em && isTomorrow(new Date(t.vence_em))), [tarefas]);

  const totalHoje = atrasadas.length + proximas.length;

  const handleConcluir = async (t: TarefaAgenda) => {
    await supabase.from("pipeline_tarefas").update({ status: "concluida", concluida_em: new Date().toISOString() } as any).eq("id", t.id);
    await supabase.from("pipeline_leads").update({ ultima_acao_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any).eq("id", t.pipeline_lead_id);
    toast.success("Tarefa concluída ✅");
    queryClient.invalidateQueries({ queryKey: ["agenda-widget"] });
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
  };

  const handleAdiarRapido = async (id: string, horas: number) => {
    const novaData = addHours(new Date(), horas);
    await supabase.from("pipeline_tarefas").update({
      vence_em: format(novaData, "yyyy-MM-dd"),
      hora_vencimento: format(novaData, "HH:mm"),
    } as any).eq("id", id);
    toast.success("Tarefa adiada ✅");
    queryClient.invalidateQueries({ queryKey: ["agenda-widget"] });
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
  };

  const handleAdiarCustom = async () => {
    if (!adiarId || !adiarData) return;
    await supabase.from("pipeline_tarefas").update({
      vence_em: adiarData,
      hora_vencimento: adiarHora || null,
    } as any).eq("id", adiarId);
    toast.success("Tarefa reagendada ✅");
    setAdiarId(null);
    queryClient.invalidateQueries({ queryKey: ["agenda-widget"] });
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
  };

  const renderTarefa = (t: TarefaAgenda, variant: "atrasada" | "proxima" | "futura") => {
    const borderClass = variant === "atrasada" ? "border-l-red-500 bg-red-500/10" :
      variant === "proxima" ? "border-l-yellow-500 bg-yellow-500/10" : "border-l-muted-foreground/40 bg-muted/30";
    const timeIcon = variant === "atrasada" ? "🔴" : variant === "proxima" ? "🟡" : "⚪";

    return (
      <div key={t.id} className={`border-l-[3px] rounded-r-lg p-2.5 space-y-1 ${borderClass}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            {timeIcon} {t.hora_vencimento ? t.hora_vencimento.slice(0, 5) : "—"} · {TIPO_LABELS[t.tipo] || t.tipo}
          </span>
          <Badge variant="outline" className="text-[10px]">{TIPO_EMOJI[t.tipo] || "📋"}</Badge>
        </div>
        <p className="text-sm font-semibold text-foreground truncate">
          👤 {t.lead_nome || "Lead"} {t.lead_empreendimento ? `· ${t.lead_empreendimento}` : ""}
        </p>
        {t.descricao && <p className="text-xs text-muted-foreground italic truncate">📝 {t.descricao}</p>}
        <div className="flex items-center gap-1 pt-1">
          {t.lead_telefone && (
            <>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => window.open(`tel:${t.lead_telefone}`, "_self")}>
                <Phone className="h-3 w-3" /> Ligar
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => openWhatsApp(t.lead_telefone!)}>
                <MessageCircle className="h-3 w-3" /> WhatsApp
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 ml-auto" onClick={() => handleConcluir(t)}>
            <CheckCircle2 className="h-3 w-3" /> Feito
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { setAdiarId(t.id); setAdiarData(""); setAdiarHora(""); }}>
            <Clock className="h-3 w-3" /> Adiar
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) return null;

  return (
    <>
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4 text-primary" /> Minha Agenda
            </h3>
            <Badge variant={totalHoje > 0 ? "default" : "secondary"} className="text-xs">
              Hoje · {totalHoje} 📌
            </Badge>
          </div>

          {totalHoje === 0 && amanha.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <div className="text-3xl">✅</div>
              <p className="text-sm font-bold text-foreground">Tudo em dia!</p>
              <p className="text-xs text-muted-foreground">Nenhuma tarefa pendente para hoje.</p>
              <p className="text-[10px] text-muted-foreground">💡 Registre ações com data futura nos seus leads para criar tarefas automaticamente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {atrasadas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">🔴 Atrasadas ({atrasadas.length})</p>
                  {atrasadas.slice(0, 3).map(t => renderTarefa(t, "atrasada"))}
                </div>
              )}
              {proximas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">⏰ Agora / Próximas</p>
                  {proximas.slice(0, 5 - Math.min(atrasadas.length, 3)).map(t => renderTarefa(t, "proxima"))}
                </div>
              )}
              {amanha.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">📅 Amanhã ({amanha.length})</p>
                  {amanha.slice(0, 3).map(t => (
                    <p key={t.id} className="text-xs text-muted-foreground pl-2">
                      ⚪ {t.hora_vencimento?.slice(0, 5) || "—"} · {TIPO_LABELS[t.tipo] || t.tipo}: {t.lead_nome || "Lead"}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button variant="ghost" size="sm" className="w-full text-xs text-primary gap-1" onClick={() => navigate("/minhas-tarefas")}>
            📋 Ver agenda completa <ChevronRight className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>

      {/* Adiar dialog */}
      <Dialog open={!!adiarId} onOpenChange={() => setAdiarId(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Adiar tarefa</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => { handleAdiarRapido(adiarId!, 1); setAdiarId(null); }}>Daqui 1h</Button>
              <Button variant="outline" size="sm" onClick={() => { handleAdiarRapido(adiarId!, 2); setAdiarId(null); }}>Daqui 2h</Button>
              <Button variant="outline" size="sm" onClick={() => { handleAdiarRapido(adiarId!, 24); setAdiarId(null); }}>Amanhã</Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">ou escolha data/hora:</p>
            <Input type="date" value={adiarData} onChange={e => setAdiarData(e.target.value)} />
            <Input type="time" value={adiarHora} onChange={e => setAdiarHora(e.target.value)} />
            <Button className="w-full" onClick={handleAdiarCustom} disabled={!adiarData}>Reagendar ✅</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
