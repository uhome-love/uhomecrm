import { useMemo, useState } from "react";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { Flame, Zap, Phone, MessageCircle, ChevronDown, ChevronUp, Clock, MapPin, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { differenceInHours, differenceInDays } from "date-fns";
import { calculateLeadScore } from "@/lib/leadScoring";

interface Props {
  leads: PipelineLead[];
  stages: PipelineStage[];
  corretorNomes: Record<string, string>;
  onSelectLead: (lead: PipelineLead) => void;
}

function getWhatsAppUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

export default function PipelinePrioridades({ leads, stages, corretorNomes, onSelectLead }: Props) {
  const [expanded, setExpanded] = useState(true);

  const stageMap = useMemo(() => new Map(stages.map(s => [s.id, s])), [stages]);

  const priorities = useMemo(() => {
    const now = new Date();
    return leads
      .filter(l => {
        const stage = stageMap.get(l.stage_id);
        return stage && !["venda", "descarte"].includes(stage.tipo);
      })
      .map(lead => {
        const stage = stageMap.get(lead.stage_id)!;
        const score = calculateLeadScore(lead as any);
        const hoursInStage = differenceInHours(now, new Date(lead.stage_changed_at));
        const daysInStage = differenceInDays(now, new Date(lead.stage_changed_at));

        // Priority score: combination of lead score, temperature, urgency, and action status
        let priority = score.score;

        // Boost for hot temperature
        if (lead.temperatura === "quente") priority += 30;
        else if (lead.temperatura === "morno") priority += 10;

        // Boost for no next action (needs attention)
        if (!lead.proxima_acao) priority += 20;

        // Boost for stalled leads
        if (hoursInStage >= 48) priority += 15;
        else if (hoursInStage >= 24) priority += 10;

        // Boost for high-value leads
        if ((lead.valor_estimado || 0) >= 500000) priority += 15;

        // Boost for advanced stages
        if (["possibilidade_visita", "visita_marcada"].includes(stage.tipo)) priority += 20;
        if (["qualificacao", "atendimento"].includes(stage.tipo)) priority += 10;

        return {
          lead,
          priority,
          score: score.score,
          stageName: stage.nome,
          daysInStage,
          hoursInStage,
        };
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);
  }, [leads, stageMap]);

  if (priorities.length === 0) return null;

  return (
    <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Prioridades do Dia</span>
          <Badge className="text-[9px] h-4 px-1.5 bg-primary/20 text-primary border-0">
            {priorities.length}
          </Badge>
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-2.5 space-y-1.5">
          {priorities.map((p, idx) => (
            <div
              key={p.lead.id}
              onClick={() => onSelectLead(p.lead)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-card border border-border/50 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
            >
              {/* Rank */}
              <span className="text-xs font-black text-primary w-4 text-center shrink-0">{idx + 1}</span>

              {/* Lead info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground truncate">{p.lead.nome}</span>
                  {p.lead.temperatura === "quente" && <Flame className="h-3 w-3 text-red-500 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {p.lead.empreendimento && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      {p.lead.empreendimento}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">•</span>
                  <span className="text-[10px] text-muted-foreground">{p.stageName}</span>
                </div>
              </div>

              {/* Action / status */}
              <div className="flex items-center gap-1.5 shrink-0">
                {p.lead.proxima_acao ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold truncate max-w-[80px]">
                    {p.lead.proxima_acao}
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-semibold flex items-center gap-0.5">
                    <AlertCircle className="h-2.5 w-2.5" /> Sem ação
                  </span>
                )}

                {p.daysInStage >= 2 && (
                  <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {p.daysInStage}d
                  </span>
                )}

                {/* Quick actions */}
                {p.lead.telefone && (
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(`tel:${p.lead.telefone}`, "_self"); }}
                      className="p-1 rounded hover:bg-muted transition-colors"
                    >
                      <Phone className="h-3 w-3 text-primary" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(getWhatsAppUrl(p.lead.telefone!), "_blank"); }}
                      className="p-1 rounded hover:bg-accent transition-colors"
                    >
                      <MessageCircle className="h-3 w-3 text-green-600" />
                    </button>
                  </div>
                )}

                <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded">
                  <Zap className="h-2.5 w-2.5 inline mr-0.5" />{p.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}