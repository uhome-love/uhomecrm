/**
 * Sprint 1 R4.2 — Header com barra de progresso 50% / 100% + título Fraunces
 * Adapta ao tema dark/light do CRM. Mantém identidade: ícone indigo + fill gradient HOMI.
 */
import { CheckCircle2 } from "lucide-react";

interface Props {
  step: 1 | 2;
  title: string;
  subtitle?: string;
}

export function CompletionProgress({ step, title, subtitle }: Props) {
  const pct = step === 1 ? 50 : 100;
  return (
    <div className="p-5 pb-4 relative bg-muted/30 border-b border-border">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/15 border border-primary/35">
          <CheckCircle2 className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className="text-xl text-foreground leading-tight"
            style={{ fontFamily: "var(--font-focus-display, inherit)" }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          ) : null}
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold shrink-0">
          {step}/2
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))",
          }}
        />
      </div>
    </div>
  );
}
