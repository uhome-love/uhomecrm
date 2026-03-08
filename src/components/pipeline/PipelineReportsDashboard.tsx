import { useMemo, useState, useEffect, useCallback } from "react";
import type { PipelineStage, PipelineLead } from "@/hooks/usePipeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, Users, Building2, Megaphone, CalendarCheck, Eye,
  TrendingUp, Clock, AlertTriangle, Target, DollarSign, Percent,
  ArrowRight,
} from "lucide-react";
import { differenceInHours, subDays, subMonths, startOfMonth, format } from "date-fns";
import { getSlaStatus, STAGE_SLA } from "@/lib/leadScoring";

interface Props {
  stages: PipelineStage[];
  leads: PipelineLead[];
  corretorNomes: Record<string, string>;
}

interface VisitaStats {
  marcadas: number;
  realizadas: number;
  noShow: number;
  taxaComparecimento: number;
}

// SLA meta targets (hours) per stage type
const STAGE_TIME_META: Record<string, number> = {
  novo_lead: 0.5, sem_contato: 1, atendimento: 4, qualificacao: 24,
  possibilidade_visita: 48, visita_marcada: 48, visita_realizada: 24,
  negociacao: 48, proposta: 24, assinatura: 72,
};

function EmptyDataMessage({ onExpand }: { onExpand?: () => void }) {
  return (
    <div className="text-center py-6 space-y-2">
      <p className="text-xs text-muted-foreground">Sem dados para o período selecionado.</p>
      <p className="text-[11px] text-muted-foreground/70">Tente ampliar o período de análise.</p>
      {onExpand && (
        <Button variant="outline" size="sm" className="text-xs gap-1 mt-1" onClick={onExpand}>
          Ampliar para este mês <ArrowRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default function PipelineReportsDashboard({ stages, leads, corretorNomes }: Props) {
  const [visitaStats, setVisitaStats] = useState<VisitaStats>({ marcadas: 0, realizadas: 0, noShow: 0, taxaComparecimento: 0 });
  const [oaStats, setOaStats] = useState({ totalAproveitados: 0, totalTentativas: 0, taxaAproveitamento: 0 });
  const [periodo, setPeriodo] = useState("mes_atual");

  const periodoRange = useMemo(() => {
    const now = new Date();
    switch (periodo) {
      case "hoje": return { from: new Date(now.toDateString()), to: now };
      case "7d": return { from: subDays(now, 7), to: now };
      case "30d": return { from: subDays(now, 30), to: now };
      case "mes_atual": return { from: startOfMonth(now), to: now };
      case "mes_anterior": { const s = startOfMonth(subMonths(now, 1)); return { from: s, to: startOfMonth(now) }; }
      default: return { from: startOfMonth(now), to: now };
    }
  }, [periodo]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const d = new Date(l.created_at);
      return d >= periodoRange.from && d <= periodoRange.to;
    });
  }, [leads, periodoRange]);

  // Load visita stats from DB
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("visitas")
        .select("status")
        .gte("data", format(periodoRange.from, "yyyy-MM-dd"))
        .lte("data", format(periodoRange.to, "yyyy-MM-dd"))
        .limit(5000);
      if (!data) return;
      const marcadas = data.filter(v => ["marcada", "confirmada"].includes(v.status)).length;
      const realizadas = data.filter(v => v.status === "realizada").length;
      const noShow = data.filter(v => v.status === "no_show").length;
      const total = realizadas + noShow;
      setVisitaStats({
        marcadas: marcadas + realizadas + noShow,
        realizadas,
        noShow,
        taxaComparecimento: total > 0 ? Math.round((realizadas / total) * 100) : 0,
      });
    })();
  }, [periodoRange]);

  // Load OA stats
  useEffect(() => {
    (async () => {
      const fromStr = periodoRange.from.toISOString();
      const toStr = periodoRange.to.toISOString();
      const { count: aproveitados } = await supabase
        .from("oferta_ativa_leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "aproveitado")
        .gte("created_at", fromStr)
        .lte("created_at", toStr);
      const { count: tentativas } = await supabase
        .from("oferta_ativa_tentativas")
        .select("id", { count: "exact", head: true })
        .gte("created_at", fromStr)
        .lte("created_at", toStr);
      const total = tentativas || 0;
      const aprov = aproveitados || 0;
      setOaStats({
        totalAproveitados: aprov,
        totalTentativas: total,
        taxaAproveitamento: total > 0 ? Math.round((aprov / total) * 100) : 0,
      });
    })();
  }, [periodoRange]);

  const expandToMonth = useCallback(() => setPeriodo("mes_atual"), []);

  const formatVGV = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}mil`;
    return `R$ ${v.toLocaleString("pt-BR")}`;
  };

  // Stage metrics
  const stageMetrics = useMemo(() => {
    return stages.map(stage => {
      const stageLeads = filteredLeads.filter(l => l.stage_id === stage.id);
      const totalHours = stageLeads.reduce((s, l) => s + differenceInHours(new Date(), new Date(l.stage_changed_at)), 0);
      const vgv = stageLeads.reduce((s, l) => s + (l.valor_estimado || 0), 0);
      let slaBreaches = 0;
      stageLeads.forEach(l => {
        const sla = getSlaStatus(stage.tipo, l.stage_changed_at);
        if (sla.status === "breach") slaBreaches++;
      });
      return {
        stage,
        count: stageLeads.length,
        vgv,
        avgHours: stageLeads.length > 0 ? totalHours / stageLeads.length : 0,
        slaBreaches,
        metaHours: STAGE_TIME_META[stage.tipo] || null,
      };
    });
  }, [stages, filteredLeads]);

  const vendaStage = stages.find(s => s.tipo === "venda");
  const descarteStage = stages.find(s => s.tipo === "descarte");
  const vendasLeads = vendaStage ? filteredLeads.filter(l => l.stage_id === vendaStage.id) : [];
  const totalVGV = vendasLeads.reduce((s, l) => s + (l.valor_estimado || 0), 0);
  const totalPipeline = filteredLeads.length;
  const semProximaAcao = filteredLeads.filter(l => !l.proxima_acao && !l.data_proxima_acao).length;

  // By Corretor
  const corretorData = useMemo(() => {
    const map = new Map<string, { nome: string; leads: number; vendas: number; vgv: number; sla: number }>();
    for (const lead of filteredLeads) {
      if (!lead.corretor_id) continue;
      const e = map.get(lead.corretor_id) || {
        nome: corretorNomes[lead.corretor_id] || "Sem nome",
        leads: 0, vendas: 0, vgv: 0, sla: 0,
      };
      e.leads++;
      if (vendaStage && lead.stage_id === vendaStage.id) {
        e.vendas++;
        e.vgv += lead.valor_estimado || 0;
      }
      const stage = stages.find(s => s.id === lead.stage_id);
      if (stage) {
        const sla = getSlaStatus(stage.tipo, lead.stage_changed_at);
        if (sla.status === "breach") e.sla++;
      }
      map.set(lead.corretor_id, e);
    }
    return Array.from(map.values()).sort((a, b) => b.vgv - a.vgv || b.vendas - a.vendas);
  }, [filteredLeads, corretorNomes, stages, vendaStage]);

  // By Gerente
  const gerenteData = useMemo(() => {
    const map = new Map<string, { nome: string; leads: number; vendas: number; vgv: number }>();
    for (const lead of filteredLeads) {
      if (!lead.gerente_id) continue;
      const e = map.get(lead.gerente_id) || {
        nome: corretorNomes[lead.gerente_id] || "Gerente",
        leads: 0, vendas: 0, vgv: 0,
      };
      e.leads++;
      if (vendaStage && lead.stage_id === vendaStage.id) {
        e.vendas++;
        e.vgv += lead.valor_estimado || 0;
      }
      map.set(lead.gerente_id, e);
    }
    return Array.from(map.values()).sort((a, b) => b.vgv - a.vgv);
  }, [filteredLeads, corretorNomes, vendaStage]);

  // By Origem
  const origemData = useMemo(() => {
    const map = new Map<string, { total: number; vendas: number; vgv: number }>();
    for (const lead of filteredLeads) {
      const key = lead.origem || "desconhecida";
      const e = map.get(key) || { total: 0, vendas: 0, vgv: 0 };
      e.total++;
      if (vendaStage && lead.stage_id === vendaStage.id) {
        e.vendas++;
        e.vgv += lead.valor_estimado || 0;
      }
      map.set(key, e);
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({ origem: k, ...v, taxa: v.total > 0 ? Math.round((v.vendas / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredLeads, vendaStage]);

  // By Campanha (empreendimento)
  const campanhaData = useMemo(() => {
    const map = new Map<string, { total: number; vendas: number; vgv: number }>();
    for (const lead of filteredLeads) {
      const key = lead.empreendimento || "sem campanha";
      const e = map.get(key) || { total: 0, vendas: 0, vgv: 0 };
      e.total++;
      if (vendaStage && lead.stage_id === vendaStage.id) {
        e.vendas++;
        e.vgv += lead.valor_estimado || 0;
      }
      map.set(key, e);
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({ campanha: k, ...v, taxa: v.total > 0 ? Math.round((v.vendas / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredLeads, vendaStage]);

  const formatTime = (h: number) => {
    if (h < 1) return `${Math.round(h * 60)}min`;
    if (h < 24) return `${Math.round(h)}h`;
    return `${Math.round(h / 24)}d`;
  };

  return (
    <div className="space-y-6 overflow-y-auto max-h-full pb-8 pr-1">
      {/* Period selector */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Relatórios do Pipeline
        </h3>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="mes_atual">Mês atual</SelectItem>
            <SelectItem value="mes_anterior">Mês anterior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards — reordered: Sem Próx. Ação first */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: AlertTriangle, label: "Sem Próx. Ação", value: semProximaAcao, color: semProximaAcao > 0 ? "text-destructive" : "text-muted-foreground" },
          { icon: Target, label: "Total Pipeline", value: totalPipeline, color: "text-primary" },
          { icon: CalendarCheck, label: "Visitas Realizadas", value: visitaStats.realizadas, color: "text-blue-600" },
          { icon: Percent, label: "Comparecimento", value: `${visitaStats.taxaComparecimento}%`, color: visitaStats.taxaComparecimento >= 70 ? "text-emerald-600" : "text-amber-600" },
          { icon: DollarSign, label: "Vendas", value: vendasLeads.length, color: "text-emerald-600" },
          { icon: TrendingUp, label: "VGV Vendas", value: totalVGV === 0 ? "R$ 0" : formatVGV(totalVGV), color: totalVGV === 0 ? "text-muted-foreground" : "text-primary" },
        ].map((kpi, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="pt-3 pb-2 px-3">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leads por Etapa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Leads por Etapa & Tempo Médio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stageMetrics.filter(m => !["descarte"].includes(m.stage.tipo)).map(m => {
              const maxCount = Math.max(...stageMetrics.map(s => s.count), 1);
              const pct = m.count > 0 ? (m.count / maxCount) * 100 : 0;
              const metaH = m.metaHours;
              const isOverMeta = metaH != null && m.avgHours > metaH && m.count > 0;

              return (
                <div key={m.stage.id} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 min-w-[130px]">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: m.stage.cor }} />
                    <span className="text-xs font-medium truncate">{m.stage.nome}</span>
                  </div>
                  <div className="flex-1">
                    {m.count > 0 ? (
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    ) : (
                      <div className="h-2 rounded-full border border-dashed border-muted-foreground/30" />
                    )}
                  </div>
                  <span className="text-xs font-bold w-8 text-right">{m.count}</span>
                  <div className="text-right w-24 shrink-0">
                    {m.count > 0 ? (
                      <span className={`text-[10px] ${isOverMeta ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                        {formatTime(m.avgHours)}
                        {metaH != null && (
                          <span className={`ml-1 ${isOverMeta ? "text-destructive" : "text-muted-foreground/70"}`}>
                            · meta: {formatTime(metaH)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    )}
                  </div>
                  {m.slaBreaches > 0 && (
                    <Badge className="bg-destructive/15 text-destructive text-[9px] h-4">{m.slaBreaches} 🚨</Badge>
                  )}
                  {m.vgv > 0 && (
                    <span className="text-[10px] text-primary font-medium w-16 text-right">{formatVGV(m.vgv)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="corretor" className="space-y-3">
        <TabsList className="h-8">
          <TabsTrigger value="corretor" className="text-[11px] gap-1"><Users className="h-3 w-3" /> Por Corretor</TabsTrigger>
          <TabsTrigger value="gerente" className="text-[11px] gap-1"><Users className="h-3 w-3" /> Por Gerente</TabsTrigger>
          <TabsTrigger value="origem" className="text-[11px] gap-1"><Megaphone className="h-3 w-3" /> Por Origem</TabsTrigger>
          <TabsTrigger value="campanha" className="text-[11px] gap-1"><Building2 className="h-3 w-3" /> Por Campanha</TabsTrigger>
        </TabsList>

        {/* Corretor */}
        <TabsContent value="corretor">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {corretorData.length === 0 ? (
                  <EmptyDataMessage onExpand={periodo !== "mes_atual" ? expandToMonth : undefined} />
                ) : corretorData.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-border/30">
                    <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-amber-500" : "text-muted-foreground/50"}`}>#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{c.nome}</p>
                      <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span>{c.leads} leads</span>
                        <span className="text-emerald-600 font-medium">{c.vendas} vendas</span>
                        {c.sla > 0 && <span className="text-destructive">{c.sla} atrasados</span>}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-primary">{formatVGV(c.vgv)}</span>
                    {c.leads > 0 && (
                      <Badge className="text-[9px]" variant="secondary">{Math.round((c.vendas / c.leads) * 100)}%</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gerente */}
        <TabsContent value="gerente">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {gerenteData.length === 0 ? (
                  <EmptyDataMessage onExpand={periodo !== "mes_atual" ? expandToMonth : undefined} />
                ) : gerenteData.map((g, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-border/30">
                    <span className="text-xs font-bold w-5 text-center text-muted-foreground/50">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{g.nome}</p>
                      <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span>{g.leads} leads</span>
                        <span className="text-emerald-600 font-medium">{g.vendas} vendas</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-primary">{formatVGV(g.vgv)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Origem */}
        <TabsContent value="origem">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {origemData.length === 0 ? (
                  <EmptyDataMessage onExpand={periodo !== "mes_atual" ? expandToMonth : undefined} />
                ) : origemData.map((o, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-border/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium capitalize">{o.origem.replace(/_/g, " ")}</p>
                      <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span>{o.total} leads</span>
                        <span className="text-emerald-600 font-medium">{o.vendas} vendas</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-primary">{formatVGV(o.vgv)}</span>
                    <Badge className={`text-[9px] ${o.taxa >= 20 ? "bg-emerald-500/15 text-emerald-600" : o.taxa >= 10 ? "bg-blue-500/15 text-blue-600" : "bg-muted text-muted-foreground"}`}>
                      {o.taxa}% conv.
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campanha */}
        <TabsContent value="campanha">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {campanhaData.length === 0 ? (
                  <EmptyDataMessage onExpand={periodo !== "mes_atual" ? expandToMonth : undefined} />
                ) : campanhaData.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-border/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{c.campanha}</p>
                      <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span>{c.total} leads</span>
                        <span className="text-emerald-600 font-medium">{c.vendas} vendas</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-primary">{formatVGV(c.vgv)}</span>
                    <Badge className={`text-[9px] ${c.taxa >= 20 ? "bg-emerald-500/15 text-emerald-600" : c.taxa >= 10 ? "bg-blue-500/15 text-blue-600" : "bg-muted text-muted-foreground"}`}>
                      {c.taxa}% conv.
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Visitas & OA summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-blue-600" />
              Visitas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Marcadas (total)</span><span className="font-bold">{visitaStats.marcadas}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Realizadas</span><span className="font-bold text-emerald-600">{visitaStats.realizadas}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">No Show</span><span className="font-bold text-destructive">{visitaStats.noShow}</span></div>
            <div className="flex justify-between text-xs border-t pt-2">
              <span className="font-medium">Taxa de Comparecimento</span>
              <Badge className={`text-[10px] ${visitaStats.taxaComparecimento >= 70 ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
                {visitaStats.taxaComparecimento}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Oferta Ativa → Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total Tentativas</span><span className="font-bold">{oaStats.totalTentativas}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Aproveitados (Pipeline)</span><span className="font-bold text-emerald-600">{oaStats.totalAproveitados}</span></div>
            <div className="flex justify-between text-xs border-t pt-2">
              <span className="font-medium">Taxa de Aproveitamento</span>
              <Badge className={`text-[10px] ${oaStats.taxaAproveitamento >= 15 ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
                {oaStats.taxaAproveitamento}%
              </Badge>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Leads de OA no Pipeline</span>
              <span className="font-bold">{filteredLeads.filter(l => l.origem === "oferta_ativa").length}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
