import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/hooks/usePipeline";
import { ColunaCabecalhoV2, colunaEstiloV2 } from "@/components/pipeline-v2/ColunaCabecalhoV2";
import { EMOJI_POR_TIPO } from "@/lib/pipelineV2/textos";
import { NEGOCIOS_COLUNAS, money, type NegociosColKey } from "./boardPresentation";

export function NegociosEmpty({ coluna }: { coluna: NegociosColKey }) {
  return <div className="flex min-h-36 flex-col items-center justify-center gap-3 px-3 py-6 text-center text-muted-foreground">
    <FileText className="size-7 text-primary/60" aria-hidden />
    <p className="text-xs font-medium">{NEGOCIOS_COLUNAS.find(c => c.key === coluna)?.vazio}</p>
  </div>;
}

export function NegociosColumn({ stage, count, valor, highlight, children }: { stage: PipelineStage; count: number; valor?: number; highlight?: boolean; children: ReactNode }) {
  return <div className={cn("shrink-0 rounded-t-xl px-2.5 pb-2 pt-3", highlight && "bg-primary/5")} style={colunaEstiloV2(stage).style}>
    <ColunaCabecalhoV2 stage={stage} qtd={count} valor={valor === undefined ? undefined : money(valor) ?? undefined} />
    {children}
  </div>;
}

export function NegociosMobileTabs({ stages, active, onChange, info }: { stages: PipelineStage[]; active: NegociosColKey; onChange: (key: NegociosColKey) => void; info: (key: NegociosColKey) => { count: number; vgv: number } }) {
  return <div role="tablist" aria-label="Etapas de Negócios" className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto py-2">
    {NEGOCIOS_COLUNAS.map(col => {
      const stage = stages.find(s => s.tipo === col.tipo);
      return <Button key={col.key} role="tab" aria-selected={active === col.key} variant="ghost" className={cn("h-11 shrink-0 gap-1.5 px-2.5 text-xs", active === col.key && "bg-primary/10 text-primary")}
        onClick={event => { onChange(col.key); event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" }); }}>
        <span aria-hidden>{EMOJI_POR_TIPO[col.tipo] ?? "📍"}</span>{stage?.nome ?? col.nome}
        <span className="text-[10px] tabular-nums text-muted-foreground">{info(col.key).count}</span>
      </Button>;
    })}
  </div>;
}