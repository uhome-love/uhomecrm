import { cn } from "@/lib/utils";
import { type Tone, toneDot } from "./tones";

interface Opt {
  id: string;
  label: string;
  count?: number;
  tone?: Tone;
}

/** Troca de visão dentro da tela. */
export function Segmented({ options, value, onChange }: { options: Opt[]; value: string; onChange?: (id: string) => void }) {
  return (
    <div role="tablist" className="inline-flex items-center gap-1 rounded-[9px] border border-border bg-muted p-1">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange?.(o.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
              on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Filtros de status: ativo em azul claro com texto azul. */
export function FilterChips({ options, value, onChange }: { options: Opt[]; value: string; onChange?: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            aria-pressed={on}
            onClick={() => onChange?.(o.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
              on
                ? "border-primary/30 bg-primary-50 font-semibold text-primary dark:bg-primary/20 dark:text-primary-100"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {o.tone && <span className={cn("h-1.5 w-1.5 rounded-full", toneDot[o.tone])} />}
            {o.label}
            {o.count !== undefined && <span className="tabular-nums opacity-80">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function StatusPill({ tone = "neutral", dot = true, children }: { tone?: Tone; dot?: boolean; children: React.ReactNode }) {
  const soft: Record<Tone, string> = {
    neutral: "bg-muted text-muted-foreground",
    primary: "bg-primary-50 text-primary dark:bg-primary/20 dark:text-primary-100",
    info: "bg-primary-50 text-primary dark:bg-primary/20 dark:text-primary-100",
    success: "bg-success-50 text-success-700 dark:bg-success/15 dark:text-success-500",
    warning: "bg-warning-50 text-warning-700 dark:bg-warning/15 dark:text-warning-500",
    danger: "bg-danger-50 text-danger-700 dark:bg-danger/15 dark:text-danger-500",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", soft[tone])}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", toneDot[tone])} />}
      {children}
    </span>
  );
}
