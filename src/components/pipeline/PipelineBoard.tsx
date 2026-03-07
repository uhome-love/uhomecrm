import { useState, useRef } from "react";
import type { PipelineStage, PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import PipelineCard from "./PipelineCard";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface PipelineBoardProps {
  stages: PipelineStage[];
  leads: PipelineLead[];
  segmentos: PipelineSegmento[];
  onMoveLead: (leadId: string, newStageId: string) => void;
  onSelectLead: (lead: PipelineLead) => void;
}

export default function PipelineBoard({ stages, leads, segmentos, onMoveLead, onSelectLead }: PipelineBoardProps) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const dragLeadId = useRef<string | null>(null);

  const handleDragStart = (leadId: string) => {
    dragLeadId.current = leadId;
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (dragLeadId.current) {
      onMoveLead(dragLeadId.current, stageId);
      dragLeadId.current = null;
    }
  };

  const getLeadsForStage = (stageId: string) =>
    leads.filter(l => l.stage_id === stageId);

  const formatVGV = (value: number) => {
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}mil`;
    return `R$ ${value.toLocaleString("pt-BR")}`;
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-4 min-w-max">
        {stages.map((stage) => {
          const stageLeads = getLeadsForStage(stage.id);
          const isDragOver = dragOverStage === stage.id;
          const totalVGV = stageLeads.reduce((sum, l) => sum + (l.valor_estimado || 0), 0);

          return (
            <div
              key={stage.id}
              className={`flex flex-col w-[290px] shrink-0 rounded-xl border transition-all duration-200 overflow-hidden ${
                isDragOver
                  ? "border-primary/50 bg-primary/5 shadow-lg"
                  : "border-border bg-muted/30"
              }`}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Colored top border */}
              <div className="h-1 w-full" style={{ backgroundColor: stage.cor }} />

              {/* Column Header */}
              <div className="px-3 py-2.5 border-b border-border/50">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold text-foreground truncate">
                    {stage.nome}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold mr-1">
                      {stageLeads.length}
                    </Badge>
                    Negociações
                  </span>
                  {totalVGV > 0 && (
                    <span className="font-semibold text-foreground">
                      {formatVGV(totalVGV)}
                    </span>
                  )}
                </div>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-1.5 p-2 min-h-[120px] max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin">
                {stageLeads.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/50">
                    Arraste leads aqui
                  </div>
                )}
                {stageLeads.map((lead) => (
                  <PipelineCard
                    key={lead.id}
                    lead={lead}
                    segmentos={segmentos}
                    onDragStart={() => handleDragStart(lead.id)}
                    onClick={() => onSelectLead(lead)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
