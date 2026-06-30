/**
 * Sprint 1 R4.2 — Tela 1: "O que aconteceu?"
 * Campos obrigatórios: tipo_contato + resultado. descricao opcional.
 * Adapta ao tema dark/light via tokens semânticos.
 */
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TIPO_CONTATO_OPTIONS,
  RESULTADO_OPTIONS,
  type TipoContato,
  type Resultado,
} from "./types";

interface Props {
  tipoContato?: TipoContato;
  resultado?: Resultado;
  descricao: string;
  onChangeTipo: (v: TipoContato) => void;
  onChangeResultado: (v: Resultado) => void;
  onChangeDescricao: (v: string) => void;
  onCancel: () => void;
  onNext: () => void;
}

type Tone = "positive" | "neutral" | "warning" | "negative";

const TONE_STYLES: Record<
  Tone,
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

export function CompletionStep1({
  tipoContato,
  resultado,
  descricao,
  onChangeTipo,
  onChangeResultado,
  onChangeDescricao,
  onCancel,
  onNext,
}: Props) {
  const descricaoValida = descricao.trim().length >= 3;
  const canAdvance = !!tipoContato && !!resultado && descricaoValida;

  return (
    <div className="p-5 space-y-5">
      {/* Canal de contato */}
      <div>
        <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-2 flex items-center gap-1.5">
          Canal de contato <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TIPO_CONTATO_OPTIONS.map(({ value, label, Icon }) => {
            const active = tipoContato === value;
            return (
              <button
                key={value}
                onClick={() => onChangeTipo(value)}
                className={cn(
                  "px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border",
                  active
                    ? "border-transparent text-white"
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
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Resultado */}
      <div>
        <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-2 flex items-center gap-1.5">
          Resultado <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {RESULTADO_OPTIONS.map(({ value, label, Icon, tone }) => {
            const active = resultado === value;
            const t = TONE_STYLES[tone as Tone];
            return (
              <button
                key={value}
                onClick={() => onChangeResultado(value)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border",
                  active ? t.selected : t.base,
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", t.icon)} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Observação (obrigatória) */}
      <div>
        <label className="text-[11px] uppercase tracking-wide font-semibold text-primary mb-1.5 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> Observação{" "}
          <span className="text-destructive">*</span>
        </label>
        <Textarea
          placeholder="Ex: Cliente pediu para ligar amanhã às 14h, demonstrou interesse no apto 301..."
          value={descricao}
          onChange={(e) => onChangeDescricao(e.target.value)}
          rows={3}
          className={cn(
            "resize-none text-sm bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/20",
            descricao.length > 0 && !descricaoValida && "border-destructive focus-visible:ring-destructive/20",
          )}
        />
        {!descricaoValida && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Obrigatória — descreva o que foi tratado para concluir a tarefa.
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 justify-between pt-1">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={onNext}
          disabled={!canAdvance}
          className="gap-2 border-0 text-white disabled:opacity-40 shadow-lg shadow-primary/25"
          style={{
            background:
              "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))",
          }}
        >
          Próximo →
        </Button>
      </div>
    </div>
  );
}
