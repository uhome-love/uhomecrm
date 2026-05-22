/**
 * Sprint 1 R4.2 — Tela 2: "Quando voltar a falar?"
 * Obrigatórios: nova_tarefa (tipo + data + hora). Opcional: novo_stage_id.
 * Adapta ao tema dark/light via tokens semânticos. CTA preserva gradient HOMI.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, CheckCircle2, ArrowRight, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PROXIMA_TAREFA_OPTIONS,
  quickDates,
  type NovaTarefaPayload,
  type TipoProximaTarefa,
} from "./types";
import { dateToBRT } from "@/lib/utils";
import { useStageOptions } from "./useStageOptions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  novaTarefa: NovaTarefaPayload;
  novoStageId?: string;
  leadId?: string;
  currentStageId?: string;
  /** Resumo digitado no Step 1 — usado como placeholder e fallback de descrição da nova tarefa. */
  step1Descricao?: string;
  onChangeNovaTarefa: (patch: Partial<NovaTarefaPayload>) => void;
  onChangeNovoStage: (v: string | undefined) => void;
  onBack: () => void;
  onConfirm: () => void;
  saving: boolean;
}

const KEEP_STAGE = "__keep__";

export function CompletionStep2({
  novaTarefa,
  novoStageId,
  leadId,
  currentStageId,
  step1Descricao,
  onChangeNovaTarefa,
  onChangeNovoStage,
  onBack,
  onConfirm,
  saving,
}: Props) {
  const { data: stages = [], isLoading: stagesLoading } = useStageOptions(
    currentStageId,
    !!leadId && !!currentStageId
  );

  const currentStageNome =
    stages.find((s) => s.id === currentStageId)?.nome ?? "etapa atual";

  const canConfirm =
    !!novaTarefa.tipo && !!novaTarefa.vence_em && !!novaTarefa.hora_vencimento;

  const applyQuick = (d: Date, h: string) => {
    onChangeNovaTarefa({ vence_em: dateToBRT(d), hora_vencimento: h });
  };

  return (
    <div className="p-5 space-y-4">
      {/* Tipo de próxima tarefa */}
      <div>
        <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-2 flex items-center gap-1.5">
          Tipo da próxima ação <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {PROXIMA_TAREFA_OPTIONS.map(({ value, label, Icon }) => {
            const active = novaTarefa.tipo === value;
            return (
              <button
                key={value}
                onClick={() => onChangeNovaTarefa({ tipo: value as TipoProximaTarefa })}
                className={cn(
                  "px-2 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 border",
                  active
                    ? "bg-primary/10 border-primary text-primary shadow-sm shadow-primary/10"
                    : "bg-background border-border text-foreground hover:bg-muted",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick dates */}
      <div>
        <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-1.5">
          Quando?
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {quickDates().map((q) => (
            <button
              key={q.label}
              onClick={() => applyQuick(q.d, q.h)}
              className="text-[11px] px-2 py-1 rounded-md transition-colors border bg-muted border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Data
            </label>
            <Input
              type="date"
              value={novaTarefa.vence_em}
              onChange={(e) => onChangeNovaTarefa({ vence_em: e.target.value })}
              className="h-9 text-xs bg-background border-border text-foreground focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Horário
            </label>
            <Input
              type="time"
              value={novaTarefa.hora_vencimento}
              onChange={(e) =>
                onChangeNovaTarefa({ hora_vencimento: e.target.value })
              }
              className="h-9 text-xs bg-background border-border text-foreground focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {/* Stage (opcional) */}
      {leadId && currentStageId && (
        <div>
          <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-1.5 flex items-center gap-1.5">
            <ArrowLeftRight className="w-3 h-3" /> Mover etapa{" "}
            <span className="text-muted-foreground normal-case font-normal">(opcional)</span>
          </label>
          <Select
            value={novoStageId ?? KEEP_STAGE}
            onValueChange={(v) =>
              onChangeNovoStage(v === KEEP_STAGE ? undefined : v)
            }
            disabled={stagesLoading || stages.length === 0}
          >
            <SelectTrigger className="h-9 text-xs bg-background border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={KEEP_STAGE}>
                Manter em <strong>{currentStageNome}</strong>
              </SelectItem>
              {stages
                .filter((s) => s.id !== currentStageId)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    → {s.nome}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Obs próxima (opcional) */}
      <div>
        <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-1.5">
          Detalhes da próxima ação{" "}
          <span className="text-muted-foreground normal-case font-normal">(opcional)</span>
        </label>
        <Textarea
          placeholder="Ex: Apresentar simulação do apto 301..."
          value={novaTarefa.obs ?? ""}
          onChange={(e) => onChangeNovaTarefa({ obs: e.target.value })}
          rows={2}
          className="resize-none text-xs bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </div>

      {/* Footer */}
      <div className="flex gap-2 justify-between pt-1">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          ← Voltar
        </Button>
        <Button
          onClick={onConfirm}
          disabled={!canConfirm || saving}
          className="gap-2 border-0 text-white disabled:opacity-40 flex-1 max-w-[320px] shadow-lg shadow-primary/25"
          style={{
            background:
              "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))",
          }}
        >
          <CheckCircle2 className="w-4 h-4" />
          {saving ? "Concluindo..." : "Concluir e criar próxima tarefa"}
          {!saving && <ArrowRight className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}
