import { memo } from "react";
import { CheckCircle2 } from "lucide-react";

type Modulo = "pipeline" | "agenda" | "negocios" | "pos_vendas";

const STEPS: { key: Modulo; label: string; color: string }[] = [
  { key: "pipeline", label: "Pipeline", color: "#3B82F6" },
  { key: "agenda", label: "Agenda", color: "#F59E0B" },
  { key: "negocios", label: "Negócio", color: "#22C55E" },
  { key: "pos_vendas", label: "Pós-venda", color: "#8B5CF6" },
];

interface Props {
  moduloAtual?: string;
  size?: "sm" | "md";
}

const JornadaLead = memo(function JornadaLead({ moduloAtual = "pipeline", size = "sm" }: Props) {
  const currentIdx = STEPS.findIndex(s => s.key === moduloAtual);
  const activeIdx = currentIdx >= 0 ? currentIdx : 0;

  const dotSize = size === "sm" ? 10 : 14;
  const lineW = size === "sm" ? 16 : 28;
  const fontSize = size === "sm" ? "8px" : "10px";
  const checkSize = size === "sm" ? 8 : 11;

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isPast = i < activeIdx;
        const isCurrent = i === activeIdx;
        const isFuture = i > activeIdx;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className="rounded-full flex items-center justify-center transition-all"
                style={{
                  width: dotSize,
                  height: dotSize,
                  backgroundColor: isFuture ? "hsl(var(--muted))" : step.color,
                  opacity: isPast ? 0.7 : 1,
                  animation: isCurrent ? "pulseDot 2s ease-in-out infinite" : undefined,
                  boxShadow: isCurrent ? `0 0 8px ${step.color}60` : undefined,
                }}
              >
                {isPast && <CheckCircle2 style={{ width: checkSize, height: checkSize, color: "white" }} />}
              </div>
              {size === "md" && (
                <span
                  className="font-medium whitespace-nowrap"
                  style={{
                    fontSize,
                    color: isFuture ? "hsl(var(--muted-foreground))" : step.color,
                    opacity: isFuture ? 0.5 : 1,
                  }}
                >
                  {step.label}
                </span>
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="rounded-full"
                style={{
                  width: lineW,
                  height: 2,
                  backgroundColor: i < activeIdx ? `${STEPS[i + 1].color}60` : "hsl(var(--muted))",
                  marginTop: size === "md" ? "-12px" : undefined,
                }}
              />
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
});

export default JornadaLead;
