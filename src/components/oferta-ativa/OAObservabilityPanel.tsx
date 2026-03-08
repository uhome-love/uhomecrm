import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Clock, TrendingUp, Users, AlertCircle, ShieldAlert } from "lucide-react";

export default function OAObservabilityPanel() {
  const [period, setPeriod] = useState<"hoje" | "semana">("hoje");

  const periodStart = (() => {
    const d = new Date();
    if (period === "hoje") { d.setHours(0, 0, 0, 0); }
    else { d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); }
    return d.toISOString();
  })();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["oa-observability", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oa_events")
        .select("event_type, user_id, metadata, created_at")
        .gte("created_at", periodStart)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as Array<{ event_type: string; user_id: string; metadata: any; created_at: string }>;
    },
    staleTime: 30_000,
  });

  // Aggregate metrics
  const served = events.filter(e => e.event_type === "lead_served").length;
  const finished = events.filter(e => e.event_type === "call_finished").length;
  const discarded = events.filter(e => e.event_type === "lead_discarded").length;
  const expired = events.filter(e => e.event_type === "lock_expired").length;
  const skipped = events.filter(e => e.event_type === "lead_skipped").length;

  // Repetition
  const servedPairs = events
    .filter(e => e.event_type === "lead_served")
    .map(e => `${e.user_id}_${(e as any).lead_id}`);
  const uniqueServed = new Set(servedPairs).size;
  const repeatRate = servedPairs.length > 0 ? Math.round(((servedPairs.length - uniqueServed) / servedPairs.length) * 100) : 0;

  // Funnel conversion
  const funnelRate = served > 0 ? Math.round((finished / served) * 100) : 0;

  // Results breakdown
  const results = events
    .filter(e => e.event_type === "call_finished")
    .reduce((acc, e) => {
      const r = e.metadata?.resultado || "outro";
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const uniqueCorretores = new Set(events.filter(e => e.event_type === "lead_served").map(e => e.user_id)).size;

  // Critical thresholds
  const isRepeatCritical = repeatRate > 70;
  const isRepeatWarning = repeatRate > 15;
  const isLocksCritical = expired > 5;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Observabilidade — Oferta Ativa
        </h2>
        <div className="flex gap-1">
          <Badge
            variant={period === "hoje" ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setPeriod("hoje")}
          >
            Hoje
          </Badge>
          <Badge
            variant={period === "semana" ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setPeriod("semana")}
          >
            7 dias
          </Badge>
        </div>
      </div>

      {/* Critical Alerts */}
      {(isRepeatCritical || isLocksCritical) && (
        <div className="space-y-3">
          {isRepeatCritical && (
            <Card className="border-red-500/40 bg-red-500/10 shadow-lg shadow-red-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-red-500/20 shrink-0 mt-0.5">
                    <ShieldAlert className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                      🔴 Taxa de Repetição Crítica — {repeatRate}%
                    </h3>
                    <p className="text-xs text-red-300/80 mt-1 leading-relaxed">
                      Taxa de repetição alta indica que os mesmos leads estão sendo chamados várias vezes sem evolução. 
                      Revisar a lista de leads e considerar importar novos contatos ou ajustar filtros de cooldown.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isLocksCritical && (
            <Card className="border-red-500/40 bg-red-500/10 shadow-lg shadow-red-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-red-500/20 shrink-0 mt-0.5">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                      🔴 {expired} Locks Expirados
                    </h3>
                    <p className="text-xs text-red-300/80 mt-1 leading-relaxed">
                      Corretores saíram da tela de chamada sem finalizar o atendimento. Leads ficaram travados até o lock expirar. 
                      Verificar na aba Live quais corretores estão com comportamento irregular.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{served}</p>
            <p className="text-[10px] text-muted-foreground">Leads Servidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{finished}</p>
            <p className="text-[10px] text-muted-foreground">Finalizados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{funnelRate}%</p>
            <p className="text-[10px] text-muted-foreground">Taxa Conclusão</p>
          </CardContent>
        </Card>
        <Card className={isRepeatCritical ? "border-red-500/30" : isRepeatWarning ? "border-amber-500/30" : ""}>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${isRepeatCritical ? "text-red-500" : isRepeatWarning ? "text-amber-500" : "text-emerald-600"}`}>{repeatRate}%</p>
            <p className="text-[10px] text-muted-foreground">Repetição</p>
          </CardContent>
        </Card>
        <Card className={isLocksCritical ? "border-red-500/30" : ""}>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${isLocksCritical ? "text-red-500" : expired > 0 ? "text-amber-500" : "text-foreground"}`}>{expired}</p>
            <p className="text-[10px] text-muted-foreground">Locks Expirados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{uniqueCorretores}</p>
            <p className="text-[10px] text-muted-foreground">Corretores Ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Results Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Funil de Resultados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(results).map(([key, count]) => (
              <div key={key} className="p-2 rounded-lg bg-muted/50 border border-border text-center">
                <p className="text-lg font-bold text-foreground">{count}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>
          {Object.keys(results).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período</p>
          )}
        </CardContent>
      </Card>

      {/* Non-critical warnings */}
      {(!isRepeatCritical && !isLocksCritical) && (expired > 0 || isRepeatWarning || skipped > 50) && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-amber-700 flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" /> Alertas
            </h3>
            <div className="space-y-1 text-xs text-amber-800">
              {expired > 0 && !isLocksCritical && <p>⚠️ {expired} locks expiraram — corretores podem estar travando/saindo sem finalizar.</p>}
              {isRepeatWarning && <p>⚠️ Taxa de repetição em {repeatRate}% — verificar distribuição de leads.</p>}
              {skipped > 50 && <p>⚠️ {skipped} leads pulados — verificar se corretores estão selecionando demais.</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
