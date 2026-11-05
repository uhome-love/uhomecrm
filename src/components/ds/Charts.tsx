import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Tone, toneDot, paleta, fmtNum } from "./tones";

export interface BarItem {
  label: string;
  value: number;
  display?: string;
  note?: string;
  tone?: Tone;
}

/** Lista com barras coloridas (cores variadas mantidas), total e "Ver todos (N)". */
export function BarList({
  items,
  limit = 6,
  showTotal = true,
  totalLabel = "Soma",
  emptyText = "Nada no período.",
}: {
  items: BarItem[];
  limit?: number;
  showTotal?: boolean;
  totalLabel?: string;
  emptyText?: string;
}) {
  const [todos, setTodos] = useState(false);
  if (!items.length) return <p className="py-4 text-sm text-muted-foreground">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((s, i) => s + i.value, 0);
  const vis = todos ? items : items.slice(0, limit);
  return (
    <div className="space-y-3">
      {vis.map((it, i) => (
        <div key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-foreground">{it.label}</span>
            <span className="font-semibold tabular-nums text-foreground">{it.display ?? fmtNum(it.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className={cn("h-2 rounded-full", it.tone ? toneDot[it.tone] : paleta[i % paleta.length])}
              style={{ width: `${(it.value / max) * 100}%` }}
            />
          </div>
          {it.note && <p className="mt-0.5 text-xs text-muted-foreground">{it.note}</p>}
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
        {items.length > limit ? (
          <button className="font-medium text-primary hover:underline" onClick={() => setTodos((v) => !v)}>
            {todos ? "Ver menos" : `Ver todos (${items.length})`}
          </button>
        ) : (
          <span />
        )}
        {showTotal && (
          <span>
            {totalLabel}: <strong className="tabular-nums text-foreground">{fmtNum(total)}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

/** Funil horizontal por etapa (cores variadas); etapas zeradas podem recolher. */
export function FunnelBars({ items, hideZeros = true }: { items: BarItem[]; hideZeros?: boolean }) {
  const [abrir, setAbrir] = useState(false);
  const zeros = items.filter((i) => i.value === 0);
  const vis = hideZeros && !abrir ? items.filter((i) => i.value > 0) : items;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {vis.map((it, i) => (
        <div key={it.label} className="grid grid-cols-[120px_1fr_48px] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground">{it.label}</span>
          <div className="h-6 rounded-md bg-muted">
            <div
              className={cn("h-6 rounded-md", it.tone ? toneDot[it.tone] : paleta[i % paleta.length])}
              style={{ width: `${Math.max((it.value / max) * 100, it.value ? 3 : 0)}%` }}
            />
          </div>
          <span className="text-right font-semibold tabular-nums text-foreground">{fmtNum(it.value)}</span>
        </div>
      ))}
      {hideZeros && zeros.length > 0 && (
        <button className="text-xs font-medium text-primary hover:underline" onClick={() => setAbrir((v) => !v)}>
          {abrir ? "Recolher etapas zeradas" : `${zeros.length} etapas zeradas`}
        </button>
      )}
    </div>
  );
}

export interface Stage {
  label: string;
  count: number;
  value?: string;
  tone?: Tone;
  disabled?: boolean;
}

/** Funil de negócios em blocos (Documentação → Proposta → Contrato → Ganho). */
export function StageFunnel({ steps, note, onSelect }: { steps: Stage[]; note?: string; onSelect?: (s: Stage) => void }) {
  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}>
        {steps.map((s, i) => {
          const clic = !!onSelect && !s.disabled;
          return (
            <button
              key={s.label}
              disabled={!clic}
              onClick={() => onSelect?.(s)}
              className={cn(
                "rounded-lg border border-border bg-card p-3 text-left",
                clic ? "hover:shadow-md" : "cursor-default",
              )}
            >
              <span className={cn("mb-2 block h-1.5 rounded-full", s.tone ? toneDot[s.tone] : paleta[i % paleta.length])} />
              <span className="block text-xs text-muted-foreground">{s.label}</span>
              <span className="block font-display text-xl font-bold tabular-nums text-foreground">{fmtNum(s.count)}</span>
              {s.value && <span className="block text-xs tabular-nums text-muted-foreground">{s.value}</span>}
            </button>
          );
        })}
      </div>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Medidor com meta (ex.: CRM 80%). */
export function Meter({ value, goal, tone }: { value: number; goal?: number; tone?: Tone }) {
  const t: Tone = tone ?? (goal === undefined ? "primary" : value >= goal ? "success" : "danger");
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-24 rounded-full bg-muted">
        <div className={cn("h-2 rounded-full", toneDot[t])} style={{ width: `${Math.min(value, 100)}%` }} />
        {goal !== undefined && <span className="absolute -top-0.5 h-3 w-px bg-foreground/60" style={{ left: `${goal}%` }} />}
      </div>
      <span className="text-xs font-semibold tabular-nums text-foreground">{value.toLocaleString("pt-BR")}%</span>
    </div>
  );
}

/** Bolinhas de saúde: em dia / atenção / atrasados. */
export function HealthDots({
  values,
  labels = ["em dia", "atenção", "atrasados"],
  showLabels,
}: {
  values: number[];
  labels?: string[];
  showLabels?: boolean;
}) {
  const tons: Tone[] = ["success", "warning", "danger"];
  return (
    <span className="inline-flex items-center gap-3 text-xs">
      {values.map((v, i) => (
        <span key={i} className="inline-flex items-center gap-1 tabular-nums text-foreground" title={labels[i]}>
          <span className={cn("h-2 w-2 rounded-full", toneDot[tons[i] ?? "neutral"])} />
          {v}
          {showLabels && <span className="text-muted-foreground">{labels[i]}</span>}
        </span>
      ))}
    </span>
  );
}
