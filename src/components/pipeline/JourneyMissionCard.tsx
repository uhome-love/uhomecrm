import { memo, useMemo } from "react";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { differenceInDays } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PhaseTheme {
  name: string;
  icon: string;
  color: string;
  missionBadge: string;
}

interface Props {
  lead: PipelineLead;
  theme: PhaseTheme;
  stages: PipelineStage[];
  stageIndexMap: Map<string, number>;
  corretorNome?: string;
  arrived: boolean;
  onDragStart: () => void;
  onClick: () => void;
}

function deduplicateEmpreendimento(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(/[·,;|]/).map(s => s.trim()).filter(Boolean);
  const normalize = (s: string) => s.replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();
  const seen = new Map<string, string>();
  for (const part of parts) {
    const key = normalize(part);
    if (!seen.has(key)) seen.set(key, part.replace(/\s*\(.*?\)\s*/g, "").trim());
  }
  return [...seen.values()].join(" · ");
}

const JourneyMissionCard = memo(function JourneyMissionCard({
  lead, theme, stages, stageIndexMap, corretorNome, arrived, onDragStart, onClick,
}: Props) {
  const daysInStage = differenceInDays(new Date(), new Date(lead.stage_changed_at));
  const currentIdx = stageIndexMap.get(lead.stage_id) ?? 0;
  const totalStages = stages.length;
  const displayEmpreendimento = deduplicateEmpreendimento(lead.empreendimento || "");

  const daysLabel = useMemo(() => {
    if (daysInStage <= 2) return { text: `✅ ${daysInStage}d`, color: "#34D399" };
    if (daysInStage <= 5) return { text: `⚠️ ${daysInStage}d`, color: "#FBBF24" };
    return { text: `🔥 ${daysInStage}d — atenção!`, color: "#F87171" };
  }, [daysInStage]);

  const formatVGV = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}mil`;
    return `R$ ${v.toLocaleString("pt-BR")}`;
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
        onClick={onClick}
        className="group rounded-xl cursor-pointer active:cursor-grabbing transition-all duration-150 select-none hover:scale-[1.02]"
        style={{
          background: "#1C2128",
          border: "1px solid rgba(255,255,255,0.08)",
          padding: "12px",
          animation: arrived ? "cardArrived 0.4s cubic-bezier(0.34,1.56,0.64,1)" : undefined,
        }}
      >
        {/* Line 1: Mission badge + days */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${theme.color}20`, color: theme.color }}>
            {theme.missionBadge}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] font-bold" style={{ color: daysLabel.color }}>
                {daysLabel.text}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Lead parado há {daysInStage} dias nesta fase
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Line 2: Name */}
        <p className="text-sm font-semibold text-white truncate mb-0.5">{lead.nome}</p>

        {/* Line 3: Empreendimento */}
        {displayEmpreendimento && (
          <p className="text-[11px] text-gray-400 truncate mb-2">{displayEmpreendimento}</p>
        )}

        {/* Line 4: Journey progress dots */}
        <div className="flex items-center gap-0.5 mb-2">
          {stages.map((s, i) => {
            const sTheme = i < currentIdx ? stages[i] : null;
            const isCurrent = i === currentIdx;
            const isPast = i < currentIdx;
            const dotColor = isCurrent ? theme.color : isPast ? (stages[i] ? theme.color : "#374151") : "#374151";
            return (
              <div key={s.id} className="flex items-center">
                <div
                  className="rounded-full"
                  style={{
                    width: isCurrent ? 8 : 6,
                    height: isCurrent ? 8 : 6,
                    backgroundColor: isPast || isCurrent ? theme.color : "#374151",
                    opacity: isPast ? 0.5 : 1,
                    animation: isCurrent ? "pulseDot 2s ease-in-out infinite" : undefined,
                  }}
                />
                {i < totalStages - 1 && (
                  <div
                    className="h-[2px]"
                    style={{
                      width: "8px",
                      backgroundColor: isPast ? `${theme.color}60` : "#374151",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Line 5: VGV + corretor */}
        <div className="flex items-center justify-between text-[10px]">
          {lead.valor_estimado ? (
            <span className="text-gray-400">{formatVGV(lead.valor_estimado)}</span>
          ) : (
            <span />
          )}
          {corretorNome && (
            <span className="text-gray-500 truncate max-w-[100px]">👤 {corretorNome}</span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
});

export default JourneyMissionCard;
