/**
 * Sprint 1 R4.2 + Refactor Nível 2 (2026-05-22) — Step 2 com seletor de Outcome.
 *
 * 4 outcomes para context='lead':
 *   ROTINA NORMAL                ENCERRAR LEAD
 *     ⦿ agendar (default)          ○ descartar (reengajável)
 *     ○ concluir                   ○ inativar (definitivo)
 *
 * Para context='negocio' o seletor é OCULTADO — apenas o caminho 'agendar'
 * permanece visível, preservando comportamento legado de negocios_tarefas.
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeftRight,
  CalendarPlus,
  CheckCheck,
  RotateCcw,
  Archive,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PROXIMA_TAREFA_OPTIONS,
  quickDates,
  DESCARTE_REASONS,
  INATIVAR_REASONS,
  type NovaTarefaPayload,
  type TipoProximaTarefa,
  type OutcomeChoice,
  type CompletionContext,
  type OutcomeReason,
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
  context: CompletionContext;
  outcome: OutcomeChoice;
  novaTarefa: NovaTarefaPayload;
  novoStageId?: string;
  reasonCode?: string;
  reasonCustomText?: string;
  observacaoCurta?: string;
  leadId?: string;
  currentStageId?: string;
  step1Descricao?: string;
  semContato?: {
    enabled: boolean;
    tentativaAtual: number;
    tentativaConcluida: number;
    requiresNextTask: boolean;
    finalAttempt: boolean;
  };
  onChangeOutcome: (v: OutcomeChoice) => void;
  onChangeNovaTarefa: (patch: Partial<NovaTarefaPayload>) => void;
  onChangeNovoStage: (v: string | undefined) => void;
  onChangeReasonCode: (v: string | undefined) => void;
  onChangeReasonCustomText: (v: string) => void;
  onChangeObservacaoCurta: (v: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  saving: boolean;
}

const KEEP_STAGE = "__keep__";

/* ─────────── Outcome selector (2 grupos × 2 opções) ─────────── */

const OUTCOME_OPTIONS: ReadonlyArray<{
  value: OutcomeChoice;
  label: string;
  description: string;
  Icon: typeof CalendarPlus;
  group: "rotina" | "encerrar";
  tone: "primary" | "neutral" | "warning" | "destructive";
}> = [
  {
    value: "agendar",
    label: "Agendar próxima tarefa",
    description: "Define quando voltar a falar",
    Icon: CalendarPlus,
    group: "rotina",
    tone: "primary",
  },
  {
    value: "concluir",
    label: "Apenas concluir",
    description: "Sem nova tarefa por enquanto",
    Icon: CheckCheck,
    group: "rotina",
    tone: "neutral",
  },
  {
    value: "descartar",
    label: "Descartar (reengajável)",
    description: "Move pra Descarte, pode voltar via oferta ativa",
    Icon: RotateCcw,
    group: "encerrar",
    tone: "warning",
  },
  {
    value: "inativar",
    label: "Inativar definitivo",
    description: "Arquiva o lead, fora de todos os fluxos",
    Icon: Archive,
    group: "encerrar",
    tone: "destructive",
  },
];

function OutcomeOption({
  opt,
  active,
  disabledReason,
  onSelect,
}: {
  opt: (typeof OUTCOME_OPTIONS)[number];
  active: boolean;
  disabledReason?: string;
  onSelect: () => void;
}) {
  const disabled = !!disabledReason;
  const toneCls =
    opt.tone === "primary"
      ? active
        ? "border-primary bg-primary/10 text-primary"
        : "border-border hover:border-primary/40"
      : opt.tone === "neutral"
        ? active
          ? "border-foreground/40 bg-muted text-foreground"
          : "border-border hover:border-foreground/30"
        : opt.tone === "warning"
          ? active
            ? "border-warning-500 bg-warning-500/10 text-warning-700 dark:text-warning-500"
            : "border-border hover:border-warning-500/40"
          : active
            ? "border-destructive bg-destructive/10 text-destructive"
            : "border-border hover:border-destructive/40";

  const Icon = opt.Icon;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      title={disabledReason}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-md border transition-all flex items-start gap-2.5",
        toneCls,
        disabled && "opacity-45 cursor-not-allowed hover:border-border",
      )}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs font-semibold leading-tight">{opt.label}</div>
        <div className="text-[10px] mt-0.5 opacity-70 leading-snug">
          {disabledReason || opt.description}
        </div>
      </div>
    </button>
  );
}

