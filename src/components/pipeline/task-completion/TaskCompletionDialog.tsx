/**
 * TaskCompletionDialog — Simplificado (2026-07-20)
 *
 * Mudanças desta revisão:
 * - REMOVIDO todo motor automático (advanceQualificacaoStatus). Registro puro.
 * - REMOVIDO campo "Canal" da UI. `tipoContato` agora é herdado da tarefa via
 *   nova prop `tarefaTipo`.
 * - Para stages `qualificacao` e `aquecimento`, o popup exige que o corretor
 *   escolha um status da etapa (pill obrigatória). O valor vai no payload
 *   como `status_etapa` e é persistido em `pipeline_leads.flag_status`.
 * - Criação da próxima tarefa continua 100% manual (AgendarCard clássico).
 * - Sem Contato permanece igual.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CompletionForm } from "./CompletionForm";
import { QUALIFICACAO_STATUS_ATEND } from "@/components/pipeline/PipelineStageTransitionPopup";
import {
  DESCARTE_REASONS,
  INATIVAR_REASONS,
  defaultNovaTarefa,
  type CompletionPayload,
  type CompletionContext,
  type NovaTarefaPayload,
  type OutcomeChoice,
  type Resultado,
  type TipoContato,
} from "./types";

export interface TaskCompletionDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefaTitulo: string;
  leadNome?: string;
  leadId?: string;
  currentStageId?: string;
  /** Origem da tarefa. Se for 'cadencia_sem_contato', a próxima tarefa é criada pelo sistema. */
  tarefaOrigem?: string | null;
  /** Tipo da tarefa sendo concluída (ligacao/whatsapp/email/visita/follow_up/proposta).
   *  Usado para herdar tipo_contato sem expor UI de "Canal". */
  tarefaTipo?: string | null;
  /** Default 'lead'. 'negocio' oculta o grupo "Encerrar lead". */
  context?: CompletionContext;
  onConfirm: (payload: CompletionPayload) => Promise<void> | void;
}

/** Mapeia tipo da tarefa → TipoContato do payload. */
function mapTarefaTipoToContato(tipo?: string | null): TipoContato {
  switch ((tipo || "").toLowerCase()) {
    case "ligacao": return "ligacao";
    case "whatsapp": return "whatsapp";
    case "email": return "email";
    case "visita": return "visita";
    case "follow_up":
    case "proposta":
    default:
      return "whatsapp";
  }
}

export type StageStatusKind = "qualificacao" | "aquecimento";

export interface StageStatusOption {
  value: string;
  label: string;
}

export const AQUECIMENTO_PRAZOS: StageStatusOption[] = [
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
];

const QUALIFICACAO_OPTIONS: StageStatusOption[] = Object.entries(
  QUALIFICACAO_STATUS_ATEND,
).map(([value, label]) => ({ value, label }));

