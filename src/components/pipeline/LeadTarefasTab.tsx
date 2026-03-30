import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus, CheckCircle2, Circle, Trash2, Clock, Phone, MessageCircle,
  Mail, Calendar, ChevronDown, ChevronUp, Loader2, Pencil
} from "lucide-react";
import { format, isBefore, startOfDay, addHours, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dateToBRT, todayBRT, parseDateBRT } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { PipelineTarefa } from "@/hooks/usePipelineLeadData";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TIPO_BUTTONS = [
  { value: "ligar", label: "Ligar", emoji: "📞" },
  { value: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { value: "enviar_material", label: "Email", emoji: "✉️" },
  { value: "follow_up", label: "Follow-up", emoji: "📋" },
  { value: "enviar_proposta", label: "Proposta", emoji: "📄" },
  { value: "marcar_visita", label: "Visita", emoji: "🏠" },
];

const TIPO_LABELS: Record<string, string> = {
  follow_up: "Follow-up", ligar: "Ligar", whatsapp: "WhatsApp",
  enviar_proposta: "Enviar proposta", enviar_material: "Enviar material",
  marcar_visita: "Marcar visita", confirmar_visita: "Confirmar visita",
  retornar_cliente: "Retornar cliente", outro: "Outro",
};

const TIPO_EMOJI: Record<string, string> = {
  follow_up: "🔄", ligar: "📞", whatsapp: "💬", enviar_proposta: "📄",
  enviar_material: "✉️", marcar_visita: "📅", confirmar_visita: "✅",
  retornar_cliente: "↩️", outro: "📋",
};

interface Props {
  leadId: string;
  leadNome: string;
  leadTelefone?: string | null;
  leadEmail?: string | null;
  tarefas: PipelineTarefa[];
  onAddTarefa: (data: Partial<PipelineTarefa>) => Promise<void>;
  onToggleTarefa: (id: string, status: string) => Promise<void>;
  onDeleteTarefa: (id: string) => Promise<void>;
  onReload: () => void;
  onNextAction?: () => void;
}

export default function LeadTarefasTab({ leadId, leadNome, leadTelefone, leadEmail, tarefas, onAddTarefa, onToggleTarefa, onDeleteTarefa, onReload, onNextAction }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState("follow_up");
  const [customTipo, setCustomTipo] = useState("");
  const [venceEm, setVenceEm] = useState("");
  const [horaVencimento, setHoraVencimento] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    now.setMinutes(Math.round(now.getMinutes() / 15) * 15);
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [obs, setObs] = useState("");
  const [showConcluidas, setShowConcluidas] = useState(false);
  const [adiarId, setAdiarId] = useState<string | null>(null);
  const [adiarData, setAdiarData] = useState("");
  const [adiarHora, setAdiarHora] = useState("");
  // Edit task state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTipo, setEditTipo] = useState("follow_up");
  const [editData, setEditData] = useState("");
  const [editHora, setEditHora] = useState("");
  const [editObs, setEditObs] = useState("");

  // Completion prompt
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState("");

  const today = startOfDay(new Date());
  const pendentes = tarefas.filter(t => t.status === "pendente");
  const concluidas = tarefas.filter(t => t.status === "concluida");
  const atrasadas = pendentes.filter(t => t.vence_em && isBefore(parseDateBRT(t.vence_em), today));
  const proximas = pendentes.filter(t => !t.vence_em || !isBefore(parseDateBRT(t.vence_em), today));

  const whatsappUrl = leadTelefone ? `https://wa.me/${leadTelefone.replace(/\D/g, "")}` : null;

  const handleQuickDate = (label: string) => {
    const now = new Date();
    if (label === "hoje") {
      setVenceEm(todayBRT());
    } else if (label === "amanha") {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setVenceEm(dateToBRT(tomorrow));
    }
  };

  const handleCreate = async () => {
    const finalTipo = tipo === "outro" ? "outro" : tipo;
    const titulo = tipo === "outro" && customTipo ? customTipo : `${TIPO_LABELS[finalTipo] || finalTipo}: ${leadNome}`;
    await onAddTarefa({
      titulo,
      descricao: obs || null,
      tipo: finalTipo,
      vence_em: venceEm || null,
      hora_vencimento: horaVencimento || null,
      prioridade: "media",
    } as any);

    // Update proxima_acao on the lead
    if (venceEm) {
      await supabase.from("pipeline_leads").update({
        proxima_acao: TIPO_LABELS[finalTipo] || titulo,
        data_proxima_acao: venceEm,
        updated_at: new Date().toISOString(),
      } as any).eq("id", leadId);
    }

    setShowForm(false);
    setTipo("follow_up");
    setCustomTipo("");
    setVenceEm("");
    setHoraVencimento("");
    setObs("");
  };

  const handleConcluir = async (tarefa: PipelineTarefa) => {
    setCompletingId(tarefa.id);
    setCompletionNote("");
  };

  const confirmConcluir = async () => {
    if (!completingId) return;
    await onToggleTarefa(completingId, "pendente");

    // Update lead
    await supabase.from("pipeline_leads").update({
      ultima_acao_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq("id", leadId);

    // Register in history if note provided
    if (completionNote.trim()) {
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: leadId,
        tipo: "followup",
        titulo: completionNote.trim(),
        descricao: null,
        data: todayBRT(),
        hora: new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
        prioridade: "media",
        status: "concluida",
        created_by: (await (supabase.auth as any).getUser()).data?.user?.id || "",
      } as any);
    }

    toast.success("Tarefa concluída ✅");
    setCompletingId(null);
    setCompletionNote("");
    onReload();
    // Only prompt next action if no more pending tasks remain after this one
    const remainingPending = pendentes.filter(t => t.id !== completingId);
    if (remainingPending.length === 0) {
      onNextAction?.();
    }
  };

  const handleAdiarRapido = async (id: string, horas: number) => {
    const novaData = addHours(new Date(), horas);
    await supabase.from("pipeline_tarefas").update({
      vence_em: dateToBRT(novaData),
      hora_vencimento: format(novaData, "HH:mm"),
    } as any).eq("id", id);
    toast.success("Tarefa adiada ✅");
    onReload();
  };

  const handleAdiarCustom = async () => {
    if (!adiarId || !adiarData) return;
    await supabase.from("pipeline_tarefas").update({
      vence_em: adiarData,
      hora_vencimento: adiarHora || null,
    } as any).eq("id", adiarId);
    toast.success("Tarefa reagendada ✅");
    setAdiarId(null);
    onReload();
  };

  const handleEditSave = async () => {
    if (!editId) return;
    const finalTipo = editTipo;
    const titulo = `${TIPO_LABELS[finalTipo] || finalTipo}: ${leadNome}`;
    await supabase.from("pipeline_tarefas").update({
      tipo: finalTipo,
      titulo,
      descricao: editObs || null,
      vence_em: editData || null,
      hora_vencimento: editHora || null,
    } as any).eq("id", editId);
    toast.success("Tarefa atualizada ✅");
    setEditId(null);
    onReload();
  };

  const renderTarefa = (tarefa: PipelineTarefa) => {
    const isOverdue = tarefa.status === "pendente" && tarefa.vence_em && isBefore(parseDateBRT(tarefa.vence_em), today);
    const isConcluida = tarefa.status === "concluida";
    const horaRaw = (tarefa as any).hora_vencimento;
    const timeLabel = horaRaw ? horaRaw.slice(0, 5) : "";
    const venceDate = tarefa.vence_em ? parseDateBRT(tarefa.vence_em) : null;
    const dateLabel = venceDate
      ? isToday(venceDate) ? (timeLabel ? `Hoje às ${timeLabel}` : "Hoje")
      : isTomorrow(venceDate) ? (timeLabel ? `Amanhã às ${timeLabel}` : "Amanhã")
      : format(venceDate, "dd/MM", { locale: ptBR }) + (timeLabel ? ` às ${timeLabel}` : "")
      : "Sem data";

    return (
      <div key={tarefa.id} className={`p-3 rounded-xl border transition-colors ${
        isConcluida ? "bg-green-50/50 dark:bg-green-950/20 border-green-200/50 opacity-70"
        : isOverdue ? "bg-red-50/50 dark:bg-red-950/20 border-red-300/60"
        : "border-border/50 bg-card hover:bg-accent/20"
      }`}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
              {isOverdue && "⏰ "}{dateLabel}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-medium text-primary/70">
              {TIPO_EMOJI[(tarefa as any).tipo] || "📋"} {TIPO_LABELS[(tarefa as any).tipo] || "Tarefa"}
            </span>
          </div>

          {(tarefa.descricao || tarefa.titulo) && (
            <p className={`text-sm ${isConcluida ? "text-muted-foreground" : "text-foreground"}`}>
              📝 {tarefa.descricao || tarefa.titulo}
            </p>
          )}

          {isConcluida && tarefa.concluida_em && (() => {
            try {
              const d = new Date(tarefa.concluida_em);
              if (Number.isNaN(d.getTime())) return <span className="text-xs text-green-600">✅ Concluída</span>;
              return <span className="text-xs text-green-600">✅ {format(d, "dd/MM 'às' HH:mm", { locale: ptBR })}</span>;
            } catch { return <span className="text-xs text-green-600">✅ Concluída</span>; }
          })()}

          {!isConcluida && (
            <div className="flex items-center gap-1 pt-1 flex-wrap">
              <button
                onClick={() => handleConcluir(tarefa)}
                style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', background: '#4F46E5', color: '#fff', border: 'none', fontWeight: 600 }}
              >
                <CheckCircle2 className="h-3 w-3" /> Feito
              </button>
              <button onClick={() => {
                setEditId(tarefa.id);
                setEditTipo((tarefa as any).tipo || "follow_up");
                setEditData(tarefa.vence_em || "");
                setEditHora((tarefa as any).hora_vencimento?.slice(0, 5) || "");
                setEditObs(tarefa.descricao || "");
              }} style={{ padding: '4px 8px', fontSize: 11, color: 'var(--muted-foreground)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Pencil className="h-3 w-3" /> Editar
              </button>
              <button onClick={() => { setAdiarId(tarefa.id); setAdiarData(""); setAdiarHora(""); }} style={{ padding: '4px 8px', fontSize: 11, color: 'var(--muted-foreground)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Calendar className="h-3 w-3" /> Adiar
              </button>
              <button onClick={() => onDeleteTarefa(tarefa.id)} style={{ padding: '4px 4px', fontSize: 11, color: 'var(--muted-foreground)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-6 pb-8 space-y-4 mt-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground">📋 Tarefas ({pendentes.length} pendentes)</h4>
        <Button variant="outline" size="sm" className="h-9 text-sm gap-1.5" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> Nova Tarefa
        </Button>
      </div>

      {/* Create form — inline */}
      {showForm && (
        <div className="border border-primary/30 rounded-xl p-4 space-y-3 bg-primary/5">
          <p className="text-xs font-semibold text-foreground">➕ Nova Tarefa para {leadNome}</p>

          {/* Tipo buttons */}
          <div>
            <label className="text-xs text-muted-foreground font-medium">O que fazer:</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {TIPO_BUTTONS.map(t => (
                <button
                  key={t.value}
                  onClick={() => { setTipo(t.value); setCustomTipo(""); }}
                  className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                    tipo === t.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/50"
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
              <button
                onClick={() => setTipo("outro")}
                className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                  tipo === "outro"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-dashed border-muted-foreground/40 hover:border-primary/50"
                }`}
              >
                ✏️ Outro
              </button>
            </div>
            {tipo === "outro" && (
              <Input className="h-8 text-sm mt-2" placeholder="Descreva a tarefa..." value={customTipo} onChange={e => setCustomTipo(e.target.value)} autoFocus />
            )}
          </div>

          {/* Date buttons */}
          <div>
            <label className="text-xs text-muted-foreground font-medium">Quando:</label>
            <div className="flex items-center gap-1.5 mt-1">
              <button
                onClick={() => handleQuickDate("hoje")}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${venceEm === todayBRT() ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"}`}
              >
                Hoje
              </button>
              <button
                onClick={() => handleQuickDate("amanha")}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  (() => { const t = new Date(); t.setDate(t.getDate() + 1); return venceEm === dateToBRT(t); })()
                    ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                }`}
              >
                Amanhã
              </button>
              <Input type="date" className="h-8 text-xs w-36" value={venceEm} onChange={e => setVenceEm(e.target.value)} />
              <Input type="time" className="h-8 text-xs w-24" value={horaVencimento} onChange={e => setHoraVencimento(e.target.value)} />
            </div>
          </div>

          {/* Obs */}
          <div>
            <label className="text-xs text-muted-foreground font-medium">Observação:</label>
            <Input className="h-8 text-sm mt-1" placeholder="Ex: Retornar sobre financiamento" value={obs} onChange={e => setObs(e.target.value)} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleCreate} disabled={tipo === "outro" && !customTipo}>✅ Criar Tarefa</Button>
          </div>
        </div>
      )}

      {/* Atrasadas */}
      {atrasadas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-destructive uppercase tracking-wider flex items-center gap-1.5">
            🔴 Atrasadas ({atrasadas.length})
          </p>
          {atrasadas.map(renderTarefa)}
        </div>
      )}

      {/* Próximas */}
      {proximas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            ⏰ Próximas ({proximas.length})
          </p>
          {proximas.map(renderTarefa)}
        </div>
      )}

      {/* Empty */}
      {pendentes.length === 0 && !showForm && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">📋 Sem tarefas pendentes</p>
          <Button variant="link" size="sm" className="text-xs mt-1" onClick={() => setShowForm(true)}>
            ➕ Criar primeira tarefa
          </Button>
        </div>
      )}

      {/* Concluídas */}
      {concluidas.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowConcluidas(!showConcluidas)}
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
          >
            ✅ Concluídas ({concluidas.length})
            {showConcluidas ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showConcluidas && concluidas.slice(0, 5).map(renderTarefa)}
        </div>
      )}

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

      {/* Edit task dialog */}
      <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>✏️ Editar tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium">Tipo:</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {TIPO_BUTTONS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setEditTipo(t.value)}
                    className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                      editTipo === t.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:border-primary/50"
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground font-medium">Data:</label>
                <Input type="date" value={editData} onChange={e => setEditData(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">Hora:</label>
                <Input type="time" value={editHora} onChange={e => setEditHora(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Observação:</label>
              <Textarea
                value={editObs}
                onChange={e => setEditObs(e.target.value)}
                rows={2}
                className="text-xs mt-1"
                placeholder="Detalhes da tarefa..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditId(null)}>Cancelar</Button>
              <Button size="sm" onClick={handleEditSave}>💾 Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Completion prompt */}
      <Dialog open={!!completingId} onOpenChange={() => setCompletingId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>✅ O que aconteceu?</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Registre brevemente o resultado (opcional — será salvo no histórico)</p>
            <Textarea
              placeholder="Ex: Cliente atendeu, pediu proposta por email"
              value={completionNote}
              onChange={e => setCompletionNote(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { confirmConcluir(); }}>
                Pular
              </Button>
              <Button size="sm" onClick={confirmConcluir}>
                💾 Salvar e concluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
