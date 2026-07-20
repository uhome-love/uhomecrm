/**
 * CompletionForm — Redesign single-screen (2026-07-20)
 *
 * Fusão dos antigos CompletionStep1 + CompletionStep2 num único formulário
 * scrollável com CTA fixo (sticky) no rodapé. Não navega mais entre telas
 * "1/2" e não expõe botão "Próximo" no meio.
 *
 * Hierarquia visual:
 *   1. Canal de contato + Resultado (compactos, lado a lado quando cabe)
 *   2. Observação (textarea obrigatória)
 *   3. Card principal "Agendar" (default, destacado) com sugestão do Homi
 *      pré-aplicada quando confiança alta + link "Ajustar manualmente"
 *   4. Link discreto "Só concluir, sem agendar próxima"
 *   5. Dois botões secundários menores "Descartar" / "Inativar"
 *      (context='lead' apenas)
 *   6. CTA sticky no rodapé
 *
 * Compatibilidade: a interface pública de TaskCompletionDialog (props +
 * CompletionPayload) NÃO muda. Este arquivo é interno.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  RotateCcw,
  Archive,
  Sparkles,
  X,
} from "lucide-react";
import { cn, dateToBRT } from "@/lib/utils";
import {
  DESCARTE_REASONS,
  INATIVAR_REASONS,
  PROXIMA_TAREFA_OPTIONS,
  quickDates,
  RESULTADO_OPTIONS,
  TIPO_CONTATO_OPTIONS,
  type CompletionContext,
  type NovaTarefaPayload,
  type OutcomeChoice,
  type OutcomeReason,
  type Resultado,
  type TipoContato,
  type TipoProximaTarefa,
} from "./types";
import { useStageOptions } from "./useStageOptions";
import { QUALIFICACAO_STATUS_ATEND } from "@/components/pipeline/PipelineStageTransitionPopup";
import { VisitaDatePicker } from "@/components/pipeline/QualificacaoChecklistCard";
import type { DataOverride } from "@/lib/qualificacaoTaskEngine";

const KEEP_STAGE = "__keep__";

type ResultadoTone = "positive" | "neutral" | "warning" | "negative";

const RESULTADO_TONE: Record<
  ResultadoTone,
  { base: string; selected: string; icon: string }
> = {
  positive: {
    base: "bg-success-500/10 border-success-500/30 text-foreground hover:bg-success-500/15",
    selected: "bg-success-500/15 border-success-500 text-foreground ring-2 ring-success-500/30",
    icon: "text-success-700 dark:text-success-500",
  },
  warning: {
    base: "bg-warning-500/10 border-warning-500/30 text-foreground hover:bg-warning-500/15",
    selected: "bg-warning-500/15 border-warning-500 text-foreground ring-2 ring-warning-500/30",
    icon: "text-warning-700 dark:text-warning-500",
  },
  negative: {
    base: "bg-destructive/10 border-destructive/30 text-foreground hover:bg-destructive/15",
    selected: "bg-destructive/15 border-destructive text-foreground ring-2 ring-destructive/30",
    icon: "text-destructive",
  },
  neutral: {
    base: "bg-muted border-border text-muted-foreground hover:bg-muted/70",
    selected: "bg-muted border-foreground/30 text-foreground ring-2 ring-foreground/10",
    icon: "text-muted-foreground",
  },
};

export interface CompletionFormProps {
  context: CompletionContext;
  tarefaTitulo: string;
  leadNome?: string;
  leadId?: string;
  currentStageId?: string;
  semContato: {
    enabled: boolean;
    tentativaAtual: number;
    tentativaConcluida: number;
    requiresNextTask: boolean;
    finalAttempt: boolean;
    /** true quando a tarefa sendo concluída pertence à cadência automática (tarefaOrigem === "cadencia_sem_contato").
     *  Nesse caso o sistema cria a próxima via trigger; travamos o "Agendar" manual pra não duplicar. */
    isCadenciaTask: boolean;
  };

  // Step 1 state
  tipoContato?: TipoContato;
  resultado?: Resultado;
  descricao: string;

  // Outcome state
  outcome: OutcomeChoice;
  novaTarefa: NovaTarefaPayload;
  novoStageId?: string;
  reasonCode?: string;
  reasonCustomText?: string;
  observacaoCurta?: string;

  saving: boolean;

  /** Qualificação mode: substitui a seção "próxima tarefa" pelas 6 pills de status_atendimento. */
  qualificacao?: {
    currentStatus: string;
    pillStatus: string;
    dataOverride?: DataOverride;
    onPickPill: (statusKey: string) => void;
    onPickData: (dt: DataOverride | undefined, hora: string) => void;
  };

  onChangeTipo: (v: TipoContato) => void;
  onChangeResultado: (v: Resultado) => void;
  onChangeDescricao: (v: string) => void;
  onChangeOutcome: (v: OutcomeChoice) => void;
  onChangeNovaTarefa: (patch: Partial<NovaTarefaPayload>) => void;
  onChangeNovoStage: (v: string | undefined) => void;
  onChangeReasonCode: (v: string | undefined) => void;
  onChangeReasonCustomText: (v: string) => void;
  onChangeObservacaoCurta: (v: string) => void;

  onCancel: () => void;
  onConfirm: () => void;
}

