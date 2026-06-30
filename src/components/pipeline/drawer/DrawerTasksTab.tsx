// ─────────────────────────────────────────────────────────────────
// DrawerTasksTab — Aba Tarefas editorial v4
// Agrupa por prazo: atrasadas / hoje / amanhã / esta semana / próximas
// ─────────────────────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { CheckCircle2, Pencil, Trash2, Clock, Plus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { PipelineTarefa } from "@/hooks/usePipelineLeadData";
import { groupTasksByDeadline, formatTaskDeadline } from "@/lib/taskGrouping";
import { invalidateTaskQueries } from "@/lib/taskQueryUtils";
import TaskCompletionDialog from "../TaskCompletionDialog";
import type { CompletionPayload, TipoProximaTarefa } from "../task-completion/types";
import { runTaskCompletion } from "@/lib/taskCompletion";

interface Props {
  tarefas: PipelineTarefa[];
  leadId: string;
  leadNome: string;
  leadStageId?: string | null;
  onAddTarefa: (input: {
    tipo: TipoProximaTarefa;
    titulo: string;
    descricao?: string | null;
    vence_em: string;
    hora_vencimento?: string | null;
  }) => Promise<unknown>;
  /** Mantido para casos edge (não usado pelo botão Feito, que abre o modal). */
  onToggleTarefa: (id: string, status: string) => Promise<void>;
  onDeleteTarefa: (id: string) => Promise<void>;
  onReload: () => void;
  onNovaTarefa: () => void;
  loading?: boolean;
}

type TipoCanon = "call" | "msg" | "followup" | "visit" | "outro";

const TIPO_MAP: Record<string, TipoCanon> = {
  ligar: "call",
  ligacao: "call",
  retornar_cliente: "call",
  whatsapp: "msg",
  enviar_material: "msg",
  enviar_proposta: "msg",
  email: "msg",
  proposta: "msg",
  follow_up: "followup",
  marcar_visita: "visit",
  confirmar_visita: "visit",
  visita: "visit",
};

const TIPO_LABEL: Record<TipoCanon, string> = {
  call: "Ligação",
  msg: "WhatsApp",
  followup: "Follow-up",
  visit: "Visita",
  outro: "Tarefa",
};

const TIPO_EMOJI: Record<TipoCanon, string> = {
  call: "📞",
  msg: "💬",
  followup: "📨",
  visit: "🏠",
  outro: "📝",
};

const TIPO_CIRCLE: Record<TipoCanon, string> = {
  call: "bg-red-100 text-red-600",
  msg: "bg-indigo-100 text-indigo-600",
  followup: "bg-purple-100 text-purple-700",
  visit: "bg-emerald-100 text-emerald-600",
  outro: "bg-zinc-100 text-zinc-500",
};

const TIPO_BADGE: Record<TipoCanon, string> = {
  call: "bg-red-100 text-red-600",
  msg: "bg-indigo-100 text-indigo-600",
  followup: "bg-purple-100 text-purple-700",
  visit: "bg-emerald-100 text-emerald-600",
  outro: "bg-zinc-100 text-zinc-500",
};

const TIPO_OPTIONS: { value: string; label: string }[] = [
  { value: "ligar", label: "Ligar" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "enviar_material", label: "Email" },
  { value: "follow_up", label: "Follow-up" },
  { value: "enviar_proposta", label: "Proposta" },
  { value: "marcar_visita", label: "Visita" },
  { value: "outro", label: "Outro" },
];

function canonTipo(tipo: string): TipoCanon {
  return TIPO_MAP[tipo] ?? "outro";
}

const GROUPS: Array<{ key: keyof ReturnType<typeof groupTasksByDeadline>; icon: string; label: string; color: string }> = [
  { key: "atrasadas", icon: "⚠️", label: "Atrasadas", color: "text-red-600" },
  { key: "hoje", icon: "📅", label: "Hoje", color: "text-amber-700" },
  { key: "amanha", icon: "⏰", label: "Amanhã", color: "text-indigo-600" },
  { key: "semana", icon: "📌", label: "Esta semana", color: "text-zinc-500" },
  { key: "proximas", icon: "📅", label: "Próximas", color: "text-zinc-500" },
];

