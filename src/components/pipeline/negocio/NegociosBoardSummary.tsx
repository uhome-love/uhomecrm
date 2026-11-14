import { BarChart3, Briefcase, Clock3, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NegociosAtalho, NegociosResumoVisual } from "@/lib/negociosBoardPresentation";
import { money } from "./boardPresentation";

export function NegociosBoardSummary({ resumo, atalho, onChange }: { resumo: NegociosResumoVisual; atalho: NegociosAtalho; onChange: (atalho: NegociosAtalho) => void }) {
  const toggle = (value: NegociosAtalho) => onChange(atalho === value ? "todos" : value);
  return <div className="shrink-0 border-b border-border py-2 sm:py-3" aria-label="Resumo de Negócios">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:gap-x-8">
      <div className="flex items-center gap-2.5"><BarChart3 className="negocios-action size-5" aria-hidden /><div><p className="text-[11px] text-muted-foreground">VGV em andamento</p><p className="text-base font-bold tabular-nums">{money(resumo.vgv)}</p></div></div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Briefcase className="hidden size-4 sm:block" aria-hidden /><strong className="text-foreground">{resumo.quantidade}</strong> negócios</div>
      <div className="flex items-center gap-1 sm:gap-3">
        <Button variant="ghost" size="sm" aria-pressed={atalho === "parados"} onClick={() => toggle("parados")} className={cn("h-9 gap-1.5 px-1.5 text-xs text-muted-foreground", atalho === "parados" && "bg-primary/10 text-primary")} title="Mais de 7 dias sem atividade, sem ação futura e fora de Em dia">
          <Clock3 className="size-4 text-warning-700 dark:text-warning-500" />Parados +7d <strong className="tabular-nums text-foreground">{resumo.parados}</strong>
        </Button>
        <Button variant="ghost" size="sm" aria-pressed={atalho === "sem_vgv"} onClick={() => toggle("sem_vgv")} className={cn("h-9 gap-1.5 px-1.5 text-xs text-muted-foreground", atalho === "sem_vgv" && "bg-primary/10 text-primary")}>
          <TriangleAlert className="size-4 text-warning-700 dark:text-warning-500" />Sem VGV <strong className="tabular-nums text-foreground">{resumo.semVgv}</strong>
        </Button>
      </div>
    </div>
    {atalho !== "todos" && <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span>{atalho === "parados" ? "Parados há mais de 7 dias" : "Sem VGV informado"}</span><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remover filtro de Negócios" onClick={() => onChange("todos")}><X /></Button></div>}
  </div>;
}