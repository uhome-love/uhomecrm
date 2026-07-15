/**
 * Sprint 1 R3-V2 + Refactor Nível 2 (2026-05-22) — TaskCompletionDialog
 *
 * 2 telas obrigatórias:
 *   1. "O que aconteceu?" — tipo_contato + resultado (+ resumo opcional)
 *   2. "Como prosseguir?" — outcome (agendar | concluir | descartar | inativar)
 *
 * Prop `context`:
 *   - 'lead' (default) → Step 2 mostra 4 outcomes
 *   - 'negocio'        → Step 2 oculta seletor; apenas Agendar é permitido
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CompletionProgress } from "./CompletionProgress";
import { CompletionStep1 } from "./CompletionStep1";
import { CompletionStep2 } from "./CompletionStep2";
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
  /** Default 'lead'. 'negocio' renderiza Step 2 sem o grupo "Encerrar lead". */
  context?: CompletionContext;
  onConfirm: (payload: CompletionPayload) => Promise<void> | void;
}

export default function TaskCompletionDialog({
  open,
  onOpenChange,
  tarefaTitulo,
  leadNome,
  leadId,
  currentStageId,
  tarefaOrigem,
  context = "lead",
  onConfirm,
}: TaskCompletionDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [tipoContato, setTipoContato] = useState<TipoContato | undefined>();
  const [resultado, setResultado] = useState<Resultado | undefined>();
  const [descricao, setDescricao] = useState("");

  // Step 2 state
  const [outcome, setOutcome] = useState<OutcomeChoice>("agendar");
  const [novaTarefa, setNovaTarefa] = useState<NovaTarefaPayload>(
    defaultNovaTarefa(),
  );
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
  }>({
    enabled: false,
    tentativaAtual: 0,
    tentativaConcluida: 1,
    requiresNextTask: false,
    finalAttempt: false,
  });

  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep(1);
    setTipoContato(undefined);
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
    });
    setSaving(false);
  };

  // Reset on close
  useEffect(() => {
    if (!open) reset();
  }, [open]);

  // Quando muda outcome, limpa estados de outras vertentes pra não vazar
  useEffect(() => {
    setReasonCode(undefined);
    setReasonCustomText("");
  }, [outcome]);

  useEffect(() => {
    let cancelled = false;

    async function loadSemContatoInfo() {
      if (!open || !leadId || context !== "lead") {
        if (!cancelled) {
          setSemContatoInfo({
            enabled: false,
            tentativaAtual: 0,
            tentativaConcluida: 1,
            requiresNextTask: false,
            finalAttempt: false,
          });
        }
        return;
      }

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

      if ((stage as { tipo?: string } | null)?.tipo !== "sem_contato") {
        if (!cancelled) {
          setSemContatoInfo({
            enabled: false,
            tentativaAtual: 0,
            tentativaConcluida: 1,
            requiresNextTask: false,
            finalAttempt: false,
          });
        }
        return;
      }

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

      if (!cancelled) {
        setSemContatoInfo({
          enabled: true,
          tentativaAtual,
          tentativaConcluida,
          requiresNextTask: !finalAttempt,
          finalAttempt,
        });
        setOutcome(finalAttempt ? "concluir" : "agendar");
      }
    }

    loadSemContatoInfo();
    return () => {
      cancelled = true;
    };
  }, [open, leadId, currentStageId, context]);

  useEffect(() => {
    if (!semContatoInfo.enabled) return;
    if (semContatoInfo.requiresNextTask && outcome === "concluir") {
      setOutcome("agendar");
    }
    if (semContatoInfo.finalAttempt && outcome === "agendar") {
      setOutcome("concluir");
    }
  }, [semContatoInfo, outcome]);

  const handleConfirm = async () => {
    if (!tipoContato || !resultado) return;
    if (descricao.trim().length < 3) {
      setStep(1);
      return;
    }
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
      if (
        effectiveOutcome === "descartar" ||
        effectiveOutcome === "inativar"
      ) {
        const list =
          effectiveOutcome === "descartar"
            ? DESCARTE_REASONS
            : INATIVAR_REASONS;
        const found = list.find((r) => r.code === reasonCode);
        reasonLabel =
          reasonCode === "outro"
            ? reasonCustomText.trim()
            : (found?.label ?? reasonCode);
      }

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
            ? {
                ...novaTarefa,
                obs: observacaoCurta?.trim() || novaTarefa.obs,
              }
            : undefined,
        reason_code:
          effectiveOutcome === "descartar" || effectiveOutcome === "inativar"
            ? reasonCode
            : undefined,
        reason_label: reasonLabel,
        reason_custom_text:
          reasonCode === "outro" ? reasonCustomText.trim() : undefined,
      };

      await onConfirm(payload);
      onOpenChange(false);
    } catch (err) {
      console.error("[TaskCompletionDialog] onConfirm error", err);
    } finally {
      setSaving(false);
    }
  };

  const subtitle = `${tarefaTitulo}${leadNome ? ` · ${leadNome}` : ""}`;
  const stepTitle =
    step === 1
      ? "O que aconteceu?"
      : context === "lead"
        ? "Como prosseguir com este lead?"
        : "Quando voltar a falar?";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (saving) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-card border-border text-foreground">
        <CompletionProgress step={step} title={stepTitle} subtitle={subtitle} />

        {step === 1 ? (
          <CompletionStep1
            tipoContato={tipoContato}
            resultado={resultado}
            descricao={descricao}
            onChangeTipo={setTipoContato}
            onChangeResultado={setResultado}
            onChangeDescricao={setDescricao}
            onCancel={() => onOpenChange(false)}
            onNext={() => setStep(2)}
          />
        ) : (
          <CompletionStep2
            context={context}
            outcome={outcome}
            novaTarefa={novaTarefa}
            novoStageId={novoStageId}
            reasonCode={reasonCode}
            reasonCustomText={reasonCustomText}
            observacaoCurta={observacaoCurta}
            leadId={leadId}
            currentStageId={currentStageId}
            step1Descricao={descricao}
            semContato={semContatoInfo}
            onChangeOutcome={setOutcome}
            onChangeNovaTarefa={(patch) =>
              setNovaTarefa((prev) => ({ ...prev, ...patch }))
            }
            onChangeNovoStage={setNovoStageId}
            onChangeReasonCode={setReasonCode}
            onChangeReasonCustomText={setReasonCustomText}
            onChangeObservacaoCurta={setObservacaoCurta}
            onBack={() => setStep(1)}
            onConfirm={handleConfirm}
            saving={saving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
