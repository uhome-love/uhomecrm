/**
 * Sprint 1 R3-V2 — TaskCompletionDialog (2 telas obrigatórias)
 *
 * Telas:
 *   1. "O que aconteceu?" — tipo_contato + resultado (+ resumo opcional)
 *   2. "Quando voltar a falar?" — tipo próxima + data/hora (+ stage opcional + obs)
 *
 * onConfirm recebe payload estruturado (CompletionPayload).
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CompletionProgress } from "./CompletionProgress";
import { CompletionStep1 } from "./CompletionStep1";
import { CompletionStep2 } from "./CompletionStep2";
import {
  defaultNovaTarefa,
  type CompletionPayload,
  type NovaTarefaPayload,
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
  onConfirm: (payload: CompletionPayload) => Promise<void> | void;
}

export default function TaskCompletionDialog({
  open,
  onOpenChange,
  tarefaTitulo,
  leadNome,
  leadId,
  currentStageId,
  onConfirm,
}: TaskCompletionDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [tipoContato, setTipoContato] = useState<TipoContato | undefined>();
  const [resultado, setResultado] = useState<Resultado | undefined>();
  const [descricao, setDescricao] = useState("");
  const [novaTarefa, setNovaTarefa] = useState<NovaTarefaPayload>(defaultNovaTarefa);
  const [novoStageId, setNovoStageId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep(1);
    setTipoContato(undefined);
    setResultado(undefined);
    setDescricao("");
    setNovaTarefa(defaultNovaTarefa());
    setNovoStageId(undefined);
    setSaving(false);
  };

  // Reset on close
  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const handleConfirm = async () => {
    if (!tipoContato || !resultado) return;
    setSaving(true);
    try {
      await onConfirm({
        tipo_contato: tipoContato,
        resultado,
        descricao: descricao.trim() || undefined,
        nova_tarefa: novaTarefa,
        novo_stage_id: novoStageId,
      });
      // Parent fecha o dialog; defensively close se ainda aberto
      onOpenChange(false);
    } catch (err) {
      // Parent já mostra toast; mantém aberto pro usuário tentar de novo
      console.error("[TaskCompletionDialog] onConfirm error", err);
    } finally {
      setSaving(false);
    }
  };

  const subtitle = `${tarefaTitulo}${leadNome ? ` · ${leadNome}` : ""}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (saving) return;
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="max-w-[560px] p-0 gap-0 border-0 overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #0E1428 0%, #0A0E1A 100%)",
          color: "#fff",
        }}
      >
        <CompletionProgress
          step={step}
          title={step === 1 ? "O que aconteceu?" : "Quando voltar a falar?"}
          subtitle={subtitle}
        />

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
            novaTarefa={novaTarefa}
            novoStageId={novoStageId}
            leadId={leadId}
            currentStageId={currentStageId}
            onChangeNovaTarefa={(patch) =>
              setNovaTarefa((prev) => ({ ...prev, ...patch }))
            }
            onChangeNovoStage={setNovoStageId}
            onBack={() => setStep(1)}
            onConfirm={handleConfirm}
            saving={saving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
