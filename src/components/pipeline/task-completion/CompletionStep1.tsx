/**
 * Sprint 1 R3-V2 — Tela 1: "O que aconteceu?"
 * Campos obrigatórios: tipo_contato + resultado. descricao opcional.
 */
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
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

const TONE_STYLES: Record<
  "positive" | "neutral" | "warning" | "negative",
  { bg: string; border: string; text: string }
> = {
  positive: {
    bg: "rgba(34,197,94,0.16)",
    border: "rgba(34,197,94,0.55)",
    text: "#86efac",
  },
  warning: {
    bg: "rgba(234,179,8,0.16)",
    border: "rgba(234,179,8,0.55)",
    text: "#fde68a",
  },
  negative: {
    bg: "rgba(239,68,68,0.16)",
    border: "rgba(239,68,68,0.55)",
    text: "#fca5a5",
  },
  neutral: {
    bg: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.4)",
    text: "#cbd5e1",
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
  const canAdvance = !!tipoContato && !!resultado;

  return (
    <div className="p-5 space-y-5">
      {/* Canal de contato */}
      <div>
        <label className="text-[11px] uppercase tracking-wide font-semibold text-indigo-300 mb-2 flex items-center gap-1.5">
          Canal de contato <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TIPO_CONTATO_OPTIONS.map(({ value, label, Icon }) => {
            const active = tipoContato === value;
            return (
              <button
                key={value}
                onClick={() => onChangeTipo(value)}
                className="px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                style={
                  active
                    ? {
                        background:
                          "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))",
                        color: "#fff",
                        border: "1px solid transparent",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        color: "#cbd5e1",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }
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
        <label className="text-[11px] uppercase tracking-wide font-semibold text-indigo-300 mb-2 flex items-center gap-1.5">
          Resultado <span className="text-red-400">*</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {RESULTADO_OPTIONS.map(({ value, label, Icon, tone }) => {
            const active = resultado === value;
            const t = TONE_STYLES[tone];
            return (
              <button
                key={value}
                onClick={() => onChangeResultado(value)}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                style={
                  active
                    ? {
                        background: t.bg,
                        color: t.text,
                        border: `1px solid ${t.border}`,
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        color: "#94a3b8",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumo (opcional) */}
      <div>
        <label className="text-[11px] uppercase tracking-wide font-semibold text-indigo-300 mb-1.5 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> Resumo <span className="text-gray-500 normal-case font-normal">(opcional)</span>
        </label>
        <Textarea
          placeholder="Ex: Cliente pediu para ligar amanhã às 14h, demonstrou interesse no apto 301..."
          value={descricao}
          onChange={(e) => onChangeDescricao(e.target.value)}
          rows={3}
          className="resize-none text-sm bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-indigo-500/40"
        />
      </div>

      {/* Footer */}
      <div className="flex gap-2 justify-between pt-1">
        <Button
          variant="outline"
          onClick={onCancel}
          className="bg-transparent border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
        >
          Cancelar
        </Button>
        <Button
          onClick={onNext}
          disabled={!canAdvance}
          className="gap-2 border-0 text-white disabled:opacity-40"
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
