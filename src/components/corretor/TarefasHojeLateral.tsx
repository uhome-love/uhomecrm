/**
 * TarefasHojeLateral — Coluna lateral fixa 280px (desktop) com tarefas de hoje.
 * Em mobile (<1024px) vira accordion fechado por padrão.
 * Ação inline: Concluir. (Adiar removido definitivamente.)
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTarefasHoje, type TarefaHoje } from "@/hooks/useTarefasHoje";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invalidateTaskQueries } from "@/lib/taskQueryUtils";
import { runTaskCompletion } from "@/lib/taskCompletion";
import TarefaHojeItem from "@/components/corretor/TarefaHojeItem";
import TaskCompletionDialog from "@/components/pipeline/TaskCompletionDialog";
import { logDashboard } from "@/lib/dashboardTelemetry";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { CompletionPayload } from "@/components/pipeline/task-completion/types";

interface Props {
  variant: "desktop" | "mobile";
}

export default function TarefasHojeLateral({ variant }: Props) {
  const { data: tarefas = [], isLoading } = useTarefasHoje();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [completing, setCompleting] = useState<TarefaHoje | null>(null);
  const [saving, setSaving] = useState(false);

  const [adiarTarefa, setAdiarTarefa] = useState<TarefaHoje | null>(null);
  const [adiarData, setAdiarData] = useState("");
  const [adiarHora, setAdiarHora] = useState("");

  const handleOpenLead = (taskId: string, leadId: string) => {
    logDashboard("dashboard_task_click", { task_id: taskId, lead_id: leadId, action: "open_drawer" });
    navigate(`/pipeline-leads?lead=${leadId}`);
  };

  const toggleAccordion = () => {
    const next = !open;
    setOpen(next);
    logDashboard("dashboard_tasks_accordion_toggled", { opened: next });
  };

  const applyAdiado2xFlag = async (leadId: string) => {
    try {
      const { data: lead } = await supabase
        .from("pipeline_leads").select("flag_status").eq("id", leadId).maybeSingle();
      const currentFlag = ((lead as any)?.flag_status as Record<string, any>) || {};
      if (currentFlag.adiado_2x_sem_solucao === true) return;
      await supabase.from("pipeline_leads")
        .update({ flag_status: { ...currentFlag, adiado_2x_sem_solucao: true } } as any)
        .eq("id", leadId);
    } catch (err) {
      console.error("[applyAdiado2xFlag]", err);
    }
  };

  const doAdiarRapido = async (horas: number) => {
    if (!adiarTarefa) return;
    const currentCount = adiarTarefa.adiamentos_count ?? 0;
    if (currentCount >= 2) {
      toast.error("Limite de adiamentos atingido.");
      return;
    }
    const novaData = addHours(new Date(), horas);
    const nextCount = currentCount + 1;
    const { error } = await supabase.from("pipeline_tarefas").update({
      vence_em: dateToBRT(novaData),
      hora_vencimento: format(novaData, "HH:mm"),
      adiamentos_count: nextCount,
    } as any).eq("id", adiarTarefa.id);
    if (error) { toast.error("Não foi possível adiar: " + error.message); return; }
    if (nextCount >= 2) await applyAdiado2xFlag(adiarTarefa.lead_id);
    toast.success(nextCount >= 2 ? "Adiado (2/2) — próxima vez, é resolver ⚠️" : "Tarefa adiada ✅");
    setAdiarTarefa(null);
    invalidateTaskQueries(queryClient, null);
    queryClient.invalidateQueries({ queryKey: ["corretor-tarefas-hoje"] });
  };

  const doAdiarCustom = async () => {
    if (!adiarTarefa || !adiarData) return;
    const currentCount = adiarTarefa.adiamentos_count ?? 0;
    if (currentCount >= 2) { toast.error("Limite de adiamentos atingido."); return; }
    if (isTaskDateTooFar(adiarData)) { toast.error(TASK_DATE_TOO_FAR_MSG); return; }
    const nextCount = currentCount + 1;
    const { error } = await supabase.from("pipeline_tarefas").update({
      vence_em: adiarData,
      hora_vencimento: adiarHora || null,
      adiamentos_count: nextCount,
    } as any).eq("id", adiarTarefa.id);
    if (error) { toast.error("Não foi possível reagendar: " + error.message); return; }
    if (nextCount >= 2) await applyAdiado2xFlag(adiarTarefa.lead_id);
    toast.success(nextCount >= 2 ? "Reagendado (2/2) — próxima vez, é resolver ⚠️" : "Tarefa reagendada ✅");
    setAdiarTarefa(null);
    invalidateTaskQueries(queryClient, null);
    queryClient.invalidateQueries({ queryKey: ["corretor-tarefas-hoje"] });
  };

  const handleCompletionConfirm = async (payload: CompletionPayload) => {
    if (!completing || !user || saving) return;
    setSaving(true);
    try {
      const { toastMessage, level } = await runTaskCompletion(
        {
          tarefaId: completing.id,
          tarefaTitulo: completing.titulo || "Tarefa",
          leadId: completing.lead_id,
          leadNome: completing.lead_nome,
          leadStageId: completing.stage_id,
          addTarefa: async (input) => {
            await supabase.from("pipeline_tarefas").insert({
              pipeline_lead_id: completing.lead_id,
              tipo: input.tipo,
              titulo: input.titulo,
              descricao: input.descricao ?? null,
              prioridade: "media",
              status: "pendente",
              responsavel_id: user.id,
              vence_em: input.vence_em,
              hora_vencimento: input.hora_vencimento ?? null,
              created_by: user.id,
            } as any);
          },
        },
        payload,
      );
      if (level === "error") toast.error(toastMessage);
      else if (level === "warning") toast.warning(toastMessage);
      else toast.success(toastMessage);
      setCompleting(null);
      invalidateTaskQueries(queryClient, completing.lead_id);
      queryClient.invalidateQueries({ queryKey: ["corretor-tarefas-hoje"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao concluir tarefa";
      toast.error("Não foi possível concluir: " + msg);
    } finally {
      setSaving(false);
    }
  };

  const adiarCount = adiarTarefa?.adiamentos_count ?? 0;

  const content = (
    <div className="space-y-2">
      {isLoading ? (
        <div className="text-xs text-muted-foreground p-3">Carregando...</div>
      ) : tarefas.length === 0 ? (
        <div className="text-center py-8 px-3">
          <Sparkles className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
          <div className="text-sm font-semibold text-foreground">Você está em dia</div>
          <div className="text-xs text-muted-foreground mt-1">Nenhuma tarefa pendente para hoje</div>
          <button
            type="button"
            onClick={() => {
              logDashboard("dashboard_task_click", { action: "ver_proximas", tab: "semana" });
              navigate("/minhas-tarefas?tab=semana");
            }}
            className="mt-4 text-[11px] text-indigo-500 hover:text-indigo-600 hover:underline"
          >
            Ver próximas tarefas →
          </button>
        </div>
      ) : (
        tarefas.map((t) => (
          <TarefaHojeItem
            key={t.id}
            tarefa={t}
            onClick={() => handleOpenLead(t.id, t.lead_id)}
            onConcluir={() => setCompleting(t)}
            onAdiar={() => {
              setAdiarTarefa(t);
              setAdiarData("");
              setAdiarHora("");
            }}
          />
        ))
      )}
    </div>
  );

  const shared = (
    <>
      {/* Task Completion */}
      <TaskCompletionDialog
        open={!!completing}
        onOpenChange={(v) => { if (!v) setCompleting(null); }}
        tarefaTitulo={completing?.titulo || "Tarefa"}
        leadNome={completing?.lead_nome}
        leadId={completing?.lead_id}
        currentStageId={completing?.stage_id || undefined}
        context="lead"
        onConfirm={handleCompletionConfirm}
      />

      {/* Adiar dialog */}
      <Dialog open={!!adiarTarefa} onOpenChange={(v) => { if (!v) setAdiarTarefa(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Adiar tarefa {adiarCount > 0 ? `(${adiarCount}/2)` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {adiarCount === 1 && (
              <div className="text-xs bg-warning-500/10 border border-warning-500/30 text-warning-700 rounded-md p-2 leading-snug">
                ⚠️ Essa é a última vez que dá pra adiar sem resolver. Na próxima, você vai precisar concluir, descartar ou repassar esse lead.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => doAdiarRapido(1)}>Daqui 1h</Button>
              <Button variant="outline" size="sm" onClick={() => doAdiarRapido(2)}>Daqui 2h</Button>
              <Button variant="outline" size="sm" onClick={() => doAdiarRapido(24)}>Amanhã</Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">ou escolha data/hora:</p>
            <Input type="date" value={adiarData} max={maxTaskDateBRT()} onChange={(e) => setAdiarData(e.target.value)} />
            <Input type="time" value={adiarHora} onChange={(e) => setAdiarHora(e.target.value)} />
            <Button className="w-full" onClick={doAdiarCustom} disabled={!adiarData}>Reagendar ✅</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  if (variant === "desktop") {
    return (
      <>
        <aside className="rounded-xl border border-border bg-card/50 p-3 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>📋</span> Hoje
            </h3>
            <span className="text-[10px] font-bold bg-muted text-muted-foreground rounded-full px-2 py-0.5 tabular-nums">
              {tarefas.length}
            </span>
          </div>
          {content}
        </aside>
        {shared}
      </>
    );
  }

  // mobile accordion
  return (
    <>
      <section className="rounded-xl border border-border bg-card/50">
        <button
          type="button"
          onClick={toggleAccordion}
          className="w-full flex items-center justify-between p-3"
        >
          <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <span>📋</span> Hoje · {tarefas.length} tarefa{tarefas.length === 1 ? "" : "s"}
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {open && <div className="px-3 pb-3">{content}</div>}
      </section>
      {shared}
    </>
  );
}