export default function TaskCompletionDialog({
  open,
  onOpenChange,
  tarefaTitulo,
  leadNome,
  leadId,
  currentStageId,
  tarefaOrigem,
  tarefaTipo,
  context = "lead",
  onConfirm,
}: TaskCompletionDialogProps) {
  const [tipoContato, setTipoContato] = useState<TipoContato>(
    mapTarefaTipoToContato(tarefaTipo),
  );
  const [resultado, setResultado] = useState<Resultado | undefined>();
  const [descricao, setDescricao] = useState("");

  const [outcome, setOutcome] = useState<OutcomeChoice>("agendar");
  const [novaTarefa, setNovaTarefa] = useState<NovaTarefaPayload>(defaultNovaTarefa());
  const [novoStageId, setNovoStageId] = useState<string | undefined>();
  const [reasonCode, setReasonCode] = useState<string | undefined>();
  const [reasonCustomText, setReasonCustomText] = useState("");
  const [observacaoCurta, setObservacaoCurta] = useState("");

  const [semContatoInfo, setSemContatoInfo] = useState<{
    enabled: boolean;
    tentativaAtual: number;
    tentativaConcluida: number;
    requiresNextTask: boolean;
    finalAttempt: boolean;
    isCadenciaTask: boolean;
  }>({
    enabled: false,
    tentativaAtual: 0,
    tentativaConcluida: 1,
    requiresNextTask: false,
    finalAttempt: false,
    isCadenciaTask: false,
  });

  /** Contexto de status da etapa (Qualificação/Aquecimento). */
  const [stageStatus, setStageStatus] = useState<{
    kind: StageStatusKind | null;
    currentValue: string;
    options: StageStatusOption[];
  }>({ kind: null, currentValue: "", options: [] });
  const [stageStatusPick, setStageStatusPick] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);

  const reset = () => {
    setTipoContato(mapTarefaTipoToContato(tarefaTipo));
    setResultado(undefined);
    setDescricao("");
    setOutcome("agendar");
    setNovaTarefa(defaultNovaTarefa());
    setNovoStageId(undefined);
    setReasonCode(undefined);
    setReasonCustomText("");
    setObservacaoCurta("");
    setSemContatoInfo({
      enabled: false,
      tentativaAtual: 0,
      tentativaConcluida: 1,
      requiresNextTask: false,
      finalAttempt: false,
      isCadenciaTask: false,
    });
    setStageStatus({ kind: null, currentValue: "", options: [] });
    setStageStatusPick("");
    setSaving(false);
    setContextLoaded(false);
  };

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Se o tipo da tarefa mudar enquanto aberto (raro), respeita
  useEffect(() => {
    setTipoContato(mapTarefaTipoToContato(tarefaTipo));
  }, [tarefaTipo]);

  // Quando muda outcome, limpa estados de outras vertentes
  useEffect(() => {
    setReasonCode(undefined);
    setReasonCustomText("");
  }, [outcome]);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      if (!open || !leadId || context !== "lead") return;

      let stageId = currentStageId;
      if (!stageId) {
        const { data: lead } = await supabase
          .from("pipeline_leads")
          .select("stage_id")
          .eq("id", leadId)
          .maybeSingle();
        stageId = (lead as { stage_id?: string | null } | null)?.stage_id ?? undefined;
      }
      if (!stageId) return;

      const { data: stage } = await supabase
        .from("pipeline_stages")
        .select("tipo")
        .eq("id", stageId)
        .maybeSingle();
      const stageTipo = (stage as { tipo?: string } | null)?.tipo;

      // Stage status (qualificação/aquecimento) — obrigatório escolher pill
      if (stageTipo === "qualificacao" || stageTipo === "aquecimento") {
        const { data: leadData } = await supabase
          .from("pipeline_leads")
          .select("flag_status")
          .eq("id", leadId)
          .maybeSingle();
        const fs = ((leadData as any)?.flag_status || {}) as Record<string, any>;
        const currentValue =
          stageTipo === "qualificacao"
            ? String(fs.status_atendimento || "")
            : String(fs.prazo || "");
        const options =
          stageTipo === "qualificacao" ? QUALIFICACAO_OPTIONS : AQUECIMENTO_PRAZOS;
        if (!cancelled) {
          setStageStatus({ kind: stageTipo as StageStatusKind, currentValue, options });
          setStageStatusPick(currentValue);
        }
      } else if (!cancelled) {
        setStageStatus({ kind: null, currentValue: "", options: [] });
      }

      // Sem contato: cadência
      if (stageTipo !== "sem_contato") return;

      const { data: cadencia } = await supabase
        .from("lead_cadencia_sem_contato")
        .select("tentativa_atual")
        .eq("pipeline_lead_id", leadId)
        .maybeSingle();

      const tentativaAtual = Math.max(
        0,
        Math.min(7, Number((cadencia as { tentativa_atual?: number } | null)?.tentativa_atual ?? 0)),
      );
      const tentativaConcluida = Math.min(7, tentativaAtual + 1);
      const finalAttempt = tentativaConcluida >= 7;
      const isCadenciaTask = tarefaOrigem === "cadencia_sem_contato";

      if (!cancelled) {
        setSemContatoInfo({
          enabled: true,
          tentativaAtual,
          tentativaConcluida,
          requiresNextTask: !finalAttempt && !isCadenciaTask,
          finalAttempt,
          isCadenciaTask,
        });
        setOutcome(finalAttempt || isCadenciaTask ? "concluir" : "agendar");
      }
    }

    if (!open) return;
    loadContext().finally(() => {
      if (!cancelled) setContextLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, leadId, currentStageId, context, tarefaOrigem]);

  useEffect(() => {
    if (!semContatoInfo.enabled) return;
    if (semContatoInfo.requiresNextTask && outcome === "concluir") {
      setOutcome("agendar");
    }
    if (semContatoInfo.finalAttempt && outcome === "agendar") {
      setOutcome("concluir");
    }
  }, [semContatoInfo, outcome]);

  const stageStatusRequired = !!stageStatus.kind;
  const stageStatusReady = !stageStatusRequired || !!stageStatusPick;

  const handleConfirm = async () => {
    if (!resultado) return;
    if (descricao.trim().length < 3) return;
    if (!stageStatusReady) return;

    setSaving(true);
    try {
      const effectiveOutcome: OutcomeChoice =
        context === "negocio" ? "agendar" : outcome;

      if (
        semContatoInfo.enabled &&
        semContatoInfo.requiresNextTask &&
        effectiveOutcome === "concluir"
      ) {
        setOutcome("agendar");
        return;
      }
      if (
        semContatoInfo.enabled &&
        semContatoInfo.finalAttempt &&
        effectiveOutcome === "agendar"
      ) {
        setOutcome("concluir");
        return;
      }

      let reasonLabel: string | undefined;
      if (effectiveOutcome === "descartar" || effectiveOutcome === "inativar") {
        const list = effectiveOutcome === "descartar" ? DESCARTE_REASONS : INATIVAR_REASONS;
        const found = list.find((r) => r.code === reasonCode);
        reasonLabel =
          reasonCode === "outro" ? reasonCustomText.trim() : (found?.label ?? reasonCode);
      }

      const statusEtapa =
        stageStatus.kind && stageStatusPick
          ? {
              key:
                stageStatus.kind === "qualificacao"
                  ? ("status_atendimento" as const)
                  : ("prazo" as const),
              value: stageStatusPick,
            }
          : undefined;

      const payload: CompletionPayload = {
        tipo_contato: tipoContato,
        resultado,
        descricao: descricao.trim() || undefined,
        outcome: effectiveOutcome,
        novo_stage_id:
          effectiveOutcome === "agendar" || effectiveOutcome === "concluir"
            ? novoStageId
            : undefined,
        nova_tarefa:
          effectiveOutcome === "agendar"
            ? { ...novaTarefa, obs: observacaoCurta?.trim() || novaTarefa.obs }
            : undefined,
        reason_code:
          effectiveOutcome === "descartar" || effectiveOutcome === "inativar"
            ? reasonCode
            : undefined,
        reason_label: reasonLabel,
        reason_custom_text:
          reasonCode === "outro" ? reasonCustomText.trim() : undefined,
        status_etapa: statusEtapa,
      };

      await onConfirm(payload);
      onOpenChange(false);
    } catch (err) {
      console.error("[TaskCompletionDialog] onConfirm error", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (saving) return;
        onOpenChange(v);
      }}
    >
      <DialogContent
        className={[
          "p-0 gap-0 bg-card border-border text-foreground overflow-hidden",
          "w-[min(400px,calc(100vw-2rem))] max-w-[400px]",
          "sm:rounded-lg",
          "max-[420px]:top-auto max-[420px]:bottom-0 max-[420px]:left-0 max-[420px]:translate-x-0 max-[420px]:translate-y-0",
          "max-[420px]:w-full max-[420px]:max-w-full max-[420px]:rounded-t-2xl max-[420px]:rounded-b-none max-[420px]:border-b-0",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {!contextLoaded ? (
          <div className="p-6 space-y-3 animate-pulse">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-24 w-full rounded bg-muted" />
            <div className="h-10 w-full rounded bg-muted" />
          </div>
        ) : (
          <CompletionForm
            context={context}
            tarefaTitulo={tarefaTitulo}
            leadNome={leadNome}
            leadId={leadId}
            currentStageId={currentStageId}
            semContato={semContatoInfo}
            
            resultado={resultado}
            descricao={descricao}
            outcome={outcome}
            novaTarefa={novaTarefa}
            novoStageId={novoStageId}
            reasonCode={reasonCode}
            reasonCustomText={reasonCustomText}
            observacaoCurta={observacaoCurta}
            saving={saving}
            stageStatus={
              stageStatus.kind
                ? {
                    kind: stageStatus.kind,
                    options: stageStatus.options,
                    currentValue: stageStatus.currentValue,
                    pick: stageStatusPick,
                    onPick: setStageStatusPick,
                  }
                : undefined
            }
            onChangeResultado={setResultado}
            onChangeDescricao={setDescricao}
            onChangeOutcome={setOutcome}
            onChangeNovaTarefa={(patch) =>
              setNovaTarefa((prev) => ({ ...prev, ...patch }))
            }
            onChangeNovoStage={setNovoStageId}
            onChangeReasonCode={setReasonCode}
            onChangeReasonCustomText={setReasonCustomText}
            onChangeObservacaoCurta={setObservacaoCurta}
            onCancel={() => onOpenChange(false)}
            onConfirm={handleConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
