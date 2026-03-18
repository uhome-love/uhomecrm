import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, isToday, isTomorrow, isBefore, startOfDay, addHours } from "date-fns";
import { dateToBRT, parseDateBRT } from "@/lib/utils";
import { Phone, MessageCircle, CheckCircle2, Clock, ClipboardList, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  pipeline_lead_id?: string;
  negocio_id?: string;
  lead_nome?: string;
  lead_telefone?: string;
  lead_empreendimento?: string;
  negocio_nome?: string;
  _source: "lead" | "negocio";
}

const TIPO_EMOJI: Record<string, string> = {
  follow_up: "🔄", ligar: "📞", whatsapp: "💬", enviar_proposta: "📄",
  enviar_material: "📎", marcar_visita: "📅", confirmar_visita: "✅", retornar_cliente: "↩️",
  reuniao: "🤝", assinatura: "✍️", negociacao: "💰", outro: "📋",
};

const TIPO_LABELS: Record<string, string> = {
  follow_up: "Follow-up", ligar: "Ligar", whatsapp: "WhatsApp", enviar_proposta: "Enviar proposta",
  enviar_material: "Enviar material", marcar_visita: "Marcar visita", confirmar_visita: "Confirmar visita",
  retornar_cliente: "Retornar cliente", reuniao: "Reunião", assinatura: "Assinatura",
  negociacao: "Negociação", outro: "Outro",
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
  const [adiarSource, setAdiarSource] = useState<"lead" | "negocio">("lead");
  const [adiarData, setAdiarData] = useState("");
  const [adiarHora, setAdiarHora] = useState("");

  // Lead tasks
  const { data: tarefasLeads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["agenda-widget-leads", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("pipeline_tarefas")
        .select("*")
        .or(`responsavel_id.eq.${user.id},created_by.eq.${user.id}`)
        .eq("status", "pendente")
        .order("vence_em", { ascending: true })
        .order("hora_vencimento", { ascending: true })
        .limit(20);
      const rows = (data || []) as any[];
      const leadIds = [...new Set(rows.map(r => r.pipeline_lead_id).filter(Boolean))];
      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("pipeline_leads")
          .select("id, nome, telefone, empreendimento")
          .in("id", leadIds);
        const leadMap = new Map((leads as any[] || []).map(l => [l.id, l]));
        rows.forEach(r => {
          const lead = leadMap.get(r.pipeline_lead_id);
          if (lead) { r.lead_nome = lead.nome; r.lead_telefone = lead.telefone; r.lead_empreendimento = lead.empreendimento; }
        });
      }
      return rows.map(r => ({ ...r, _source: "lead" as const })) as TarefaAgenda[];
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // Negócio tasks
  const { data: tarefasNegocios = [], isLoading: loadingNegocios } = useQuery({
    queryKey: ["agenda-widget-negocios", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("negocios_tarefas")
        .select("*")
        .or(`responsavel_id.eq.${user.id},created_by.eq.${user.id}`)
        .eq("status", "pendente")
        .order("vence_em", { ascending: true })
        .order("hora_vencimento", { ascending: true })
        .limit(20);
      const rows = (data || []) as any[];
      const negIds = [...new Set(rows.map(r => r.negocio_id).filter(Boolean))];
      if (negIds.length > 0) {
        const { data: negs } = await supabase
          .from("negocios")
          .select("id, nome_cliente")
          .in("id", negIds);
        const negMap = new Map((negs as any[] || []).map(n => [n.id, n]));
        rows.forEach(r => {
          const neg = negMap.get(r.negocio_id);
          if (neg) { r.negocio_nome = neg.nome_cliente; }
        });
      }
      return rows.map(r => ({ ...r, _source: "negocio" as const })) as TarefaAgenda[];
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const now = new Date();
  const todayStart = startOfDay(now);

  const classify = (tarefas: TarefaAgenda[]) => {
    const atrasadas = tarefas.filter(t => {
      if (!t.vence_em) return false;
      const d = parseDateBRT(t.vence_em);
      if (isBefore(d, todayStart)) return true;
      if (isToday(d) && t.hora_vencimento) {
        const [h, m] = t.hora_vencimento.split(":").map(Number);
        const taskTime = new Date(d); taskTime.setHours(h, m, 0);
        return isBefore(taskTime, now);
      }
      return false;
    });
    const proximas = tarefas.filter(t => {
      if (!t.vence_em) return false;
      const d = parseDateBRT(t.vence_em);
      if (!isToday(d)) return false;
      if (!t.hora_vencimento) return true;
      const [h, m] = t.hora_vencimento.split(":").map(Number);
      const taskTime = new Date(d); taskTime.setHours(h, m, 0);
      return !isBefore(taskTime, now);
    });
    const amanha = tarefas.filter(t => t.vence_em && isTomorrow(parseDateBRT(t.vence_em)));
    return { atrasadas, proximas, amanha, totalHoje: atrasadas.length + proximas.length };
  };

  const leadsClassified = useMemo(() => classify(tarefasLeads), [tarefasLeads, now]);
  const negociosClassified = useMemo(() => classify(tarefasNegocios), [tarefasNegocios, now]);

  const handleConcluir = async (t: TarefaAgenda) => {
    const table = t._source === "negocio" ? "negocios_tarefas" : "pipeline_tarefas";
    await supabase.from(table).update({ status: "concluida", concluida_em: new Date().toISOString() } as any).eq("id", t.id);
    if (t._source === "lead" && t.pipeline_lead_id) {
      await supabase.from("pipeline_leads").update({ ultima_acao_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any).eq("id", t.pipeline_lead_id);
    }
    toast.success("Tarefa concluída ✅");
    queryClient.invalidateQueries({ queryKey: ["agenda-widget-leads"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-widget-negocios"] });
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
  };

  const handleAdiarRapido = async (id: string, horas: number, source: "lead" | "negocio") => {
    const table = source === "negocio" ? "negocios_tarefas" : "pipeline_tarefas";
    const novaData = addHours(new Date(), horas);
    await supabase.from(table).update({
      vence_em: dateToBRT(novaData),
      hora_vencimento: format(novaData, "HH:mm"),
    } as any).eq("id", id);
    toast.success("Tarefa adiada ✅");
    queryClient.invalidateQueries({ queryKey: ["agenda-widget-leads"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-widget-negocios"] });
  };

  const handleAdiarCustom = async () => {
    if (!adiarId || !adiarData) return;
    const table = adiarSource === "negocio" ? "negocios_tarefas" : "pipeline_tarefas";
    await supabase.from(table).update({
      vence_em: adiarData,
      hora_vencimento: adiarHora || null,
    } as any).eq("id", adiarId);
    toast.success("Tarefa reagendada ✅");
    setAdiarId(null);
    queryClient.invalidateQueries({ queryKey: ["agenda-widget-leads"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-widget-negocios"] });
  };

  const renderTarefa = (t: TarefaAgenda, variant: "atrasada" | "proxima" | "futura") => {
    const borderClass = variant === "atrasada" ? "border-l-red-500 bg-red-500/10" :
      variant === "proxima" ? "border-l-yellow-500 bg-yellow-500/10" : "border-l-muted-foreground/40 bg-muted/30";
    const timeIcon = variant === "atrasada" ? "🔴" : variant === "proxima" ? "🟡" : "⚪";
    const nome = t._source === "negocio" ? (t.negocio_nome || "Negócio") : (t.lead_nome || "Lead");
    const empreendimento = t._source === "lead" ? t.lead_empreendimento : null;

    return (
      <div key={t.id} className={`border-l-[3px] rounded-r-lg p-2.5 space-y-1 ${borderClass}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            {timeIcon} {t.hora_vencimento ? t.hora_vencimento.slice(0, 5) : "—"} · {TIPO_LABELS[t.tipo] || t.tipo}
          </span>
          <Badge variant="outline" className="text-[10px]">{TIPO_EMOJI[t.tipo] || "📋"}</Badge>
        </div>
        <p className="text-sm font-semibold text-foreground truncate">
          {t._source === "negocio" ? "💼" : "👤"} {nome} {empreendimento ? `· ${empreendimento}` : ""}
        </p>
        {t.descricao && <p className="text-xs text-muted-foreground italic truncate">📝 {t.descricao}</p>}
        <div className="flex items-center gap-1 pt-1">
          {t._source === "lead" && t.lead_telefone && (
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
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { setAdiarId(t.id); setAdiarSource(t._source); setAdiarData(""); setAdiarHora(""); }}>
            <Clock className="h-3 w-3" /> Adiar
          </Button>
        </div>
      </div>
    );
  };

  const renderSection = (classified: ReturnType<typeof classify>, sourceLabel: string) => {
    const { atrasadas, proximas, amanha, totalHoje } = classified;
    if (totalHoje === 0 && amanha.length === 0) {
      return (
        <div className="text-center py-4 space-y-2">
          <div className="text-3xl">✅</div>
          <p className="text-sm font-bold text-foreground">Tudo em dia!</p>
          <p className="text-xs text-muted-foreground">Nenhuma tarefa de {sourceLabel} pendente.</p>
        </div>
      );
    }
    return (
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
                ⚪ {t.hora_vencimento?.slice(0, 5) || "—"} · {TIPO_LABELS[t.tipo] || t.tipo}: {t._source === "negocio" ? (t.negocio_nome || "Negócio") : (t.lead_nome || "Lead")}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loadingLeads && loadingNegocios) return null;

  const totalLeadsHoje = leadsClassified.totalHoje;
  const totalNegociosHoje = negociosClassified.totalHoje;

  return (
    <>
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4 text-primary" /> Tarefas
            </h3>
            <Badge variant={totalLeadsHoje + totalNegociosHoje > 0 ? "default" : "secondary"} className="text-xs">
              Hoje · {totalLeadsHoje + totalNegociosHoje} 📌
            </Badge>
          </div>

          <Tabs defaultValue="leads" className="w-full">
            <TabsList className="h-8 w-full">
              <TabsTrigger value="leads" className="text-xs flex-1">
                👤 Leads {totalLeadsHoje > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{totalLeadsHoje}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="negocios" className="text-xs flex-1">
                💼 Negócios {totalNegociosHoje > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{totalNegociosHoje}</Badge>}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="leads" className="mt-2">
              {renderSection(leadsClassified, "leads")}
            </TabsContent>
            <TabsContent value="negocios" className="mt-2">
              {renderSection(negociosClassified, "negócios")}
            </TabsContent>
          </Tabs>

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
              <Button variant="outline" size="sm" onClick={() => { handleAdiarRapido(adiarId!, 1, adiarSource); setAdiarId(null); }}>Daqui 1h</Button>
              <Button variant="outline" size="sm" onClick={() => { handleAdiarRapido(adiarId!, 2, adiarSource); setAdiarId(null); }}>Daqui 2h</Button>
              <Button variant="outline" size="sm" onClick={() => { handleAdiarRapido(adiarId!, 24, adiarSource); setAdiarId(null); }}>Amanhã</Button>
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
