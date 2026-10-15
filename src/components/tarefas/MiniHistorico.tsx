import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLeadSubstatusBadge } from "@/lib/leadHelpers";
import type { LeadContexto, RegistroMini } from "@/hooks/useLeadContextoTarefas";

const diaBRT = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const dm = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

function ultimaAcao(iso: string | null): { texto: string; velha: boolean } {
  if (!iso) return { texto: "sem ação registrada", velha: true };
  const dias = Math.round((Date.parse(diaBRT(new Date())) - Date.parse(diaBRT(new Date(iso)))) / 86400_000);
  const t = dias <= 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`;
  return { texto: `última ação ${t}`, velha: dias > 7 };
}

function Linha({ r }: { r: RegistroMini }) {
  return (
    <span>
      <span className="font-semibold text-muted-foreground">{dm(r.quando)} · {r.tipo}{r.resultado ? ` · ${r.resultado}` : ""}</span>
      {r.texto ? <span className="text-foreground/80">  {r.texto}</span> : null}
    </span>
  );
}

/** Etiqueta da etapa (ao lado do título). */
export function EtapaChip({ ctx }: { ctx?: LeadContexto }) {
  if (!ctx?.etapa) return null;
  const sub = getLeadSubstatusBadge(ctx.flagStatus, ctx.etapaTipo);
  return (
    <span className="ml-auto inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      {ctx.etapa}{sub ? ` · ${sub.label}` : ""}
    </span>
  );
}

export function UltimaAcaoTexto({ ctx }: { ctx?: LeadContexto }) {
  if (!ctx) return null;
  const ua = ultimaAcao(ctx.ultimaAcaoAt);
  return <span className={cn(ua.velha && "font-semibold text-destructive")}> · {ua.texto}</span>;
}

/** Último registro sempre visível + expansão com os 3 mais recentes. */
export default function MiniHistorico({ ctx }: { ctx?: LeadContexto }) {
  const [aberto, setAberto] = useState(false);
  if (!ctx) return null;
  const [primeiro, ...resto] = ctx.registros;
  if (!primeiro) return <div className="mt-2 text-[12px] italic text-muted-foreground">Nenhum registro ainda neste cliente.</div>;
  return (
    <div className="mt-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[12px]">
      <div className="truncate"><Linha r={primeiro} /></div>
      {aberto && resto.map((r, i) => <div key={i} className="mt-1 truncate border-t border-border/60 pt-1"><Linha r={r} /></div>)}
      {resto.length > 0 && (
        <button type="button" onClick={() => setAberto((v) => !v)} className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline">
          {aberto ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {aberto ? "Ocultar" : `Ver mais ${resto.length} registro${resto.length > 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}
