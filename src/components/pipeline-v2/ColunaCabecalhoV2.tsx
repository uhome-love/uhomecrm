// ─────────────────────────────────────────────────────────────────
// ColunaCabecalhoV2 — topo da coluna do Pipeline em UMA linha:
// emoji · nome · contagem · (valor, só em Negócios) · menu de ordenar/filtrar.
// Sai: barra de progresso, R$ das colunas de leads e o "⏱ 48d".
// A cor da etapa (pipeline_stages.cor) vira um filete fino no alto da coluna.
// ─────────────────────────────────────────────────────────────────
import type { CSSProperties, ReactNode } from "react";
import type { PipelineStage } from "@/hooks/usePipeline";
import { EMOJI_POR_TIPO } from "@/lib/pipelineV2/textos";

export interface ColunaCabecalhoV2Props {
  stage: PipelineStage;
  /** Número ou "12 de 40" quando há filtro. */
  qtd: ReactNode;
  /** Só na aba Negócios (VGV da coluna). Nas colunas de leads, não passar. */
  valor?: string;
  /** Coluna recebendo um card arrastado. */
  destacar?: boolean;
  /** Menu de ordenar/filtrar da etapa (StageSortFilterMenu) e ações extras. */
  children?: ReactNode;
}

export function ColunaCabecalhoV2({ stage, qtd, valor, destacar, children }: ColunaCabecalhoV2Props) {
  const emoji = EMOJI_POR_TIPO[stage.tipo] ?? "📍";
  const nome = stage.tipo === "convertido" ? "Negócio" : stage.nome;
  return (
    <div className="flex shrink-0 items-center gap-2 px-1 pb-1 pt-0.5">
      <span aria-hidden className="text-[15px] leading-5">
        {emoji}
      </span>
      <span className={`truncate text-sm font-bold leading-5 ${destacar ? "text-emerald-600" : "text-foreground"}`}>{nome}</span>
      <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-card px-2 text-xs font-bold tabular-nums text-muted-foreground">{qtd}</span>
      <span className="flex-1" />
      {valor && <span className="shrink-0 text-[13px] font-bold tabular-nums text-foreground">{valor}</span>}
      {children}
    </div>
  );
}

/**
 * Estilo do contêiner da coluna: fundo suave, cantos de 16px e o filete
 * com a cor da etapa. Aplicar no <div> da coluna no PipelineBoardV2.
 */
export function colunaEstiloV2(stage: PipelineStage, destacar = false): { className: string; style: CSSProperties } {
  const cor = stage.cor || "hsl(var(--primary))";
  return {
    className: "flex h-full shrink-0 flex-col gap-2 rounded-2xl bg-muted/60 p-2.5 dark:bg-muted/30",
    style: {
      boxShadow: destacar ? `inset 0 3px 0 ${cor}, 0 0 0 2px rgba(34,197,94,0.45)` : `inset 0 3px 0 ${cor}`,
      background: destacar ? "rgba(34,197,94,0.06)" : undefined,
    },
  };
}

export default ColunaCabecalhoV2;
