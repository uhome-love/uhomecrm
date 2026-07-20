/**
 * TaskCompletionDialog — Redesign single-screen (2026-07-20)
 *
 * Uma única tela scrollável (sem wizard 1/2), com CTA sticky no rodapé.
 * Em ≤420px vira bottom sheet (desliza de baixo, botões empilhados).
 *
 * A interface pública (props + `CompletionPayload`) permanece idêntica —
 * consumidores como `MinhasTarefas`, `TarefaHojeItem`, `TarefasHojeLateral`,
 * `DrawerTasksTab` e `CardMinimal` não precisam mudar nada.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CompletionForm } from "./CompletionForm";
import { advanceQualificacaoStatus, type DataOverride } from "@/lib/qualificacaoTaskEngine";
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
  /** Default 'lead'. 'negocio' oculta o grupo "Encerrar lead". */
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
  const [tipoContato, setTipoContato] = useState<TipoContato | undefined>();
  const [resultado, setResultado] = useState<Resultado | undefined>();
  const [descricao, setDescricao] = useState("");

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

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  // Quando muda outcome, limpa estados de outras vertentes
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
      const isCadenciaTask = tarefaOrigem === "cadencia_sem_contato";

      if (!cancelled) {
        setSemContatoInfo({
          enabled: true,
          tentativaAtual,
          tentativaConcluida,
          requiresNextTask: !finalAttempt && !isCadenciaTask,
          finalAttempt,
        });
        setOutcome(finalAttempt || isCadenciaTask ? "concluir" : "agendar");
      }
    }

    loadSemContatoInfo();
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

  const handleConfirm = async () => {
    if (!tipoContato || !resultado) return;
    if (descricao.trim().length < 3) return;

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
        const list =
          effectiveOutcome === "descartar" ? DESCARTE_REASONS : INATIVAR_REASONS;
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
          // Desktop: compacto, centralizado, largura ~400
          "p-0 gap-0 bg-card border-border text-foreground overflow-hidden",
          "w-[min(400px,calc(100vw-2rem))] max-w-[400px]",
          "sm:rounded-lg",
          // Mobile ≤420: bottom sheet
          "max-[420px]:top-auto max-[420px]:bottom-0 max-[420px]:left-0 max-[420px]:translate-x-0 max-[420px]:translate-y-0",
          "max-[420px]:w-full max-[420px]:max-w-full max-[420px]:rounded-t-2xl max-[420px]:rounded-b-none max-[420px]:border-b-0",
        ].join(" ")}
      >
        <CompletionForm
          context={context}
          tarefaTitulo={tarefaTitulo}
          leadNome={leadNome}
          leadId={leadId}
          currentStageId={currentStageId}
          semContato={semContatoInfo}
          tipoContato={tipoContato}
          resultado={resultado}
          descricao={descricao}
          outcome={outcome}
          novaTarefa={novaTarefa}
          novoStageId={novoStageId}
          reasonCode={reasonCode}
          reasonCustomText={reasonCustomText}
          observacaoCurta={observacaoCurta}
          saving={saving}
          onChangeTipo={setTipoContato}
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
      </DialogContent>
    </Dialog>
  );
}
