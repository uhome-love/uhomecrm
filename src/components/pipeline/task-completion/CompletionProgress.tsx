/**
 * Sprint 1 R3-V2 — Header com barra de progresso 50% / 100% + título Fraunces
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
    <div
      className="p-5 pb-4 relative"
      style={{
        background: "linear-gradient(135deg, rgba(79,70,229,0.18), rgba(124,58,237,0.10))",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "rgba(73,105,255,0.15)",
            border: "1px solid rgba(73,105,255,0.35)",
          }}
        >
          <CheckCircle2 className="w-5 h-5 text-indigo-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className="text-xl text-white leading-tight"
            style={{ fontFamily: "var(--font-focus-display, inherit)" }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
          ) : null}
        </div>
        <span className="text-[10px] uppercase tracking-widest text-indigo-300 font-semibold shrink-0">
          {step}/2
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
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