function OutcomeSelector({
  outcome,
  onChange,
  disabledReasons,
}: {
  outcome: OutcomeChoice;
  onChange: (v: OutcomeChoice) => void;
  disabledReasons?: Partial<Record<OutcomeChoice, string>>;
}) {
  const rotina = OUTCOME_OPTIONS.filter((o) => o.group === "rotina");
  const encerrar = OUTCOME_OPTIONS.filter((o) => o.group === "encerrar");
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
          Rotina normal
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {rotina.map((opt) => (
            <OutcomeOption
              key={opt.value}
              opt={opt}
              active={outcome === opt.value}
              disabledReason={disabledReasons?.[opt.value]}
              onSelect={() => onChange(opt.value)}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
          Encerrar lead
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {encerrar.map((opt) => (
            <OutcomeOption
              key={opt.value}
              opt={opt}
              active={outcome === opt.value}
              disabledReason={disabledReasons?.[opt.value]}
              onSelect={() => onChange(opt.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Subcomponentes condicionais ─────────── */

function ScheduleNextFields({
  novaTarefa,
  novoStageId,
  leadId,
  currentStageId,
  step1Descricao,
  semContato,
  onChangeNovaTarefa,
  onChangeNovoStage,
}: {
  novaTarefa: NovaTarefaPayload;
  novoStageId?: string;
  leadId?: string;
  currentStageId?: string;
  step1Descricao?: string;
  semContato?: Props["semContato"];
  onChangeNovaTarefa: (patch: Partial<NovaTarefaPayload>) => void;
  onChangeNovoStage: (v: string | undefined) => void;
}) {
  const { data: stages = [], isLoading: stagesLoading } = useStageOptions(
    currentStageId,
    !!leadId && !!currentStageId,
  );
  const currentStageNome =
    stages.find((s) => s.id === currentStageId)?.nome ?? "etapa atual";

  const applyQuick = (d: Date, h: string) => {
    onChangeNovaTarefa({ vence_em: dateToBRT(d), hora_vencimento: h });
  };

  return (
    <div className="space-y-3">
      {semContato?.enabled && semContato.requiresNextTask && (
        <div className="text-xs text-primary bg-primary/5 border border-primary/25 rounded-md p-3 flex items-start gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Ao concluir esta tarefa, o CRM registra a <strong>Tentativa {semContato.tentativaConcluida}</strong>.
            Para seguir a cadência Sem Contato, já deixe criada a próxima tarefa.
          </span>
        </div>
      )}

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
                onClick={() =>
                  onChangeNovaTarefa({ tipo: value as TipoProximaTarefa })
                }
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

      {leadId && currentStageId && (
        <div>
          <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-1.5 flex items-center gap-1.5">
            <ArrowLeftRight className="w-3 h-3" /> Mover etapa{" "}
            <span className="text-muted-foreground normal-case font-normal">
              (opcional)
            </span>
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

      <div>
        <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-1.5">
          Detalhes da próxima ação{" "}
          <span className="text-muted-foreground normal-case font-normal">
            (opcional)
          </span>
        </label>
        <Textarea
          placeholder={
            step1Descricao?.trim()
              ? `Herdar do Step 1: "${step1Descricao.trim().slice(0, 80)}${step1Descricao.trim().length > 80 ? "..." : ""}" (ou digite para sobrescrever)`
              : "Ex: Apresentar simulação do apto 301..."
          }
          value={novaTarefa.obs ?? ""}
          onChange={(e) => onChangeNovaTarefa({ obs: e.target.value })}
          rows={2}
          className="resize-none text-xs bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </div>
    </div>
  );
}

function OnlyCompleteFields({
  novoStageId,
  leadId,
  currentStageId,
  observacaoCurta,
  semContato,
  onChangeNovoStage,
  onChangeObservacaoCurta,
}: {
  novoStageId?: string;
  leadId?: string;
  currentStageId?: string;
  observacaoCurta?: string;
  semContato?: Props["semContato"];
  onChangeNovoStage: (v: string | undefined) => void;
  onChangeObservacaoCurta: (v: string) => void;
}) {
  const { data: stages = [], isLoading } = useStageOptions(
    currentStageId,
    !!leadId && !!currentStageId,
  );
  const currentStageNome =
    stages.find((s) => s.id === currentStageId)?.nome ?? "etapa atual";

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-md p-3">
        {semContato?.enabled && semContato.finalAttempt ? (
          <>
            A <strong>Tentativa 7</strong> será marcada como concluída. Não existe T8;
            depois disso o CRM entra no prazo final de 48h antes de estagnar.
          </>
        ) : (
          <>
            A tarefa atual será marcada como concluída sem agendar próxima.
            Você pode opcionalmente mover o lead de etapa.
          </>
        )}
      </div>

      {leadId && currentStageId && (
        <div>
          <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-1.5 flex items-center gap-1.5">
            <ArrowLeftRight className="w-3 h-3" /> Mover etapa{" "}
            <span className="text-muted-foreground normal-case font-normal">
              (opcional)
            </span>
          </label>
          <Select
            value={novoStageId ?? KEEP_STAGE}
            onValueChange={(v) =>
              onChangeNovoStage(v === KEEP_STAGE ? undefined : v)
            }
            disabled={isLoading || stages.length === 0}
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

      <div>
        <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-1.5">
          Por que não está agendando?{" "}
          <span className="text-muted-foreground normal-case font-normal">
            (opcional)
          </span>
        </label>
        <Textarea
          placeholder="Ex: Aguardando retorno do cliente sobre simulação..."
          value={observacaoCurta ?? ""}
          onChange={(e) => onChangeObservacaoCurta(e.target.value)}
          rows={2}
          className="resize-none text-xs bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </div>
    </div>
  );
}

function ReasonFields({
  reasons,
  reasonCode,
  reasonCustomText,
  observacaoCurta,
  warningMessage,
  onChangeReasonCode,
  onChangeReasonCustomText,
  onChangeObservacaoCurta,
}: {
  reasons: ReadonlyArray<OutcomeReason>;
  reasonCode?: string;
  reasonCustomText?: string;
  observacaoCurta?: string;
  warningMessage?: string;
  onChangeReasonCode: (v: string | undefined) => void;
  onChangeReasonCustomText: (v: string) => void;
  onChangeObservacaoCurta: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      {warningMessage && (
        <div className="text-xs text-destructive bg-destructive/5 border border-destructive/30 rounded-md p-3 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{warningMessage}</span>
        </div>
      )}

      <div>
        <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-1.5">
          Motivo <span className="text-destructive">*</span>
        </label>
        <Select
          value={reasonCode ?? ""}
          onValueChange={(v) => onChangeReasonCode(v || undefined)}
        >
          <SelectTrigger className="h-9 text-xs bg-background border-border text-foreground">
            <SelectValue placeholder="Selecione um motivo..." />
          </SelectTrigger>
          <SelectContent>
            {reasons.map((r) => (
              <SelectItem key={r.code} value={r.code}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {reasonCode === "outro" && (
        <div>
          <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-1.5">
            Especifique o motivo <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            value={reasonCustomText ?? ""}
            onChange={(e) => onChangeReasonCustomText(e.target.value)}
            placeholder="Descreva brevemente"
            className="h-9 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground/60"
          />
        </div>
      )}

      <div>
        <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-1.5">
          Observação adicional{" "}
          <span className="text-muted-foreground normal-case font-normal">
            (opcional)
          </span>
        </label>
        <Textarea
          placeholder="Detalhes ou contexto extra (anexado ao histórico)"
          value={observacaoCurta ?? ""}
          onChange={(e) => onChangeObservacaoCurta(e.target.value)}
          rows={2}
          className="resize-none text-xs bg-background border-border text-foreground placeholder:text-muted-foreground/60"
        />
      </div>
    </div>
  );
}

/* ─────────── CompletionStep2 (componente principal) ─────────── */

export function CompletionStep2({
  context,
  outcome,
  novaTarefa,
  novoStageId,
  reasonCode,
  reasonCustomText,
  observacaoCurta,
  leadId,
  currentStageId,
  step1Descricao,
  onChangeOutcome,
  onChangeNovaTarefa,
  onChangeNovoStage,
  onChangeReasonCode,
  onChangeReasonCustomText,
  onChangeObservacaoCurta,
  onBack,
  onConfirm,
  saving,
}: Props) {
  const semContatoDisabledReasons = useMemo(() => {
    if (!semContato?.enabled) return undefined;
    const disabled: Partial<Record<OutcomeChoice, string>> = {};
    if (semContato.requiresNextTask) {
      disabled.concluir = "Na etapa Sem Contato, T1 a T6 precisam deixar a próxima tarefa criada.";
    }
    if (semContato.finalAttempt) {
      disabled.agendar = "T7 é a última tentativa; não existe próxima tarefa automática.";
    }
    return disabled;
  }, [semContato]);

  const canConfirm = useMemo(() => {
    if (semContato?.enabled) {
      if (semContato.requiresNextTask && outcome === "concluir") return false;
      if (semContato.finalAttempt && outcome === "agendar") return false;
    }
    switch (outcome) {
      case "agendar":
        return (
          !!novaTarefa.tipo &&
          !!novaTarefa.vence_em &&
          !!novaTarefa.hora_vencimento
        );
      case "concluir":
        return true;
      case "descartar":
      case "inativar":
        return (
          !!reasonCode &&
          (reasonCode !== "outro" || !!reasonCustomText?.trim())
        );
      default:
        return false;
    }
  }, [outcome, novaTarefa, reasonCode, reasonCustomText, semContato]);

  const ctaConfig = useMemo(() => {
    switch (outcome) {
      case "agendar":
        return {
          label: semContato?.enabled
            ? "Concluir tentativa e criar próxima tarefa"
            : "Concluir e criar próxima tarefa",
          variant: "gradient" as const,
        };
      case "concluir":
        return {
          label: semContato?.enabled && semContato.finalAttempt ? "Concluir T7" : "Apenas concluir",
          variant: "neutral" as const,
        };
      case "descartar":
        return { label: "Descartar lead", variant: "warning" as const };
      case "inativar":
        return { label: "Inativar definitivo", variant: "destructive" as const };
    }
  }, [outcome, semContato]);

  return (
    <div className="p-5 space-y-4">
      {/* Negócios: pula o seletor (apenas Agendar é permitido) */}
      {context === "lead" && (
        <OutcomeSelector
          outcome={outcome}
          onChange={onChangeOutcome}
          disabledReasons={semContatoDisabledReasons}
        />
      )}

      {/* Campos condicionais por outcome */}
      {outcome === "agendar" && (
        <ScheduleNextFields
          novaTarefa={novaTarefa}
          novoStageId={novoStageId}
          leadId={leadId}
          currentStageId={currentStageId}
          step1Descricao={step1Descricao}
          semContato={semContato}
          onChangeNovaTarefa={onChangeNovaTarefa}
          onChangeNovoStage={onChangeNovoStage}
        />
      )}
      {outcome === "concluir" && (
        <OnlyCompleteFields
          novoStageId={novoStageId}
          leadId={leadId}
          currentStageId={currentStageId}
          observacaoCurta={observacaoCurta}
          semContato={semContato}
          onChangeNovoStage={onChangeNovoStage}
          onChangeObservacaoCurta={onChangeObservacaoCurta}
        />
      )}
      {outcome === "descartar" && (
        <ReasonFields
          reasons={DESCARTE_REASONS}
          reasonCode={reasonCode}
          reasonCustomText={reasonCustomText}
          observacaoCurta={observacaoCurta}
          onChangeReasonCode={onChangeReasonCode}
          onChangeReasonCustomText={onChangeReasonCustomText}
          onChangeObservacaoCurta={onChangeObservacaoCurta}
        />
      )}
      {outcome === "inativar" && (
        <ReasonFields
          reasons={INATIVAR_REASONS}
          reasonCode={reasonCode}
          reasonCustomText={reasonCustomText}
          observacaoCurta={observacaoCurta}
          warningMessage="Este lead não poderá receber mais contatos automáticos (Oferta Ativa, Reengajamento, etc)."
          onChangeReasonCode={onChangeReasonCode}
          onChangeReasonCustomText={onChangeReasonCustomText}
          onChangeObservacaoCurta={onChangeObservacaoCurta}
        />
      )}

      {/* Footer */}
      <div className="flex gap-2 justify-between pt-1">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          ← Voltar
        </Button>
        <Button
          onClick={onConfirm}
          disabled={!canConfirm || saving}
          className={cn(
            "gap-2 border-0 disabled:opacity-40 flex-1 max-w-[320px] shadow-lg",
            ctaConfig.variant === "gradient" &&
              "text-white shadow-primary/25",
            ctaConfig.variant === "neutral" &&
              "bg-foreground text-background hover:bg-foreground/90 shadow-foreground/10",
            ctaConfig.variant === "warning" &&
              "bg-warning-500 text-white hover:bg-warning-600 shadow-warning-500/30",
            ctaConfig.variant === "destructive" &&
              "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-destructive/30",
          )}
          style={
            ctaConfig.variant === "gradient"
              ? {
                  background:
                    "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))",
                }
              : undefined
          }
        >
          <CheckCircle2 className="w-4 h-4" />
          {saving ? "Salvando..." : ctaConfig.label}
          {!saving && ctaConfig.variant === "gradient" && (
            <ArrowRight className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