export default function DrawerTasksTab({
  tarefas,
  leadId,
  leadNome,
  leadStageId,
  onAddTarefa,
  onToggleTarefa: _onToggleTarefa, // eslint-disable-line @typescript-eslint/no-unused-vars
  onDeleteTarefa,
  onReload,
  onNovaTarefa,
  loading = false,
}: Props) {
  const queryClient = useQueryClient();
  const grouped = useMemo(() => groupTasksByDeadline(tarefas), [tarefas]);
  const countAtrasadas = grouped.atrasadas.length;
  const countHoje = grouped.hoje.length;
  const countProximas = grouped.amanha.length + grouped.semana.length + grouped.proximas.length;
  const totalPendentes = countAtrasadas + countHoje + countProximas;
  const concluidas = useMemo(
    () =>
      tarefas
        .filter((t) => t.status === "concluida")
        .sort((a, b) => (b.concluida_em || b.vence_em || "").localeCompare(a.concluida_em || a.vence_em || "")),
    [tarefas],
  );

  const [editTarefa, setEditTarefa] = useState<PipelineTarefa | null>(null);
  const [adiarTarefa, setAdiarTarefa] = useState<PipelineTarefa | null>(null);
  const [completingTarefa, setCompletingTarefa] = useState<PipelineTarefa | null>(null);
  const [showConcluidas, setShowConcluidas] = useState(false);

  async function handleCompletionConfirm(payload: CompletionPayload) {
    if (!completingTarefa) return;
    const result = await runTaskCompletion(
      {
        tarefaId: completingTarefa.id,
        tarefaTitulo: completingTarefa.titulo,
        leadId,
        leadNome,
        leadStageId: leadStageId ?? null,
        addTarefa: onAddTarefa,
      },
      payload,
    );
    if (result.level === "error") toast.error(result.toastMessage);
    else toast.success(result.toastMessage);
    setCompletingTarefa(null);
    onReload();
    invalidateTaskQueries(queryClient, leadId);
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-7 pt-6 pb-4 flex justify-between items-end border-b border-zinc-100">
        <div>
          <div className="text-lg font-bold text-zinc-900 tracking-tight">Tarefas</div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {countAtrasadas > 0 && <>{countAtrasadas} atrasada{countAtrasadas !== 1 ? "s" : ""} · </>}
            {countHoje > 0 && <>{countHoje} hoje · </>}
            {countProximas} próxima{countProximas !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          onClick={onNovaTarefa}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-xs font-medium flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Nova tarefa
        </button>
      </div>

      {/* Skeleton de carregamento — evita flash de "Nenhuma tarefa pendente" */}
      {loading && tarefas.length === 0 ? (
        <div className="px-7 pt-6 space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : totalPendentes === 0 ? (
        <div className="text-center py-16 px-6">
          <div className="w-16 h-16 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center text-2xl mx-auto mb-4">
            ✓
          </div>
          <div className="text-base font-semibold text-zinc-900 mb-1.5">
            Nenhuma tarefa pendente
          </div>
          <div className="text-xs text-zinc-500 max-w-xs mx-auto mb-5 leading-relaxed">
            Este lead está em dia. Crie uma tarefa de follow-up pra manter o ritmo de contato.
          </div>
          <button
            onClick={onNovaTarefa}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Criar tarefa
          </button>
        </div>
      ) : (
        <div className="px-7 pt-4">
          {GROUPS.map(g => {
            const list = grouped[g.key];
            if (list.length === 0) return null;
            return (
              <section key={g.key}>
                <div className="flex items-center gap-2 mt-6 mb-3 first:mt-0">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${g.color}`}>
                    {g.icon} {g.label}
                  </span>
                  <span className="bg-zinc-100 text-zinc-500 text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                    {list.length}
                  </span>
                </div>
                {list.map(t => (
                  <TaskCard
                    key={t.id}
                    tarefa={t}
                    bucket={g.key}
                    onToggle={() => setCompletingTarefa(t)}
                    onDelete={() => onDeleteTarefa(t.id)}
                    onAdiar={() => setAdiarTarefa(t)}
                    onEdit={() => setEditTarefa(t)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}

      {editTarefa && (
        <EditTaskDialog
          tarefa={editTarefa}
          onClose={() => setEditTarefa(null)}
          onSaved={() => {
            setEditTarefa(null);
            invalidateTaskQueries(queryClient, leadId);
            onReload();
          }}
        />
      )}
      {adiarTarefa && (
        <AdiarTaskDialog
          tarefa={adiarTarefa}
          onClose={() => setAdiarTarefa(null)}
          onSaved={() => {
            setAdiarTarefa(null);
            invalidateTaskQueries(queryClient, leadId);
            onReload();
          }}
        />
      )}

      <TaskCompletionDialog
        open={!!completingTarefa}
        onOpenChange={(v) => { if (!v) setCompletingTarefa(null); }}
        tarefaTitulo={completingTarefa?.titulo || ""}
        leadNome={leadNome}
        leadId={leadId}
        currentStageId={leadStageId ?? undefined}
        onConfirm={handleCompletionConfirm}
      />
    </div>
  );
}

// ───── Task card ─────
function TaskCard({
  tarefa,
  bucket,
  onToggle,
  onDelete,
  onAdiar,
  onEdit,
}: {
  tarefa: PipelineTarefa;
  bucket: keyof ReturnType<typeof groupTasksByDeadline>;
  onToggle: () => void;
  onDelete: () => void;
  onAdiar: () => void;
  onEdit: () => void;
}) {
  const tipo = canonTipo(tarefa.tipo);
  const emoji = TIPO_EMOJI[tipo];

  const isAtrasada = bucket === "atrasadas";
  const isHoje = bucket === "hoje";

  const cardCls = isAtrasada
    ? "bg-red-50/40 border border-red-200/60"
    : isHoje
    ? "bg-amber-50/40 border border-amber-200/60"
    : "bg-white border border-zinc-200";

  const barCls = isAtrasada ? "bg-red-600" : isHoje ? "bg-amber-600" : "";

  return (
    <div className={`rounded-xl p-4 mb-2 relative overflow-hidden ${cardCls}`}>
      {(isAtrasada || isHoje) && (
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${barCls}`} />
      )}

      <div className="flex items-center gap-2 mb-2">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${TIPO_CIRCLE[tipo]}`}>
          <span aria-hidden>{emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-zinc-500 mb-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{formatTaskDeadline(tarefa.vence_em, tarefa.hora_vencimento)}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-tight ${TIPO_BADGE[tipo]}`}>
              {TIPO_LABEL[tipo]}
            </span>
          </div>
          <div className="text-[13px] font-semibold text-zinc-900 leading-tight">
            {tarefa.titulo}
          </div>
        </div>
      </div>

      {tarefa.descricao && (
        <div className="text-xs text-zinc-600 leading-relaxed mb-2.5 pl-10">
          {tarefa.descricao}
        </div>
      )}

      <div className="flex gap-1.5 pl-10 flex-wrap">
        <button
          onClick={onToggle}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-2.5 py-1 text-[11px] font-medium flex items-center gap-1"
        >
          <CheckCircle2 className="h-3 w-3" /> Feito
        </button>
        <button
          onClick={onAdiar}
          className="bg-white border border-zinc-200 hover:bg-zinc-50 rounded-md px-2.5 py-1 text-[11px] font-medium text-zinc-600 flex items-center gap-1"
        >
          <RotateCw className="h-3 w-3" /> Adiar
        </button>
        <button
          onClick={onEdit}
          className="bg-white border border-zinc-200 hover:bg-zinc-50 rounded-md px-2.5 py-1 text-[11px] font-medium text-zinc-600 flex items-center gap-1"
        >
          <Pencil className="h-3 w-3" /> Editar
        </button>
        <button
          onClick={() => {
            if (confirm("Excluir esta tarefa?")) onDelete();
          }}
          className="bg-white border border-red-200/50 hover:bg-red-50 rounded-md px-2.5 py-1 text-[11px] font-medium text-red-600 flex items-center gap-1"
          aria-label="Excluir tarefa"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ───── Adiar dialog ─────
function AdiarTaskDialog({ tarefa, onClose, onSaved }: { tarefa: PipelineTarefa; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState(tarefa.vence_em ?? "");
  const [hora, setHora] = useState(tarefa.hora_vencimento?.slice(0, 5) ?? "09:00");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!data) { toast.error("Informe a nova data."); return; }
    setSaving(true);
    const { error } = await supabase
      .from("pipeline_tarefas")
      .update({ vence_em: data, hora_vencimento: hora ? `${hora}:00` : null })
      .eq("id", tarefa.id);
    setSaving(false);
    if (error) { toast.error("Erro ao adiar: " + error.message); return; }
    toast.success("Tarefa adiada.");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" /> Adiar tarefa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-zinc-700">{tarefa.titulo}</div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-zinc-500">Nova data</label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div className="w-32">
              <label className="text-[11px] font-medium text-zinc-500">Hora</label>
              <Input type="time" value={hora} onChange={e => setHora(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>Adiar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───── Edit dialog ─────
function EditTaskDialog({ tarefa, onClose, onSaved }: { tarefa: PipelineTarefa; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(tarefa.titulo);
  const [tipo, setTipo] = useState(tarefa.tipo || "follow_up");
  const [data, setData] = useState(tarefa.vence_em ?? "");
  const [hora, setHora] = useState(tarefa.hora_vencimento?.slice(0, 5) ?? "");
  const [descricao, setDescricao] = useState(tarefa.descricao ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!titulo.trim()) { toast.error("Informe o título."); return; }
    setSaving(true);
    const { error } = await supabase
      .from("pipeline_tarefas")
      .update({
        titulo: titulo.trim(),
        tipo,
        vence_em: data || null,
        hora_vencimento: hora ? `${hora}:00` : null,
        descricao: descricao.trim() || null,
      })
      .eq("id", tarefa.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Tarefa atualizada.");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Pencil className="h-4 w-4" /> Editar tarefa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-zinc-500">Título</label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-zinc-500">Tipo</label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={tipo}
              onChange={e => setTipo(e.target.value)}
            >
              {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-zinc-500">Data</label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div className="w-32">
              <label className="text-[11px] font-medium text-zinc-500">Hora</label>
              <Input type="time" value={hora} onChange={e => setHora(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-zinc-500">Descrição</label>
            <Textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
