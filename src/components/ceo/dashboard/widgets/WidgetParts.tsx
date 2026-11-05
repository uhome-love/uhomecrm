import { useState } from "react";
import { cn } from "@/lib/utils";
import { paleta, fmtNum, type Tone, toneText } from "@/components/ds";

export interface StripItem {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: Tone;
  accent?: boolean;
  onClick?: () => void;
}

/** Faixa de números em linha (sem cartão dentro de cartão), divisórias finas. */
export function MetricStrip({ items }: { items: StripItem[] }) {
  return (
    <div className="grid rounded-lg bg-muted/40 divide-x divide-border" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
      {items.map((it) => {
        const Comp = it.onClick ? "button" : "div";
        return (
          <Comp key={it.label} type={it.onClick ? "button" : undefined} onClick={it.onClick}
            className={cn("px-5 py-3.5 text-left min-w-0", it.onClick && "hover:bg-muted transition-colors first:rounded-l-lg last:rounded-r-lg")}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{it.label}</p>
            <p className={cn("mt-1 font-display text-2xl font-bold tabular-nums leading-7",
              it.accent ? "text-primary" : it.tone ? toneText[it.tone] : "text-foreground")}>{it.value}</p>
            {it.sub && <p className="mt-0.5 text-xs text-muted-foreground truncate">{it.sub}</p>}
          </Comp>
        );
      })}
    </div>
  );
}

/** Barras compactas em colunas, para usar bem a largura. */
export function CompactBars({ title, items, cols = 1, limit = 6, action }: {
  title: string; items: { label: string; value: number }[]; cols?: 1 | 2; limit?: number; action?: React.ReactNode;
}) {
  const [todos, setTodos] = useState(false);
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((s, i) => s + i.value, 0);
  const vis = todos ? items : items.slice(0, limit);
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        {action}
      </div>
      {items.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Nada no período.</p> : (
        <div className={cn("grid gap-x-8 gap-y-2.5", cols === 2 && "sm:grid-cols-2")}>
          {vis.map((it, i) => (
            <div key={it.label} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 truncate text-foreground" title={it.label}>{it.label}</span>
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div className={cn("h-2 rounded-full", paleta[i % paleta.length])} style={{ width: `${(it.value / max) * 100}%` }} />
              </div>
              <span className="w-8 text-right font-semibold tabular-nums text-foreground">{fmtNum(it.value)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
        {items.length > limit ? (
          <button className="font-medium text-primary hover:underline" onClick={() => setTodos((v) => !v)}>
            {todos ? "Ver menos" : `Ver todos (${items.length})`}
          </button>
        ) : <span />}
        <span>Soma: <strong className="tabular-nums text-foreground">{fmtNum(total)}</strong></span>
      </div>
    </div>
  );
}
