/** Evolução da semana por corretor: situação, visitas (realizadas/marcadas) e o que falta para participar. */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { META_VISITAS, type LinhaEvolucao } from "@/lib/performanceRoletaPresentation";
import { Card } from "./Blocos";

const TOM = { fora: "bg-destructive/10 text-destructive", perto: "bg-warning/15 text-warning", apto: "bg-success-500/15 text-success-500" } as const;

function Quadrados({ r, m }: { r: number; m: number }) {
  const total = Math.max(META_VISITAS, Math.ceil(r) + m);
  return (
    <span className="inline-flex shrink-0 gap-1">
      {Array.from({ length: Math.min(total, 6) }, (_, i) => {
        const cheio = i < Math.floor(r), meio = !cheio && i < r, marcada = !cheio && !meio && i < Math.ceil(r) + m;
        return <i key={i} className={cn("h-4 w-4 rounded", cheio ? "bg-success-500" : meio ? "bg-gradient-to-r from-success-500 from-50% to-muted to-50%" : marcada ? "border-2 border-dashed border-warning" : "bg-muted")} />;
      })}
    </span>
  );
}

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(".", ","));
const textoVisitas = (l: LinhaEvolucao) => `${fmt(l.realizadas)}${l.marcadas ? ` + ${l.marcadas} marcada${l.marcadas > 1 ? "s" : ""}` : ""}`;

export default function EvolucaoCorretores({ linhas }: { linhas: LinhaEvolucao[] }) {
  const [todos, setTodos] = useState(false);
  const foraN = linhas.filter((l) => l.fora).length;
  const vis = todos ? linhas : linhas.slice(0, Math.max(10, foraN));
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">Evolução da semana — cada corretor</h3>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-success-500" />realizada</span>
          <span className="flex items-center gap-1"><i className="h-3 w-3 rounded border-2 border-dashed border-warning" />marcada</span>
          <span>meta {META_VISITAS}</span>
        </span>
      </div>
      <div className="hidden grid-cols-[1.4fr_1fr_1.3fr_0.5fr_1.6fr] gap-3 border-b border-border pb-2 text-xs text-muted-foreground md:grid">
        <span>Corretor</span><span>Situação</span><span>Visitas da semana</span><span>CRM</span><span>O que falta para participar</span>
      </div>
      <div className="divide-y divide-border text-sm">
        {vis.map((l) => (
          <div key={l.c.user_id} className={cn("grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-2 py-2.5 md:grid-cols-[1.4fr_1fr_1.3fr_0.5fr_1.6fr]", l.fora && "bg-destructive/5")}>
            <div className="min-w-0"><p className={cn("truncate", l.fora && "font-semibold")}>{l.c.nome}</p><p className="truncate text-xs text-muted-foreground">{l.c.equipe}</p></div>
            <span className="justify-self-end md:justify-self-start"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM[l.tom])}>{l.situacao}</span></span>
            <div className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1"><Quadrados r={l.realizadas} m={l.marcadas} /><span className="truncate text-xs text-muted-foreground">{textoVisitas(l)}</span>
              <span className={cn("ml-auto text-xs md:hidden", l.precisaCrm && "font-semibold text-destructive")}>CRM {l.c.crm?.pct ?? "—"}%</span></div>
            <span className={cn("hidden text-sm md:block", l.precisaCrm && "font-semibold text-destructive")}>{l.c.crm?.pct ?? "—"}%</span>
            <p className="col-span-2 min-w-0 break-words text-xs md:col-span-1 md:text-sm">
              {l.falta ? <><b className={cn(!l.fora && "font-medium text-muted-foreground")}>{l.falta}</b>{l.faltaDetalhe && <span className="text-muted-foreground"> · {l.faltaDetalhe}</span>}</> : <span className="text-muted-foreground">—</span>}
            </p>
          </div>
        ))}
      </div>
      {linhas.length > vis.length || todos ? <button onClick={() => setTodos(!todos)} className="mt-2 text-xs font-medium text-primary">{todos ? "Mostrar menos" : `Ver todos (${linhas.length}) →`}</button> : null}
    </Card>
  );
}
