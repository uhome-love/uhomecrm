import { useMemo } from "react";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { Flame, Zap, Phone, MessageCircle, Clock, MapPin, AlertTriangle, Calendar, Star, ChevronRight, ChevronLeft, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { differenceInHours, differenceInDays, isToday } from "date-fns";
import { calculateLeadScore } from "@/lib/leadScoring";

interface Props {
  leads: PipelineLead[];
  stages: PipelineStage[];
  corretorNomes: Record<string, string>;
  onSelectLead: (lead: PipelineLead) => void;
  open: boolean;
  onToggle: () => void;
}

function getWhatsAppUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

type PriorityReason = {
  icon: React.ReactNode;
  text: string;
  severity: "critical" | "high" | "medium";
};

function computePriority(lead: PipelineLead, stage: PipelineStage): { score: number; reason: PriorityReason } {
  const now = new Date();
  const hoursInStage = differenceInHours(now, new Date(lead.stage_changed_at));
  const daysInStage = differenceInDays(now, new Date(lead.stage_changed_at));
  const leadScore = calculateLeadScore(lead as any).score;

  // 1. SLA expirado
  const slaHoras = (lead as any).sla_horas || 24;
  if (hoursInStage > slaHoras) {
    return {
      score: 1000 + hoursInStage,
      reason: {
        icon: <AlertTriangle className="h-3 w-3 text-danger-500" />,
        text: `SLA expirado há ${hoursInStage - slaHoras}h`,
        severity: "critical",
      },
    };
  }

  // 2. Score alto + sem contato recente
  if (leadScore > 80) {
    const lastContactField = (lead as any).ultimo_contato;
    const lastContact = lastContactField ? differenceInHours(now, new Date(lastContactField)) : 999;
    if (lastContact > 2) {
      return {
        score: 800 + leadScore,
        reason: {
          icon: <Star className="h-3 w-3 text-warning-500" />,
          text: `Score ${leadScore}, sem contato`,
          severity: "high",
        },
      };
    }
  }

  // 3. Visita marcada para hoje
  if (lead.proxima_acao?.toLowerCase().includes("visita") && stage.tipo === "visita_marcada") {
    return {
      score: 700,
      reason: {
        icon: <Calendar className="h-3 w-3 text-primary" />,
        text: "Visita marcada hoje",
        severity: "high",
      },
    };
  }

  // 4. Visita realizada 24-48h sem proposta
  if (stage.tipo === "visita_realizada" && daysInStage >= 1 && daysInStage <= 2) {
    return {
      score: 600 + (48 - hoursInStage),
      reason: {
        icon: <Home className="h-3 w-3 text-primary" />,
        text: `Visitou há ${daysInStage}d, sem proposta`,
        severity: "medium",
      },
    };
  }

  // 5. Lead quente + sem ação
  if (lead.temperatura === "quente" && !lead.proxima_acao) {
    return {
      score: 500 + leadScore,
      reason: {
        icon: <Flame className="h-3 w-3 text-danger-500" />,
        text: "Quente, sem ação definida",
        severity: "high",
      },
    };
  }

  // Fallback
  let score = leadScore;
  if (lead.temperatura === "quente") score += 30;
  if (lead.temperatura === "morno") score += 10;
  if (!lead.proxima_acao) score += 20;
  if (hoursInStage >= 48) score += 15;
  if ((lead.valor_estimado || 0) >= 500000) score += 15;

  return {
    score,
    reason: {
      icon: <Clock className="h-3 w-3 text-muted-foreground" />,
      text: daysInStage > 0 ? `${daysInStage}d na etapa` : "Recente",
      severity: "medium",
    },
  };
}

export default function PipelinePrioridades({ leads, stages, corretorNomes, onSelectLead, open, onToggle }: Props) {
  const stageMap = useMemo(() => new Map(stages.map(s => [s.id, s])), [stages]);

  const priorities = useMemo(() => {
    return leads
      .filter(l => {
        const stage = stageMap.get(l.stage_id);
        return stage && !["venda", "descarte"].includes(stage.tipo);
      })
      .map(lead => {
        const stage = stageMap.get(lead.stage_id)!;
        const { score, reason } = computePriority(lead, stage);
        return { lead, priority: score, reason, stageName: stage.nome };
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);
  }, [leads, stageMap]);

  if (priorities.length === 0) return null;

  // Collapsed tab
  if (!open) {
    return (
      <button
        onClick={onToggle}
        className="flex flex-col items-center justify-center gap-1.5 w-10 bg-card border-l border-border py-4 hover:bg-muted transition-colors duration-150 shrink-0"
      >
        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-[10px] font-bold text-primary">{priorities.length}</span>
      </button>
    );
  }

  return (
    <div className="w-[280px] shrink-0 border-l border-border bg-card flex flex-col animate-slide-in-left overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Prioridades do Dia</span>
          <Badge className="text-[10px] h-[18px] px-1.5 bg-primary/10 text-primary border-0 font-bold">
            {priorities.length}
          </Badge>
        </div>
        <button onClick={onToggle} className="p-1 rounded hover:bg-muted transition-colors duration-150">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-auto px-2 py-2 space-y-1.5">
        {priorities.map((p, idx) => (
          <div
            key={p.lead.id}
            onClick={() => onSelectLead(p.lead)}
            className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border border-border bg-background cursor-pointer hover:border-primary/30 hover:shadow-card-hover transition-all duration-150 group"
          >
            {/* Top row */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary w-4 shrink-0">{idx + 1}</span>
              <span className="text-sm font-semibold text-foreground truncate flex-1">{p.lead.nome}</span>
              {p.lead.temperatura === "quente" && <Flame className="h-3.5 w-3.5 text-danger-500 shrink-0" />}
            </div>

            {/* Empreendimento + stage */}
            <div className="flex items-center gap-1.5 ml-6">
              {p.lead.empreendimento && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {p.lead.empreendimento}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">• {p.stageName}</span>
            </div>

            {/* Reason badge */}
            <div className="flex items-center gap-1.5 ml-6">
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                p.reason.severity === "critical"
                  ? "bg-danger-50 text-danger-700"
                  : p.reason.severity === "high"
                  ? "bg-warning-50 text-warning-700"
                  : "bg-muted text-muted-foreground"
              }`}>
                {p.reason.icon}
                {p.reason.text}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 ml-6 mt-0.5">
              {p.lead.telefone && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-xs gap-1 px-2.5"
                    onClick={(e) => { e.stopPropagation(); window.open(`tel:${p.lead.telefone}`, "_self"); }}
                  >
                    <Phone className="h-3 w-3" /> Ligar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 px-2.5"
                    onClick={(e) => { e.stopPropagation(); window.open(getWhatsAppUrl(p.lead.telefone!), "_blank"); }}
                  >
                    <MessageCircle className="h-3 w-3 text-success-500" /> WhatsApp
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs ml-auto"
                onClick={(e) => { e.stopPropagation(); onSelectLead(p.lead); }}
              >
                Ver lead
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
