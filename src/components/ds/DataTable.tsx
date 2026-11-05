import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Tone, toneText } from "./tones";
import { StatusPill } from "./Segmented";
import { Meter, HealthDots } from "./Charts";

export type Cell =
  | string
  | number
  | { text: string | number; tone?: Tone; sub?: string; strong?: boolean }
  | { pill: { tone: Tone; label: string } }
  | { meter: number; goal?: number; tone?: Tone }
  | { dots: number[] };

export interface Column {
  key: string;
  label: string;
  num?: boolean;
}

function render(c: Cell | undefined) {
  if (c === undefined || c === null) return <span className="text-muted-foreground">—</span>;
  if (typeof c === "number") return c.toLocaleString("pt-BR");
  if (typeof c === "string") return c;
  if ("pill" in c) return <StatusPill tone={c.pill.tone}>{c.pill.label}</StatusPill>;
  if ("meter" in c) return <Meter value={c.meter} goal={c.goal} tone={c.tone} />;
  if ("dots" in c) return <HealthDots values={c.dots} />;
  return (
    <span className={cn(c.strong && "font-semibold", c.tone && toneText[c.tone])}>
      {typeof c.text === "number" ? c.text.toLocaleString("pt-BR") : c.text}
      {c.sub && <span className="block text-xs font-normal text-muted-foreground">{c.sub}</span>}
    </span>
  );
}

/** Tabela padrão: cabeçalhos por extenso, números alinhados, linha de total opcional. */
export function DataTable({
  columns,
  rows,
  total,
  rank,
  limit,
  caption,
  legend,
}: {
  columns: Column[];
  rows: Record<string, Cell>[];
  total?: Record<string, Cell>;
  rank?: boolean;
  limit?: number;
  caption?: string;
  legend?: string;
}) {
  const [todos, setTodos] = useState(false);
  const vis = limit && !todos ? rows.slice(0, limit) : rows;
  const th = "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {caption && <caption className="mb-2 text-left text-xs text-muted-foreground">{caption}</caption>}
        <thead>
          <tr className="border-b border-border">
            {rank && <th className={cn(th, "w-8 text-left")}>#</th>}
            {columns.map((c) => (
              <th key={c.key} className={cn(th, c.num ? "text-right" : "text-left")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vis.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/50">
              {rank && <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{i + 1}</td>}
              {columns.map((c) => (
                <td key={c.key} className={cn("px-3 py-2.5 text-foreground", c.num && "text-right tabular-nums")}>
                  {render(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              {rank && <td />}
              {columns.map((c) => (
                <td key={c.key} className={cn("px-3 py-2.5 text-foreground", c.num && "text-right tabular-nums")}>
                  {render(total[c.key])}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        {limit && rows.length > limit ? (
          <button className="font-medium text-primary hover:underline" onClick={() => setTodos((v) => !v)}>
            {todos ? "Ver menos" : `Ver todos os ${rows.length}`}
          </button>
        ) : (
          <span />
        )}
        {legend && <span>{legend}</span>}
      </div>
    </div>
  );
}
