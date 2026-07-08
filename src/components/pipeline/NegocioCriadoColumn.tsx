// ─────────────────────────────────────────────────────────────────
// NegocioCriadoColumn — Renderiza a coluna "Negócio Criado" com
// agrupamento interno por negocios.fase (D6 do prompt Pipeline v2).
//
//   🔄 EM ANDAMENTO  — negócios com próxima ação (proposta, negociação,
//                       documentação, novo_negocio, caiu); inclui leads
//                       sem negocio vinculado (fallback)
//   ✅ VENDIDOS      — negocios.fase = 'vendido'
//
// VGV consolidado no topo (soma vgv_final ?? vgv_estimado).
// Mantém virtualização leve (LOAD_MORE_BATCH=15) por grupo.
// ─────────────────────────────────────────────────────────────────

import { useState, useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import NegocioCard, { type NegocioCardData } from "./NegocioCard";
import PipelineCardHover from "./PipelineCardHover";
import { formatBRLCompact } from "@/lib/utils";

interface NegocioCriadoColumnProps {
  stageLeads: PipelineLead[];
  stage: PipelineStage;
  corretorNomes: Record<string, string>;
  parcerias: Record<string, string>;
  onSelectLead: (lead: PipelineLead) => void;
  handleDragStart: (leadId: string) => void;
  selectionMode?: boolean;
  selectedLeads?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const INITIAL_RENDER = 15;
const LOAD_MORE_BATCH = 15;

const NegocioCriadoColumn = memo(function NegocioCriadoColumn({
  stageLeads,
  stage,
  corretorNomes,
  parcerias,
  onSelectLead,
  handleDragStart,
  selectionMode,
  selectedLeads,
  onToggleSelect,
}: NegocioCriadoColumnProps) {
  const leadIds = useMemo(() => stageLeads.map((l) => l.id), [stageLeads]);
  const leadIdsKey = useMemo(() => leadIds.slice().sort().join(","), [leadIds]);

  // Busca negocios vinculados a esses leads (mais recente por lead)
  const { data: negociosByLead = {} } = useQuery({
    queryKey: ["pipeline-convertido-negocios", leadIdsKey],
    queryFn: async () => {
      const map: Record<string, NegocioCardData> = {};
      if (leadIds.length === 0) return map;
      for (let i = 0; i < leadIds.length; i += 200) {
        const chunk = leadIds.slice(i, i + 200);
        const { data } = await supabase
          .from("negocios")
          .select("id, pipeline_lead_id, fase, vgv_estimado, vgv_final, fase_changed_at")
          .in("pipeline_lead_id", chunk)
          .order("fase_changed_at", { ascending: false });
        if (data) {
          for (const row of data as any[]) {
            const lid = row.pipeline_lead_id;
            if (!lid || map[lid]) continue; // mais recente já registrado
            map[lid] = {
              id: row.id,
              fase: row.fase,
              vgv_estimado: row.vgv_estimado ?? null,
              vgv_final: row.vgv_final ?? null,
            };
          }
        }
      }
      return map;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Agrupa leads
  const { vendidos, andamento, totalVGV } = useMemo(() => {
    const vendidos: PipelineLead[] = [];
    const andamento: PipelineLead[] = [];
    let totalVGV = 0;
    for (const lead of stageLeads) {
      const neg = negociosByLead[lead.id];
      if (neg) {
        totalVGV += neg.vgv_final ?? neg.vgv_estimado ?? 0;
        if (neg.fase === "vendido") vendidos.push(lead);
        else andamento.push(lead);
      } else {
        // fallback: sem negocio vinculado → em andamento
        andamento.push(lead);
      }
    }
    return { vendidos, andamento, totalVGV };
  }, [stageLeads, negociosByLead]);

  const [visibleAndamento, setVisibleAndamento] = useState(INITIAL_RENDER);
  const [visibleVendidos, setVisibleVendidos] = useState(INITIAL_RENDER);

  const renderCard = (lead: PipelineLead) => {
    const isSelected = selectionMode && selectedLeads?.has(lead.id);
    return (
      <div
        key={lead.id}
        className={`relative ${selectionMode ? "cursor-pointer" : ""} ${
          isSelected ? "ring-2 ring-primary rounded-lg" : ""
        }`}
      >
        <PipelineCardHover lead={lead} onOpenLead={() => !selectionMode && onSelectLead(lead)}>
          <NegocioCard
            lead={lead}
            negocio={negociosByLead[lead.id] ?? null}
            corretorNome={lead.corretor_id ? corretorNomes[lead.corretor_id] : undefined}
            parceiroNome={parcerias[lead.id]}
            onClick={() => (selectionMode ? onToggleSelect?.(lead.id) : onSelectLead(lead))}
            onDragStart={() => !selectionMode && handleDragStart(lead.id)}
          />
        </PipelineCardHover>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-1.5 scrollbar-thin">
      {/* Header consolidado */}
      {totalVGV > 0 && (
        <div className="mb-2 px-1 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-between">
          <span>VGV total</span>
          <span className="font-mono font-semibold text-foreground/80">
            {formatBRLCompact(totalVGV)}
          </span>
        </div>
      )}

      {stageLeads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-[12px] font-bold text-muted-foreground">Nenhum negócio aqui</span>
        </div>
      )}

      {/* EM ANDAMENTO */}
      {andamento.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-1 py-1.5 mt-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              🔄 Em andamento
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">
              {andamento.length}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-1.5">
            {andamento.slice(0, visibleAndamento).map(renderCard)}
            {visibleAndamento < andamento.length && (
              <button
                onClick={() =>
                  setVisibleAndamento((p) => Math.min(p + LOAD_MORE_BATCH, andamento.length))
                }
                className="w-full py-2 text-[10px] text-muted-foreground hover:text-foreground"
              >
                Mostrar mais ({andamento.length - visibleAndamento})
              </button>
            )}
          </div>
        </>
      )}

      {/* VENDIDOS */}
      {vendidos.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-1 py-1.5 mt-3">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              🏆 Ganhos / Assinados
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">
              {vendidos.length}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-1.5">
            {vendidos.slice(0, visibleVendidos).map(renderCard)}
            {visibleVendidos < vendidos.length && (
              <button
                onClick={() =>
                  setVisibleVendidos((p) => Math.min(p + LOAD_MORE_BATCH, vendidos.length))
                }
                className="w-full py-2 text-[10px] text-muted-foreground hover:text-foreground"
              >
                Mostrar mais ({vendidos.length - visibleVendidos})
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
});

export default NegocioCriadoColumn;
