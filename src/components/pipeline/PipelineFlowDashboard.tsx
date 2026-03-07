import { useMemo, useState, useEffect } from "react";
import type { PipelineStage, PipelineLead } from "@/hooks/usePipeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { differenceInHours, differenceInMinutes } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  Clock,
  TrendingUp,
  AlertTriangle,
  Users,
  Target,
  Flame,
  BarChart3,
} from "lucide-react";
import { calculateLeadScore, getSlaStatus } from "@/lib/leadScoring";

interface PipelineFlowDashboardProps {
  stages: PipelineStage[];
  leads: PipelineLead[];
  corretorNomes: Record<string, string>;
}

interface StageMetric {
  stage: PipelineStage;
  count: number;
  vgv: number;
  avgHours: number;
  slaBreaches: number;
  slaWarnings: number;
  avgScore: number;
}

interface CorretorMetric {
  id: string;
  nome: string;
  totalLeads: number;
  quentes: number;
  avgScore: number;
  slaBreaches: number;
  vgv: number;
}

interface TransitionMetric {
  from: string;
  to: string;
  fromName: string;
  toName: string;
  count: number;
  avgHours: number;
}

export default function PipelineFlowDashboard({ stages, leads, corretorNomes }: PipelineFlowDashboardProps) {
  const [transitions, setTransitions] = useState<TransitionMetric[]>([]);

  // Load transition history
  useEffect(() => {
    async function loadHistory() {
      const { data } = await supabase
        .from("pipeline_historico")
        .select("stage_anterior_id, stage_novo_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!data || data.length === 0) return;

      // Group transitions and calculate avg time
      const groups = new Map<string, { count: number; totalMs: number }>();
      const sorted = [...data].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      for (let i = 0; i < sorted.length; i++) {
        const t = sorted[i];
        if (!t.stage_anterior_id) continue;
        const key = `${t.stage_anterior_id}→${t.stage_novo_id}`;
        const group = groups.get(key) || { count: 0, totalMs: 0 };
        group.count++;

        // Find previous transition for same pipeline_lead to calculate time
        // Simplified: just count
        groups.set(key, group);
      }

      const stageMap = new Map(stages.map(s => [s.id, s]));
      const result: TransitionMetric[] = [];
      for (const [key, val] of groups) {
        const [fromId, toId] = key.split("→");
        const fromStage = stageMap.get(fromId);
        const toStage = stageMap.get(toId);
        if (fromStage && toStage) {
          result.push({
            from: fromId,
            to: toId,
            fromName: fromStage.nome,
            toName: toStage.nome,
            count: val.count,
            avgHours: 0,
          });
        }
      }
      setTransitions(result.sort((a, b) => b.count - a.count));
    }
    loadHistory();
  }, [stages]);

  // Stage metrics
  const stageMetrics: StageMetric[] = useMemo(() => {
    return stages.map(stage => {
      const stageLeads = leads.filter(l => l.stage_id === stage.id);
      const totalHours = stageLeads.reduce(
        (sum, l) => sum + differenceInHours(new Date(), new Date(l.stage_changed_at)), 0
      );
      const avgHours = stageLeads.length > 0 ? totalHours / stageLeads.length : 0;
      const vgv = stageLeads.reduce((sum, l) => sum + (l.valor_estimado || 0), 0);

      let slaBreaches = 0;
      let slaWarnings = 0;
      let totalScore = 0;

      for (const lead of stageLeads) {
        const sla = getSlaStatus(stage.tipo, lead.stage_changed_at);
        if (sla.status === "breach") slaBreaches++;
        else if (sla.status === "warning") slaWarnings++;
        totalScore += calculateLeadScore(lead as any).score;
      }

      return {
        stage,
        count: stageLeads.length,
        vgv,
        avgHours,
        slaBreaches,
        slaWarnings,
        avgScore: stageLeads.length > 0 ? Math.round(totalScore / stageLeads.length) : 0,
      };
    });
  }, [stages, leads]);

  // Corretor metrics
  const corretorMetrics: CorretorMetric[] = useMemo(() => {
    const map = new Map<string, CorretorMetric>();
    for (const lead of leads) {
      if (!lead.corretor_id) continue;
      const existing = map.get(lead.corretor_id) || {
        id: lead.corretor_id,
        nome: corretorNomes[lead.corretor_id] || "Sem nome",
        totalLeads: 0,
        quentes: 0,
        avgScore: 0,
        slaBreaches: 0,
        vgv: 0,
      };
      existing.totalLeads++;
      if ((lead as any).temperatura === "quente") existing.quentes++;
      existing.vgv += lead.valor_estimado || 0;

      const stage = stages.find(s => s.id === lead.stage_id);
      if (stage) {
        const sla = getSlaStatus(stage.tipo, lead.stage_changed_at);
        if (sla.status === "breach") existing.slaBreaches++;
      }
      existing.avgScore += calculateLeadScore(lead as any).score;
      map.set(lead.corretor_id, existing);
    }

    return Array.from(map.values())
      .map(c => ({ ...c, avgScore: c.totalLeads > 0 ? Math.round(c.avgScore / c.totalLeads) : 0 }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [leads, corretorNomes, stages]);

  // Conversion funnel (sequential stages only)
  const funnelStages = stages.filter(s => !["descarte", "venda"].includes(s.tipo));
  const vendaStage = stages.find(s => s.tipo === "venda");
  const totalLeads = leads.length;
  const vendasCount = vendaStage ? leads.filter(l => l.stage_id === vendaStage.id).length : 0;

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}min`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  const formatVGV = (value: number) => {
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}mil`;
    return `R$ ${value.toLocaleString("pt-BR")}`;
  };

  return (
    <div className="space-y-6 overflow-y-auto max-h-full pb-8 pr-1">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Pipeline</span>
            </div>
            <p className="text-2xl font-bold">{totalLeads}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Vendas</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{vendasCount}</p>
            {totalLeads > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {((vendasCount / totalLeads) * 100).toFixed(1)}% conversão
              </span>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Prazos Estourados</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {stageMetrics.reduce((s, m) => s + m.slaBreaches, 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">VGV Total</span>
            </div>
            <p className="text-lg font-bold">
              {formatVGV(stageMetrics.reduce((s, m) => s + m.vgv, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Flow */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Funil do Pipeline — Tempo Médio por Etapa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-stretch gap-1 overflow-x-auto pb-2 snap-x snap-mandatory">
            {stageMetrics
              .filter(m => !["descarte"].includes(m.stage.tipo))
              .map((metric, i, arr) => {
                const maxCount = Math.max(...arr.map(m => m.count), 1);
                const pct = (metric.count / maxCount) * 100;
                const hasSlaIssue = metric.slaBreaches > 0;

                return (
                  <div key={metric.stage.id} className="flex items-center gap-1">
                    <div
                      className={`flex flex-col items-center p-2 sm:p-3 rounded-lg border min-w-[100px] sm:min-w-[120px] snap-start transition-all ${
                        hasSlaIssue ? "border-red-500/40 bg-red-500/5" : "border-border/50 bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.stage.cor }} />
                        <span className="text-[11px] font-bold text-foreground truncate max-w-[90px]">
                          {metric.stage.nome}
                        </span>
                      </div>

                      <span className="text-xl font-bold">{metric.count}</span>

                      <div className="w-full mt-2">
                        <Progress value={pct} className="h-1.5" />
                      </div>

                      <div className="flex flex-col items-center gap-0.5 mt-2">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatTime(metric.avgHours)} média
                        </span>
                        {metric.slaBreaches > 0 && (
                          <span className="text-[10px] text-red-600 font-semibold flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {metric.slaBreaches} atrasados
                          </span>
                        )}
                        {metric.slaWarnings > 0 && (
                          <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
                            ⚠ {metric.slaWarnings} risco
                          </span>
                        )}
                      </div>

                      {metric.vgv > 0 && (
                        <span className="text-[10px] text-primary font-semibold mt-1">
                          {formatVGV(metric.vgv)}
                        </span>
                      )}

                      <Badge
                        className={`text-[9px] mt-1 ${
                          metric.avgScore >= 70 ? "bg-emerald-500/15 text-emerald-600" :
                          metric.avgScore >= 50 ? "bg-blue-500/15 text-blue-600" :
                          "bg-amber-500/15 text-amber-600"
                        }`}
                      >
                        Score {metric.avgScore}
                      </Badge>
                    </div>

                    {i < arr.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    )}
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Transitions */}
      {transitions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              Transições Mais Frequentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {transitions.slice(0, 8).map((t, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-xs font-medium text-foreground min-w-[100px] truncate">{t.fromName}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-foreground min-w-[100px] truncate">{t.toName}</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{t.count}x</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Corretor Performance */}
      {corretorMetrics.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Performance por Corretor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {corretorMetrics.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/30 bg-card">
                  <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{c.totalLeads} leads</span>
                      {c.quentes > 0 && (
                        <span className="text-[10px] text-red-600">🔥 {c.quentes} quentes</span>
                      )}
                      {c.vgv > 0 && (
                        <span className="text-[10px] text-primary font-medium">{formatVGV(c.vgv)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.slaBreaches > 0 && (
                      <Badge className="bg-red-500/15 text-red-600 text-[9px]">
                        {c.slaBreaches} atrasados
                      </Badge>
                    )}
                    <Badge
                      className={`text-[10px] ${
                        c.avgScore >= 70 ? "bg-emerald-500/15 text-emerald-600" :
                        c.avgScore >= 50 ? "bg-blue-500/15 text-blue-600" :
                        "bg-amber-500/15 text-amber-600"
                      }`}
                    >
                      {c.avgScore}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
