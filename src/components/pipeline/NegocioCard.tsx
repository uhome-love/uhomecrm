// ─────────────────────────────────────────────────────────────────
// NegocioCard — Card específico de negócio (coluna "Negócio Criado")
//
// Visual roxo distintivo (border-left 4px + bg sutil violeta).
// Badge VENDIDO (verde) quando fase = 'vendido'; AGUARDANDO (âmbar) demais.
// Click → abre drawer do lead (regra "Tudo no Lead").
// ─────────────────────────────────────────────────────────────────

import { memo, useState } from "react";
import type { PipelineLead } from "@/hooks/usePipeline";
import { NEGOCIOS_FASES } from "@/hooks/useNegocios";
import { formatBRLCompact } from "@/lib/utils";
import { Handshake } from "lucide-react";
import { trackPipelineEvent } from "@/lib/pipelineTelemetry";

export interface NegocioCardData {
  id: string;
  fase: string;
  vgv_estimado: number | null;
  vgv_final: number | null;
}

interface NegocioCardProps {
  lead: PipelineLead;
  negocio?: NegocioCardData | null;
  corretorNome?: string;
  parceiroNome?: string;
  onClick: () => void;
  onDragStart: () => void;
}

const NegocioCard = memo(function NegocioCard({
  lead,
  negocio,
  corretorNome,
  parceiroNome,
  onClick,
  onDragStart,
}: NegocioCardProps) {
  const isVendido = negocio?.fase === "vendido";
  const faseInfo = NEGOCIOS_FASES.find((f) => f.key === negocio?.fase);
  const faseLabel = faseInfo?.label ?? "Aguardando";
  const vgv = negocio?.vgv_final ?? negocio?.vgv_estimado ?? 0;
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={() => { setIsDragging(true); onDragStart(); }}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => {
        trackPipelineEvent("pipeline_card_clicked", {
          lead_id: lead.id,
          stage_id: lead.stage_id,
          corretor_id: lead.corretor_id,
          stage: "convertido",
          status: negocio?.fase ?? "aguardando",
        });
        onClick();
      }}
      data-dragging={isDragging || undefined}
      className={[
        "group relative cursor-pointer rounded-xl border px-3 py-2.5 pl-4 shadow-sm transition-all",
        "hover:shadow-md hover:-translate-y-px",
        "bg-violet-50/40 dark:bg-violet-950/20 border-violet-200/70 dark:border-violet-900/40",
        "hover:border-violet-300 dark:hover:border-violet-800",
        // sidebar roxo 4px
        "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r",
        "before:bg-violet-500",
        isDragging ? "opacity-60 scale-[0.98] shadow-lg cursor-grabbing" : "",
      ].join(" ")}
    >
      {/* Linha 1: nome + badge */}
      <div className="flex items-start gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-foreground truncate leading-tight">
            {lead.nome || "Sem nome"}
          </div>
          {lead.empreendimento && (
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              {lead.empreendimento}
            </div>
          )}
        </div>
        <span
          className={[
            "shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
            isVendido
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
          ].join(" ")}
        >
          {isVendido ? "🏆 Ganho" : "Aguardando"}
        </span>
      </div>

      {/* Linha 2: fase + VGV */}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-violet-700 dark:text-violet-300 font-medium truncate">
          {faseLabel}
        </span>
        {vgv > 0 && (
          <span className="font-mono font-semibold text-foreground/80 shrink-0">
            {formatBRLCompact(vgv)}
          </span>
        )}
      </div>

      {/* Linha 3: corretor / parceria */}
      {(corretorNome || parceiroNome) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-0">
          {parceiroNome ? (
            <>
              <Handshake className="h-3 w-3 shrink-0" />
              <span className="truncate">{parceiroNome}</span>
            </>
          ) : (
            <span className="truncate">{corretorNome}</span>
          )}
        </div>
      )}
    </div>
  );
});

export default NegocioCard;