export function CompletionForm(props: CompletionFormProps) {
  const {
    context,
    tarefaTitulo,
    leadNome,
    leadId,
    currentStageId,
    semContato,
    tipoContato,
    resultado,
    descricao,
    outcome,
    novaTarefa,
    novoStageId,
    reasonCode,
    reasonCustomText,
    observacaoCurta,
    saving,
    qualificacao,
    onChangeTipo,
    onChangeResultado,
    onChangeDescricao,
    onChangeOutcome,
    onChangeNovaTarefa,
    onChangeNovoStage,
    onChangeReasonCode,
    onChangeReasonCustomText,
    onChangeObservacaoCurta,
    onCancel,
    onConfirm,
  } = props;

  const descricaoValida = descricao.trim().length >= 3;
  const step1Ready = !!tipoContato && !!resultado && descricaoValida;

  /* ─── Sugestão do Homi (persiste enquanto o dialog está aberto) ─── */
  const [suggestion, setSuggestion] = useState<null | {
    tipo: TipoProximaTarefa;
    vence_em: string;
    hora_vencimento: string;
  }>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    const texto = descricao.trim();
    if (texto.length < 10) return;
    if (fetchedFor.current === texto) return;
    fetchedFor.current = texto;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    (async () => {
      try {
        const dataReferencia = dateToBRT(new Date());
        const { data, error } = await supabase.functions.invoke(
          "homi-next-task-suggestion",
          { body: { texto, dataReferencia } },
        );
        if (error) return;
        if (data?.confianca === "alta" && data?.vence_em && data?.hora_vencimento) {
          setSuggestion({
            tipo: data.tipo,
            vence_em: data.vence_em,
            hora_vencimento: data.hora_vencimento,
          });
        }
      } catch {
        /* silencioso */
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [descricao]);

  // Aplica sugestão automaticamente na primeira vez (default pré-preenchido).
  const appliedSuggestionRef = useRef(false);
  useEffect(() => {
    if (!suggestion || appliedSuggestionRef.current || suggestionDismissed) return;
    // Só aplica se o usuário ainda não editou manualmente vence_em/hora
    appliedSuggestionRef.current = true;
    onChangeNovaTarefa({
      tipo: suggestion.tipo,
      vence_em: suggestion.vence_em,
      hora_vencimento: suggestion.hora_vencimento,
    });
  }, [suggestion, suggestionDismissed, onChangeNovaTarefa]);

  const suggestionLabel = useMemo(() => {
    if (!suggestion) return null;
    const tipoLabel =
      PROXIMA_TAREFA_OPTIONS.find((o) => o.value === suggestion.tipo)?.label ??
      suggestion.tipo;
    const [y, m, d] = suggestion.vence_em.split("-").map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    const diaSemana = dt.toLocaleDateString("pt-BR", { weekday: "long" });
    const diaMes = dt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    return `${tipoLabel} — ${diaSemana}, ${diaMes} às ${suggestion.hora_vencimento}`;
  }, [suggestion]);

  /* ─── "Ajustar manualmente" (colapsável no card Agendar) ─── */
  const [manualOpen, setManualOpen] = useState(false);
  // Auto-abre se o usuário tiver descartado a sugestão ou não houver sugestão E ele tenha rolado até o outcome
  const shouldShowManual = manualOpen || !suggestion || suggestionDismissed;

  /* ─── Stage options ─── */
  const { data: stages = [], isLoading: stagesLoading } = useStageOptions(
    currentStageId,
    !!leadId && !!currentStageId,
  );
  const currentStageNome =
    stages.find((s) => s.id === currentStageId)?.nome ?? "etapa atual";

  /* ─── canConfirm ─── */
  const canConfirm = useMemo(() => {
    if (!step1Ready) return false;
    if (semContato.enabled) {
      if (semContato.requiresNextTask && outcome === "concluir") return false;
      if (semContato.finalAttempt && outcome === "agendar") return false;
    }
    switch (outcome) {
      case "agendar":
        if (qualificacao) {
          if (!qualificacao.pillStatus) return false;
          if (
            qualificacao.pillStatus === "alinhando_visita" &&
            !qualificacao.dataOverride
          )
            return false;
          return true;
        }
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
          !!reasonCode && (reasonCode !== "outro" || !!reasonCustomText?.trim())
        );
      default:
        return false;
    }
  }, [
    step1Ready,
    outcome,
    novaTarefa,
    reasonCode,
    reasonCustomText,
    semContato,
    qualificacao,
  ]);

  const ctaConfig = useMemo(() => {
    switch (outcome) {
      case "agendar":
        return {
          label: semContato.enabled
            ? "Concluir tentativa e criar próxima"
            : "Concluir e criar próxima",
          variant: "gradient" as const,
        };
      case "concluir":
        return {
          label:
            semContato.enabled && semContato.finalAttempt
              ? "Concluir T7"
              : "Apenas concluir",
          variant: "neutral" as const,
        };
      case "descartar":
        return { label: "Descartar lead", variant: "warning" as const };
      case "inativar":
        return { label: "Inativar definitivo", variant: "destructive" as const };
    }
  }, [outcome, semContato]);

  const applyQuick = (d: Date, h: string) => {
    onChangeNovaTarefa({ vence_em: dateToBRT(d), hora_vencimento: h });
  };

  // Dedup: alguns títulos antigos vêm com o nome embutido ("Confirmar visita — Juliana");
  // não repetir " · Juliana" ao lado.
  const nomeJaNoTitulo =
    !!leadNome && tarefaTitulo.toLowerCase().includes(leadNome.toLowerCase());
  const subtitleText = `${tarefaTitulo}${leadNome && !nomeJaNoTitulo ? ` · ${leadNome}` : ""}`;

  return (
    <div className="flex flex-col max-h-[90vh] max-[420px]:max-h-[92vh]">
      {/* Header compacto */}
      <div className="px-4 pt-4 pb-3 border-b border-border/60 shrink-0">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          Concluir tarefa
        </div>
        <div className="text-sm font-semibold text-foreground truncate mt-0.5">
          {subtitleText}
        </div>
      </div>

      {/* Corpo scrollável */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* 1. Canal + Resultado (lado a lado no desktop) */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1.5 flex items-center gap-1">
              Canal <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {TIPO_CONTATO_OPTIONS.map(({ value, label, Icon }) => {
                const active = tipoContato === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChangeTipo(value)}
                    className={cn(
                      "px-2 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 border",
                      active
                        ? "border-transparent text-white shadow-sm"
                        : "bg-background border-border text-foreground hover:bg-muted",
                    )}
                    style={
                      active
                        ? {
                            background:
                              "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))",
                          }
                        : undefined
                    }
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1.5 flex items-center gap-1">
              Resultado <span className="text-destructive">*</span>
            </label>
            <div className="flex flex-wrap gap-1">
              {RESULTADO_OPTIONS.map(({ value, label, Icon, tone }) => {
                const active = resultado === value;
                const t = RESULTADO_TONE[tone as ResultadoTone];
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChangeResultado(value)}
                    className={cn(
                      "px-2 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 border",
                      active ? t.selected : t.base,
                    )}
                  >
                    <Icon className={cn("w-3 h-3", t.icon)} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2. Observação */}
        <div>
          <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Observação <span className="text-destructive">*</span>
          </label>
          <Textarea
            placeholder="Ex: Cliente pediu para ligar amanhã às 14h, interessado no apto 301..."
            value={descricao}
            onChange={(e) => onChangeDescricao(e.target.value)}
            rows={2}
            className={cn(
              "resize-none text-xs bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/20",
              descricao.length > 0 &&
                !descricaoValida &&
                "border-destructive focus-visible:ring-destructive/20",
            )}
          />
          {descricao.length > 0 && !descricaoValida && (
            <p className="text-[10px] text-destructive mt-0.5">
              Mínimo 3 caracteres.
            </p>
          )}
        </div>

        {/* Divisor: "Como prosseguir?" */}
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 h-px bg-border/60" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            {context === "lead" ? "Como prosseguir?" : "Quando voltar?"}
          </span>
          <div className="flex-1 h-px bg-border/60" />
        </div>

        {/* 3. Cartão principal — Agendar (default destacado) */}
        {outcome === "agendar" && !(semContato.enabled && semContato.finalAttempt) && (
          qualificacao ? (
            <QualificacaoPillsBlock
              pillStatus={qualificacao.pillStatus}
              currentStatus={qualificacao.currentStatus}
              dataOverride={qualificacao.dataOverride}
              onPickPill={qualificacao.onPickPill}
              onPickData={qualificacao.onPickData}
            />
          ) : (
            <AgendarCard
              novaTarefa={novaTarefa}
              novoStageId={novoStageId}
              leadId={leadId}
              currentStageId={currentStageId}
              currentStageNome={currentStageNome}
              stages={stages}
              stagesLoading={stagesLoading}
              suggestion={suggestion}
              suggestionLabel={suggestionLabel}
              suggestionDismissed={suggestionDismissed}
              onDismissSuggestion={() => setSuggestionDismissed(true)}
              manualOpen={shouldShowManual}
              onToggleManual={() => setManualOpen((v) => !v)}
              semContato={semContato}
              onChangeNovaTarefa={onChangeNovaTarefa}
              onChangeNovoStage={onChangeNovoStage}
              onApplyQuick={applyQuick}
            />
          )
        )}

        {/* Only-Complete */}
        {outcome === "concluir" && (
          <OnlyCompleteBlock
            novoStageId={novoStageId}
            leadId={leadId}
            currentStageId={currentStageId}
            currentStageNome={currentStageNome}
            stages={stages}
            stagesLoading={stagesLoading}
            observacaoCurta={observacaoCurta}
            semContato={semContato}
            onChangeNovoStage={onChangeNovoStage}
            onChangeObservacaoCurta={onChangeObservacaoCurta}
            onBackToAgendar={
              semContato.enabled && semContato.finalAttempt
                ? undefined
                : () => onChangeOutcome("agendar")
            }
          />
        )}

        {(outcome === "descartar" || outcome === "inativar") && (
          <ReasonBlock
            outcome={outcome}
            reasons={
              outcome === "descartar" ? DESCARTE_REASONS : INATIVAR_REASONS
            }
            reasonCode={reasonCode}
            reasonCustomText={reasonCustomText}
            observacaoCurta={observacaoCurta}
            warningMessage={
              outcome === "inativar"
                ? "Este lead não poderá receber mais contatos automáticos (Oferta Ativa, Reengajamento, etc)."
                : undefined
            }
            onChangeReasonCode={onChangeReasonCode}
            onChangeReasonCustomText={onChangeReasonCustomText}
            onChangeObservacaoCurta={onChangeObservacaoCurta}
            onBackToAgendar={() => onChangeOutcome("agendar")}
          />
        )}

        {/* 4. Link discreto: "Só concluir sem agendar próxima" */}
        {outcome === "agendar" &&
          !(semContato.enabled && semContato.requiresNextTask) && (
            <button
              type="button"
              onClick={() => onChangeOutcome("concluir")}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Só concluir, sem agendar próxima
            </button>
          )}

        {/* 5. Botões secundários — Encerrar lead (só context=lead) */}
        {context === "lead" &&
          outcome !== "descartar" &&
          outcome !== "inativar" && (
            <div className="pt-2 border-t border-border/40">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                Encerrar lead
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangeOutcome("descartar")}
                  className="px-2 py-1.5 rounded-md text-[11px] font-medium border border-warning-500/30 bg-warning-500/5 text-warning-700 dark:text-warning-500 hover:bg-warning-500/10 hover:border-warning-500/60 transition-colors flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={() => onChangeOutcome("inativar")}
                  className="px-2 py-1.5 rounded-md text-[11px] font-medium border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:border-destructive/60 transition-colors flex items-center justify-center gap-1"
                >
                  <Archive className="w-3 h-3" />
                  Inativar
                </button>
              </div>
            </div>
          )}
      </div>

      {/* CTA fixo no rodapé */}
      <div className="px-4 py-3 border-t border-border/60 bg-card shrink-0 flex gap-2 items-center max-[420px]:flex-col max-[420px]:gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={saving}
          className="max-[420px]:w-full max-[420px]:order-2"
        >
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          disabled={!canConfirm || saving}
          size="sm"
          className={cn(
            "flex-1 gap-1.5 border-0 disabled:opacity-40 shadow-md max-[420px]:w-full max-[420px]:order-1",
            ctaConfig.variant === "gradient" && "text-white shadow-primary/25",
            ctaConfig.variant === "neutral" &&
              "bg-foreground text-background hover:bg-foreground/90",
            ctaConfig.variant === "warning" &&
              "bg-warning-500 text-white hover:bg-warning-600",
            ctaConfig.variant === "destructive" &&
              "bg-destructive text-destructive-foreground hover:bg-destructive/90",
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
          <CheckCircle2 className="w-3.5 h-3.5" />
          {saving ? "Salvando..." : ctaConfig.label}
          {!saving && ctaConfig.variant === "gradient" && (
            <ArrowRight className="w-3 h-3" />
          )}
        </Button>
      </div>
    </div>
  );
}

/* ─────────── Sub-blocos ─────────── */

function AgendarCard({
  novaTarefa,
  novoStageId,
  leadId,
  currentStageId,
  currentStageNome,
  stages,
  stagesLoading,
  suggestion,
  suggestionLabel,
  suggestionDismissed,
  onDismissSuggestion,
  manualOpen,
  onToggleManual,
  semContato,
  onChangeNovaTarefa,
  onChangeNovoStage,
  onApplyQuick,
}: {
  novaTarefa: NovaTarefaPayload;
  novoStageId?: string;
  leadId?: string;
  currentStageId?: string;
  currentStageNome: string;
  stages: Array<{ id: string; nome: string }>;
  stagesLoading: boolean;
  suggestion: {
    tipo: TipoProximaTarefa;
    vence_em: string;
    hora_vencimento: string;
  } | null;
  suggestionLabel: string | null;
  suggestionDismissed: boolean;
  onDismissSuggestion: () => void;
  manualOpen: boolean;
  onToggleManual: () => void;
  semContato: CompletionFormProps["semContato"];
  onChangeNovaTarefa: (patch: Partial<NovaTarefaPayload>) => void;
  onChangeNovoStage: (v: string | undefined) => void;
  onApplyQuick: (d: Date, h: string) => void;
}) {
  const showSuggestionCard = suggestion && !suggestionDismissed;

  return (
    <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-white"
          style={{
            background:
              "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))",
          }}
        >
          <CalendarPlus className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground">
            Agendar próxima tarefa
          </div>
          <div className="text-[10px] text-muted-foreground">
            Caminho recomendado — mantém o lead ativo
          </div>
        </div>
      </div>

      {semContato.enabled && semContato.requiresNextTask && (
        <div className="text-[10.5px] text-primary bg-primary/10 border border-primary/25 rounded-md p-2 flex items-start gap-1.5">
          <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            Concluir esta tarefa registra a{" "}
            <strong>Tentativa {semContato.tentativaConcluida}</strong>. Deixe a
            próxima criada para seguir a cadência.
          </span>
        </div>
      )}
      {semContato.enabled &&
        !semContato.requiresNextTask &&
        !semContato.finalAttempt && (
          <div className="text-[10.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2 flex items-start gap-1.5 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              A próxima (T{semContato.tentativaConcluida + 1}) é criada
              automaticamente pelo CRM.
            </span>
          </div>
        )}

      {showSuggestionCard && (
        <div className="text-[11px] bg-card border border-primary/40 rounded-md p-2.5 flex items-start gap-1.5 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-primary mb-0.5 flex items-center gap-1">
              💡 Sugestão do Homi
              <span className="text-[9px] font-normal text-muted-foreground bg-primary/10 rounded px-1 py-px">
                aplicada
              </span>
            </div>
            <div className="text-foreground">{suggestionLabel}</div>
          </div>
          <button
            type="button"
            onClick={onDismissSuggestion}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Dispensar sugestão"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Toggle Ajustar manualmente */}
      <button
        type="button"
        onClick={onToggleManual}
        className="text-[11px] text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
      >
        {manualOpen ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        Ajustar manualmente
      </button>

      {manualOpen && (
        <div className="space-y-2.5 pt-1.5 border-t border-primary/20">
          {/* Tipo */}
          <div>
            <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1 block">
              Tipo
            </label>
            <div className="grid grid-cols-3 gap-1">
              {PROXIMA_TAREFA_OPTIONS.map(({ value, label, Icon }) => {
                const active = novaTarefa.tipo === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      onChangeNovaTarefa({ tipo: value as TipoProximaTarefa })
                    }
                    className={cn(
                      "px-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center justify-center gap-1 border",
                      active
                        ? "bg-primary/15 border-primary text-primary"
                        : "bg-background border-border text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quando */}
          <div>
            <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1 block">
              Quando
            </label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {quickDates().map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => onApplyQuick(q.d, q.h)}
                  className="text-[10px] px-1.5 py-0.5 rounded transition-colors border bg-muted border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1 bg-background border border-border rounded-md px-2">
                <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                <Input
                  type="date"
                  value={novaTarefa.vence_em}
                  onChange={(e) =>
                    onChangeNovaTarefa({ vence_em: e.target.value })
                  }
                  className="h-7 text-[11px] border-0 bg-transparent px-1 focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center gap-1 bg-background border border-border rounded-md px-2">
                <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                <Input
                  type="time"
                  value={novaTarefa.hora_vencimento}
                  onChange={(e) =>
                    onChangeNovaTarefa({ hora_vencimento: e.target.value })
                  }
                  className="h-7 text-[11px] border-0 bg-transparent px-1 focus-visible:ring-0"
                />
              </div>
            </div>
          </div>

          {/* Mover etapa */}
          {leadId && currentStageId && (
            <div>
              <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1 flex items-center gap-1">
                <ArrowLeftRight className="w-2.5 h-2.5" /> Mover etapa
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
                <SelectTrigger className="h-8 text-[11px] bg-background border-border text-foreground">
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

          {/* Detalhes da próxima */}
          <div>
            <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1 block">
              Detalhes da próxima ação{" "}
              <span className="text-muted-foreground normal-case font-normal">
                (opcional)
              </span>
            </label>
            <Textarea
              placeholder="Ex: Apresentar simulação do apto 301..."
              value={novaTarefa.obs ?? ""}
              onChange={(e) => onChangeNovaTarefa({ obs: e.target.value })}
              rows={2}
              className="resize-none text-[11px] bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function OnlyCompleteBlock({
  novoStageId,
  leadId,
  currentStageId,
  currentStageNome,
  stages,
  stagesLoading,
  observacaoCurta,
  semContato,
  onChangeNovoStage,
  onChangeObservacaoCurta,
  onBackToAgendar,
}: {
  novoStageId?: string;
  leadId?: string;
  currentStageId?: string;
  currentStageNome: string;
  stages: Array<{ id: string; nome: string }>;
  stagesLoading: boolean;
  observacaoCurta?: string;
  semContato: CompletionFormProps["semContato"];
  onChangeNovoStage: (v: string | undefined) => void;
  onChangeObservacaoCurta: (v: string) => void;
  onBackToAgendar?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground">
            Apenas concluir
          </div>
          <div className="text-[10.5px] text-muted-foreground">
            {semContato.enabled && semContato.finalAttempt ? (
              <>
                <strong>T7</strong> concluída. Sem próxima tentativa; entra no
                prazo final de 48h.
              </>
            ) : (
              <>Sem agendar próxima tarefa. Pode mover de etapa opcionalmente.</>
            )}
          </div>
        </div>
        {onBackToAgendar && (
          <button
            type="button"
            onClick={onBackToAgendar}
            className="text-[10px] text-primary hover:underline shrink-0"
          >
            ← Agendar
          </button>
        )}
      </div>

      {leadId && currentStageId && (
        <div>
          <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1 flex items-center gap-1">
            <ArrowLeftRight className="w-2.5 h-2.5" /> Mover etapa
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
            <SelectTrigger className="h-8 text-[11px] bg-background border-border text-foreground">
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
        <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1 block">
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
          className="resize-none text-[11px] bg-background border-border text-foreground placeholder:text-muted-foreground/60"
        />
      </div>
    </div>
  );
}

function ReasonBlock({
  outcome,
  reasons,
  reasonCode,
  reasonCustomText,
  observacaoCurta,
  warningMessage,
  onChangeReasonCode,
  onChangeReasonCustomText,
  onChangeObservacaoCurta,
  onBackToAgendar,
}: {
  outcome: "descartar" | "inativar";
  reasons: ReadonlyArray<OutcomeReason>;
  reasonCode?: string;
  reasonCustomText?: string;
  observacaoCurta?: string;
  warningMessage?: string;
  onChangeReasonCode: (v: string | undefined) => void;
  onChangeReasonCustomText: (v: string) => void;
  onChangeObservacaoCurta: (v: string) => void;
  onBackToAgendar: () => void;
}) {
  const isInativar = outcome === "inativar";
  const border = isInativar ? "border-destructive/40" : "border-warning-500/40";
  const bg = isInativar ? "bg-destructive/5" : "bg-warning-500/5";
  const Icon = isInativar ? Archive : RotateCcw;
  const title = isInativar ? "Inativar definitivo" : "Descartar (reengajável)";
  const desc = isInativar
    ? "Arquiva o lead e sai de todos os fluxos"
    : "Move para Descarte; pode voltar via oferta ativa";

  return (
    <div className={cn("rounded-lg border-2 p-3 space-y-2.5", border, bg)}>
      <div className="flex items-start gap-1.5">
        <Icon
          className={cn(
            "w-4 h-4 mt-0.5 shrink-0",
            isInativar ? "text-destructive" : "text-warning-700 dark:text-warning-500",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground">{title}</div>
          <div className="text-[10.5px] text-muted-foreground">{desc}</div>
        </div>
        <button
          type="button"
          onClick={onBackToAgendar}
          className="text-[10px] text-primary hover:underline shrink-0"
        >
          ← Voltar
        </button>
      </div>

      {warningMessage && (
        <div className="text-[10.5px] text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{warningMessage}</span>
        </div>
      )}

      <div>
        <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1 block">
          Motivo <span className="text-destructive">*</span>
        </label>
        <Select
          value={reasonCode ?? ""}
          onValueChange={(v) => onChangeReasonCode(v || undefined)}
        >
          <SelectTrigger className="h-8 text-[11px] bg-background border-border text-foreground">
            <SelectValue placeholder="Selecione..." />
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
          <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1 block">
            Especifique <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            value={reasonCustomText ?? ""}
            onChange={(e) => onChangeReasonCustomText(e.target.value)}
            placeholder="Descreva brevemente"
            className="h-8 text-[11px] bg-background border-border text-foreground placeholder:text-muted-foreground/60"
          />
        </div>
      )}

      <div>
        <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1 block">
          Observação adicional{" "}
          <span className="text-muted-foreground normal-case font-normal">
            (opcional)
          </span>
        </label>
        <Textarea
          placeholder="Detalhes extras (vai para o histórico)"
          value={observacaoCurta ?? ""}
          onChange={(e) => onChangeObservacaoCurta(e.target.value)}
          rows={2}
          className="resize-none text-[11px] bg-background border-border text-foreground placeholder:text-muted-foreground/60"
        />
      </div>
    </div>
  );
}

/* ─── QualificacaoPillsBlock ───
   Substitui a seção de "Agendar próxima tarefa" quando o lead está em stage tipo=qualificacao.
   Exibe as 6 pills de QUALIFICACAO_STATUS_ATEND; ao selecionar 'alinhando_visita' abre o
   VisitaDatePicker inline (Hoje / Amanhã / Escolher data). O motor real de tarefas é
   disparado no TaskCompletionDialog via advanceQualificacaoStatus. */
function QualificacaoPillsBlock({
  pillStatus,
  currentStatus,
  dataOverride,
  onPickPill,
  onPickData,
}: {
  pillStatus: string;
  currentStatus: string;
  dataOverride?: DataOverride;
  onPickPill: (statusKey: string) => void;
  /** Recebe (data, hora HH:MM) — hora sempre presente. */
  onPickData: (dt: DataOverride | undefined, hora: string) => void;
}) {
  const showDatePicker = pillStatus === "alinhando_visita";
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground">
          Etapa do atendimento
        </span>
        {currentStatus && (
          <span className="text-[10px] text-muted-foreground">
            atual: {QUALIFICACAO_STATUS_ATEND[currentStatus] ?? currentStatus}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(QUALIFICACAO_STATUS_ATEND).map(([key, label]) => {
          const active = pillStatus === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickPill(key)}
              className={[
                "px-2.5 py-1 rounded-full text-[11px] border transition",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>
      {showDatePicker && (
        <div className="pt-1 border-t border-border/50">
          <VisitaDatePicker onPick={(d, h) => onPickData(d, h)} />
          {dataOverride && (
            <div className="text-[10px] text-primary mt-1.5">
              ✓ {dataOverride === "hoje" ? "Hoje" : dataOverride === "amanha" ? "Amanhã" : dataOverride}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
