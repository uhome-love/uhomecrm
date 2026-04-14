import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Phone, Pencil, Check, X, ExternalLink,
  CheckCircle2, Clock, MessageSquare, Home, PhoneCall,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadInfo {
  id: string;
  nome: string;
  telefone: string;
  empreendimento: string | null;
  stage_id: string | null;
  segmento_id?: string | null;
  lead_score?: number | null;
  valor_estimado?: number | null;
  bairro_regiao?: string | null;
  orcamento?: number | null;
}

interface Message {
  id: string;
  body: string | null;
  direction: string;
  timestamp: string;
}

interface StageInfo {
  id: string;
  nome: string;
}

interface Task {
  id: string;
  titulo: string;
  vence_em: string | null;
  status: string;
}

interface Activity {
  id: string;
  tipo: string;
  titulo: string;
  created_at: string;
}

interface LeadPanelProps {
  lead: LeadInfo | null;
  leadId?: string | null;
  profileId?: string | null;
  messages?: Message[];
  onOpenFullModal?: (leadId: string) => void;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

// --- Score helpers ---

function getScoreColor(score: number) {
  if (score <= 30) return "bg-red-500";
  if (score <= 60) return "bg-yellow-500";
  if (score <= 80) return "bg-green-500";
  return "bg-blue-500";
}

function getScoreLabel(score: number) {
  if (score <= 30) return "Frio ❄️";
  if (score <= 60) return "Morno 🌤️";
  if (score <= 80) return "Interessado 🔥";
  return "Pronto para fechar 💎";
}

function getActivityIcon(tipo: string) {
  switch (tipo) {
    case "ligacao": return <PhoneCall size={12} className="text-muted-foreground" />;
    case "mensagem": return <MessageSquare size={12} className="text-muted-foreground" />;
    case "visita": return <Home size={12} className="text-muted-foreground" />;
    default: return <CheckCircle2 size={12} className="text-muted-foreground" />;
  }
}

export default function LeadPanel({ lead, leadId, profileId, messages = [], onOpenFullModal }: LeadPanelProps) {
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  // Inline editing
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Local lead state for optimistic updates
  const [localLead, setLocalLead] = useState<LeadInfo | null>(null);

  useEffect(() => {
    setLocalLead(lead);
  }, [lead]);

  // Load stages
  useEffect(() => {
    supabase
      .from("pipeline_stages")
      .select("id, nome")
      .eq("pipeline_tipo", "leads")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .then(({ data }) => { if (data) setStages(data); });
  }, []);

  // Load tasks
  const loadTasks = useCallback(async () => {
    const lid = leadId || lead?.id;
    if (!lid) { setTasks([]); return; }
    const { data } = await supabase
      .from("pipeline_tarefas")
      .select("id, titulo, vence_em, status")
      .eq("pipeline_lead_id", lid)
      .eq("status", "pendente")
      .order("vence_em", { ascending: true })
      .limit(3);
    setTasks((data as Task[]) || []);
  }, [leadId, lead?.id]);

  // Load activities
  const loadActivities = useCallback(async () => {
    const lid = leadId || lead?.id;
    if (!lid) { setActivities([]); return; }
    const { data } = await supabase
      .from("pipeline_atividades")
      .select("id, tipo, titulo, created_at")
      .eq("pipeline_lead_id", lid)
      .order("created_at", { ascending: false })
      .limit(3);
    setActivities((data as Activity[]) || []);
  }, [leadId, lead?.id]);

  useEffect(() => {
    loadTasks();
    loadActivities();
  }, [loadTasks, loadActivities]);

  // --- Score ---
  const totalMsgs = messages.length;
  const receivedMsgs = messages.filter(m => m.direction === "received").length;
  const score = totalMsgs > 0 ? Math.min(Math.round((receivedMsgs / totalMsgs) * 100), 100) : 0;

  // --- Handlers ---

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const saveField = async (field: string) => {
    if (!localLead) return;
    try {
      const updateData: Record<string, any> = {};
      if (field === "stage_id") updateData.stage_id = editValue;
      else if (field === "empreendimento") updateData.empreendimento = editValue;
      else if (field === "orcamento") updateData.orcamento = parseFloat(editValue) || 0;

      await supabase.from("pipeline_leads").update(updateData).eq("id", localLead.id);

      setLocalLead(prev => prev ? { ...prev, ...updateData } : null);
      toast.success("✅ Atualizado!");
      cancelEdit();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    }
  };

  const completeTask = async (taskId: string) => {
    try {
      await supabase.from("pipeline_tarefas").update({
        status: "concluida",
        concluida_em: new Date().toISOString(),
      }).eq("id", taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success("✅ Tarefa concluída!");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    }
  };

  const currentStageName = stages.find(s => s.id === localLead?.stage_id)?.nome || "—";

  if (!localLead) {
    return (
      <div className="w-[240px] border-l border-border bg-muted/30 flex items-center justify-center p-4 h-full min-h-0">
        <p className="text-xs text-muted-foreground text-center">Selecione uma conversa para ver os dados do lead</p>
      </div>
    );
  }

  return (
    <div className="w-[240px] border-l border-border bg-muted/30 overflow-y-auto flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="p-3 border-b border-border flex flex-col items-center gap-1.5">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {getInitials(localLead.nome)}
          </AvatarFallback>
        </Avatar>
        <h3 className="font-semibold text-sm text-center">{localLead.nome}</h3>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Phone size={10} />
          <span>{localLead.telefone}</span>
        </div>
      </div>

      {/* Section 1: Editable fields */}
      <div className="p-3 border-b border-border space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Dados</p>

        {/* Etapa */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] text-muted-foreground shrink-0">Etapa</span>
          {editingField === "stage_id" ? (
            <div className="flex items-center gap-0.5 flex-1 min-w-0">
              <Select value={editValue} onValueChange={setEditValue}>
                <SelectTrigger className="h-6 text-[11px] flex-1 min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => saveField("stage_id")}><Check size={10} /></Button>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={cancelEdit}><X size={10} /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <span className="text-[11px] font-medium truncate max-w-[100px]">{currentStageName}</span>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => startEdit("stage_id", localLead.stage_id || "")}>
                <Pencil size={9} />
              </Button>
            </div>
          )}
        </div>

        {/* Empreendimento */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] text-muted-foreground shrink-0">Empreend.</span>
          {editingField === "empreendimento" ? (
            <div className="flex items-center gap-0.5 flex-1 min-w-0">
              <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="h-6 text-[11px] flex-1 min-w-0" />
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => saveField("empreendimento")}><Check size={10} /></Button>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={cancelEdit}><X size={10} /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <span className="text-[11px] font-medium truncate max-w-[100px]">{localLead.empreendimento || "—"}</span>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => startEdit("empreendimento", localLead.empreendimento || "")}>
                <Pencil size={9} />
              </Button>
            </div>
          )}
        </div>

        {/* Orçamento */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] text-muted-foreground shrink-0">Orçamento</span>
          {editingField === "orcamento" ? (
            <div className="flex items-center gap-0.5 flex-1 min-w-0">
              <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="h-6 text-[11px] flex-1 min-w-0" />
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => saveField("orcamento")}><Check size={10} /></Button>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={cancelEdit}><X size={10} /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <span className="text-[11px] font-medium truncate max-w-[100px]">
                {localLead.orcamento ? `R$ ${Number(localLead.orcamento).toLocaleString("pt-BR")}` : "—"}
              </span>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => startEdit("orcamento", String(localLead.orcamento || ""))}>
                <Pencil size={9} />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Score HOMI */}
      <div className="p-3 border-b border-border space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Score HOMI</span>
          <span className="text-[11px] font-bold">{score}/100</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getScoreColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground text-center">{getScoreLabel(score)}</p>
      </div>

      {/* Section 3: Tasks */}
      <div className="p-3 border-b border-border space-y-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Tarefas pendentes</p>
        {tasks.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">Nenhuma tarefa pendente</p>
        ) : (
          tasks.map(t => (
            <div key={t.id} className="flex items-center gap-1.5 group">
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 shrink-0 opacity-60 hover:opacity-100"
                onClick={() => completeTask(t.id)}
              >
                <CheckCircle2 size={12} />
              </Button>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] truncate">{t.titulo}</p>
                {t.vence_em && (
                  <p className="text-[9px] text-muted-foreground">
                    {formatDistanceToNow(new Date(t.vence_em), { addSuffix: true, locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Section 4: History */}
      {activities.length > 0 && (
        <div className="p-3 border-b border-border space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Histórico</p>
          {activities.map(a => (
            <div key={a.id} className="flex items-start gap-1.5">
              {getActivityIcon(a.tipo)}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] truncate">{a.titulo}</p>
                <p className="text-[9px] text-muted-foreground">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section 5: Full profile button */}
      <div className="p-3 mt-auto">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-8"
          onClick={() => onOpenFullModal?.(localLead.id)}
        >
          <ExternalLink size={12} /> Ver ficha completa
        </Button>
      </div>
    </div>
  );
}
