import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, isToday, isTomorrow, isBefore, startOfDay, endOfWeek, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, MessageCircle, CheckCircle2, Clock, Calendar, ArrowRight, Building2, User, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

interface TarefaComLead {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  status: string;
  prioridade: string;
  vence_em: string | null;
  hora_vencimento: string | null;
  concluida_em: string | null;
  pipeline_lead_id: string;
  created_at: string;
  lead_nome?: string;
  lead_telefone?: string;
  lead_empreendimento?: string;
}

const TIPO_LABELS: Record<string, string> = {
  follow_up: "Follow-up",
  ligar: "Ligar",
  whatsapp: "WhatsApp",
  enviar_proposta: "Enviar proposta",
  enviar_material: "Enviar material",
  marcar_visita: "Marcar visita",
  outro: "Outro",
};

const TIPO_EMOJI: Record<string, string> = {
  follow_up: "🔄", ligar: "📞", whatsapp: "💬", enviar_proposta: "📄",
  enviar_material: "📎", marcar_visita: "📅", outro: "📋",
};

type TabFilter = "hoje" | "amanha" | "semana" | "atrasadas";

export default function MinhasTarefas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabFilter>("hoje");
  const [reagendarId, setReagendarId] = useState<string | null>(null);
  const [reagendarData, setReagendarData] = useState("");
  const [reagendarHora, setReagendarHora] = useState("");

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["minhas-tarefas", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Get all pending tasks for this user
      const { data, error } = await supabase
        .from("pipeline_tarefas")
        .select("*")
        .or(`responsavel_id.eq.${user.id},created_by.eq.${user.id}`)
        .in("status", ["pendente"])
        .order("vence_em", { ascending: true });

      if (error) { console.error("Erro tarefas:", error); return []; }
      const rows = (data || []) as any[];

      // Fetch lead names
      const leadIds = [...new Set(rows.map(r => r.pipeline_lead_id).filter(Boolean))];
      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("pipeline_leads")
          .select("id, nome, telefone, empreendimento")
          .in("id", leadIds);
        const leadMap = new Map((leads || []).map(l => [l.id, l]));
        rows.forEach(r => {
          const lead = leadMap.get(r.pipeline_lead_id);
          if (lead) {
            r.lead_nome = lead.nome;
            r.lead_telefone = lead.telefone;
            r.lead_empreendimento = lead.empreendimento;
          }
        });
      }
      return rows as TarefaComLead[];
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const atrasadas = useMemo(() => tarefas.filter(t => t.vence_em && isBefore(new Date(t.vence_em), todayStart)), [tarefas]);
  const hoje = useMemo(() => tarefas.filter(t => t.vence_em && isToday(new Date(t.vence_em))), [tarefas]);
  const amanha = useMemo(() => tarefas.filter(t => t.vence_em && isTomorrow(new Date(t.vence_em))), [tarefas]);
  const semana = useMemo(() => tarefas.filter(t => {
    if (!t.vence_em) return false;
    const d = new Date(t.vence_em);
    return d >= todayStart && d <= weekEnd;
  }), [tarefas]);

  const filteredTarefas = activeTab === "atrasadas" ? atrasadas : activeTab === "hoje" ? hoje : activeTab === "amanha" ? amanha : semana;

  const handleConcluir = async (id: string, leadId: string) => {
    const { error } = await supabase.from("pipeline_tarefas").update({
      status: "concluida",
      concluida_em: new Date().toISOString(),
    } as any).eq("id", id);
    if (error) { toast.error("Erro ao concluir"); return; }

    // Update lead ultima_acao_at
    await supabase.from("pipeline_leads").update({
      ultima_acao_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq("id", leadId);

    toast.success("Tarefa concluída ✅");
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
  };

  const handleReagendar = async () => {
    if (!reagendarId || !reagendarData) return;
    const { error } = await supabase.from("pipeline_tarefas").update({
      vence_em: reagendarData,
      hora_vencimento: reagendarHora || null,
    } as any).eq("id", reagendarId);
    if (error) { toast.error("Erro ao reagendar"); return; }
    toast.success("Tarefa reagendada ✅");
    setReagendarId(null);
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
  };

  const openWhatsApp = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    const full = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${full}`, "_blank");
  };

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: "hoje", label: "Hoje", count: hoje.length },
    { key: "amanha", label: "Amanhã", count: amanha.length },
    { key: "semana", label: "Esta Semana", count: semana.length },
    { key: "atrasadas", label: "🔴 Atrasadas", count: atrasadas.length },
  ];

  function formatPhone(phone: string) {
    const d = phone.replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    return phone;
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minhas Tarefas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe e gerencie seus follow-ups e ações</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "outline"}
            size="sm"
            className="text-sm gap-1.5"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <Badge variant="secondary" className="ml-1 text-xs">{tab.count}</Badge>
          </Button>
        ))}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filteredTarefas.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">🎉 Nenhuma tarefa {activeTab === "atrasadas" ? "atrasada" : "para este período"}!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTarefas.map(tarefa => {
            const isOverdue = tarefa.vence_em && isBefore(new Date(tarefa.vence_em), todayStart);
            return (
              <Card key={tarefa.id} className={`p-4 border ${isOverdue ? "border-red-300 bg-red-50/30 dark:bg-red-950/10" : "border-border/50"}`}>
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {tarefa.vence_em ? format(new Date(tarefa.vence_em), "dd/MM", { locale: ptBR }) : "Sem data"}
                        {tarefa.hora_vencimento && ` ${tarefa.hora_vencimento.slice(0, 5)}`}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {TIPO_EMOJI[tarefa.tipo] || "📋"} {TIPO_LABELS[tarefa.tipo] || tarefa.tipo}
                      </Badge>
                    </div>
                    <button onClick={() => navigate("/pipeline")} className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {tarefa.lead_nome || "Lead"}
                    </button>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {tarefa.lead_empreendimento && (
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{tarefa.lead_empreendimento}</span>
                      )}
                      {tarefa.lead_telefone && (
                        <span>{formatPhone(tarefa.lead_telefone)}</span>
                      )}
                    </div>
                    {tarefa.descricao && (
                      <p className="text-xs text-muted-foreground italic">"{tarefa.descricao}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {tarefa.lead_telefone && (
                      <>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ligar" onClick={() => window.open(`tel:${tarefa.lead_telefone}`, "_self")}>
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="WhatsApp" onClick={() => openWhatsApp(tarefa.lead_telefone!)}>
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => handleConcluir(tarefa.id, tarefa.pipeline_lead_id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => { setReagendarId(tarefa.id); setReagendarData(""); setReagendarHora(""); }}>
                      <Calendar className="h-3.5 w-3.5" /> Adiar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reagendar dialog */}
      <Dialog open={!!reagendarId} onOpenChange={() => setReagendarId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reagendar tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="date" value={reagendarData} onChange={e => setReagendarData(e.target.value)} />
            <Input type="time" value={reagendarHora} onChange={e => setReagendarHora(e.target.value)} placeholder="Horário (opcional)" />
            <Button className="w-full" onClick={handleReagendar} disabled={!reagendarData}>Reagendar ✅</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
