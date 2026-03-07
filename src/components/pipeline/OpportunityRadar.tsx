import { useMemo } from "react";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Flame, Target, TrendingUp, AlertTriangle, Eye, Clock,
  Zap, BarChart3, ArrowUpRight, PhoneCall, AlertCircle, Lightbulb
} from "lucide-react";
import { differenceInHours, differenceInDays } from "date-fns";

interface OpportunityRadarProps {
  leads: PipelineLead[];
  stages: PipelineStage[];
  corretorNomes: Record<string, string>;
  onSelectLead: (lead: PipelineLead) => void;
}

interface Opportunity {
  lead: PipelineLead;
  score: number;
  stageName: string;
  signals: string[];
  category: "hot" | "warm" | "watch";
}

interface Suggestion {
  lead: PipelineLead;
  reason: string;
  icon: "followup" | "forgotten" | "no_action" | "stalled";
  stageName: string;
}

function getOpportunityCategory(score: number): "hot" | "warm" | "watch" {
  if (score >= 70) return "hot";
  if (score >= 45) return "warm";
  return "watch";
}

const CATEGORY_CONFIG = {
  hot: { icon: Flame, label: "Alta probabilidade", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  warm: { icon: Target, label: "Boa probabilidade", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  watch: { icon: Eye, label: "Acompanhar", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
};

const SUGGESTION_CONFIG = {
  followup: { icon: PhoneCall, label: "Follow-up pendente", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  forgotten: { icon: AlertCircle, label: "Lead esquecido", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  no_action: { icon: AlertTriangle, label: "Sem próxima ação", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
  stalled: { icon: Clock, label: "Lead parado", color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border" },
};

export default function OpportunityRadar({ leads, stages, corretorNomes, onSelectLead }: OpportunityRadarProps) {
  const stageMap = useMemo(() => new Map(stages.map(s => [s.id, s])), [stages]);

  const opportunities = useMemo(() => {
    return leads
      .filter(l => {
        const stage = stageMap.get(l.stage_id);
        return stage && !["venda", "descarte"].includes(stage.tipo);
      })
      .map(lead => {
        const stage = stageMap.get(lead.stage_id)!;
        const score = lead.oportunidade_score || 0;
        const signals: string[] = [];
        const hoursInStage = differenceInHours(new Date(), new Date(lead.stage_changed_at));

        if (["visita_realizada", "negociacao", "proposta", "assinatura"].includes(stage.tipo)) {
          signals.push("🏠 Etapa avançada");
        }
        if ((lead.valor_estimado || 0) >= 500000) {
          signals.push(`💰 Valor alto: R$ ${(lead.valor_estimado! / 1000).toFixed(0)}mil`);
        }
        if (hoursInStage < 24 && ["visita_marcada", "possibilidade_visita"].includes(stage.tipo)) {
          signals.push("⚡ Progressão rápida");
        }
        if (lead.gerente_id) signals.push("🛡️ Gerente envolvido");
        if (lead.complexidade_score >= 40) signals.push("🔥 Alta complexidade");
        if (hoursInStage > 48 && score >= 45) signals.push("⏰ Precisa atenção");

        return { lead, score, stageName: stage.nome, signals, category: getOpportunityCategory(score) } as Opportunity;
      })
      .filter(o => o.score >= 30)
      .sort((a, b) => b.score - a.score);
  }, [leads, stageMap]);

  // Generate suggestions for leads that don't appear in opportunities
  const suggestions = useMemo(() => {
    const oppIds = new Set(opportunities.map(o => o.lead.id));
    const result: Suggestion[] = [];
    const now = new Date();

    for (const lead of leads) {
      if (oppIds.has(lead.id)) continue;
      const stage = stageMap.get(lead.stage_id);
      if (!stage || ["venda", "descarte"].includes(stage.tipo)) continue;

      const hoursInStage = differenceInHours(now, new Date(lead.stage_changed_at));
      const daysInStage = differenceInDays(now, new Date(lead.stage_changed_at));

      // Sem próxima ação definida
      if (!lead.proxima_acao) {
        result.push({ lead, reason: "Defina uma próxima ação para este lead", icon: "no_action", stageName: stage.nome });
        continue;
      }

      // Lead parado há mais de 3 dias
      if (daysInStage >= 3) {
        result.push({ lead, reason: `Parado há ${daysInStage} dias em "${stage.nome}"`, icon: "forgotten", stageName: stage.nome });
        continue;
      }

      // Follow-up pendente (parado entre 24h-72h)
      if (hoursInStage >= 24 && hoursInStage < 72) {
        result.push({ lead, reason: `Sem movimentação há ${Math.floor(hoursInStage)}h — hora do follow-up`, icon: "followup", stageName: stage.nome });
        continue;
      }

      // Data da próxima ação já passou
      if (lead.data_proxima_acao && new Date(lead.data_proxima_acao + "T23:59:59") < now) {
        result.push({ lead, reason: "Data da próxima ação já passou", icon: "stalled", stageName: stage.nome });
      }
    }

    return result.sort((a, b) => {
      const priority: Record<string, number> = { no_action: 0, forgotten: 1, followup: 2, stalled: 3 };
      return (priority[a.icon] ?? 99) - (priority[b.icon] ?? 99);
    }).slice(0, 20);
  }, [leads, opportunities, stageMap]);

  const hotCount = opportunities.filter(o => o.category === "hot").length;
  const warmCount = opportunities.filter(o => o.category === "warm").length;
  const totalVGV = opportunities
    .filter(o => o.category === "hot")
    .reduce((sum, o) => sum + (o.lead.valor_estimado || 0), 0);
  const avgScore = opportunities.length > 0
    ? Math.round(opportunities.reduce((sum, o) => sum + o.score, 0) / opportunities.length)
    : 0;

  return (
    <div className="space-y-4 p-4 overflow-auto h-full">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border-red-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">Quentes</span>
          </div>
          <p className="text-xl font-bold text-foreground">{hotCount}</p>
        </Card>
        <Card className="p-3 border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Boas chances</span>
          </div>
          <p className="text-xl font-bold text-foreground">{warmCount}</p>
        </Card>
        <Card className="p-3 border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">VGV Quente</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {totalVGV >= 1_000_000 ? `R$ ${(totalVGV / 1_000_000).toFixed(1)}M` : `R$ ${(totalVGV / 1000).toFixed(0)}mil`}
          </p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Score médio</span>
          </div>
          <p className="text-xl font-bold text-foreground">{avgScore}/100</p>
        </Card>
      </div>

      {/* Opportunity List */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Radar de Oportunidades ({opportunities.length})
        </h3>

        {opportunities.length === 0 && suggestions.length === 0 ? (
          <Card className="p-8 text-center">
            <Target className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma oportunidade detectada ainda</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Leads avançam no funil para gerar oportunidades</p>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-360px)]">
            <div className="space-y-2 pr-2">
              {opportunities.map(opp => {
                const config = CATEGORY_CONFIG[opp.category];
                const CatIcon = config.icon;
                const daysTotal = differenceInDays(new Date(), new Date(opp.lead.created_at));

                return (
                  <Card
                    key={opp.lead.id}
                    className={`p-3 cursor-pointer hover:shadow-md transition-all border-l-[3px] ${config.border}`}
                    onClick={() => onSelectLead(opp.lead)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground truncate">{opp.lead.nome}</h4>
                          <Badge className={`text-[9px] ${config.bg} ${config.color} border-0`}>
                            <CatIcon className="h-2.5 w-2.5 mr-0.5" />
                            {opp.score}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{opp.stageName}</span>
                          {opp.lead.empreendimento && (
                            <>
                              <span>•</span>
                              <span className="truncate">{opp.lead.empreendimento}</span>
                            </>
                          )}
                          {opp.lead.valor_estimado && opp.lead.valor_estimado > 0 && (
                            <>
                              <span>•</span>
                              <span className="font-medium">R$ {opp.lead.valor_estimado.toLocaleString("pt-BR")}</span>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {opp.signals.map((s, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="w-16">
                          <Progress value={opp.score} className="h-1.5" />
                        </div>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {daysTotal}d
                        </span>
                        {opp.lead.corretor_id && corretorNomes[opp.lead.corretor_id] && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                            {corretorNomes[opp.lead.corretor_id]}
                          </span>
                        )}
                        <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                      </div>
                    </div>
                  </Card>
                );
              })}

              {/* Suggestions section */}
              {suggestions.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-4 pb-1">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-foreground">
                      Sugestões para trabalhar hoje ({suggestions.length})
                    </h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground -mt-1 mb-2">
                    Leads que precisam da sua atenção — follow-ups, ações pendentes e leads esquecidos.
                  </p>

                  {suggestions.map(sug => {
                    const config = SUGGESTION_CONFIG[sug.icon];
                    const SugIcon = config.icon;
                    const daysTotal = differenceInDays(new Date(), new Date(sug.lead.created_at));

                    return (
                      <Card
                        key={sug.lead.id}
                        className={`p-3 cursor-pointer hover:shadow-md transition-all border-l-[3px] ${config.border}`}
                        onClick={() => onSelectLead(sug.lead)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-foreground truncate">{sug.lead.nome}</h4>
                              <Badge className={`text-[9px] ${config.bg} ${config.color} border-0`}>
                                <SugIcon className="h-2.5 w-2.5 mr-0.5" />
                                {config.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{sug.stageName}</span>
                              {sug.lead.empreendimento && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{sug.lead.empreendimento}</span>
                                </>
                              )}
                            </div>
                            <p className="text-[11px] mt-1 text-muted-foreground italic">{sug.reason}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {daysTotal}d
                            </span>
                            {sug.lead.corretor_id && corretorNomes[sug.lead.corretor_id] && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                                {corretorNomes[sug.lead.corretor_id]}
                              </span>
                            )}
                            <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}