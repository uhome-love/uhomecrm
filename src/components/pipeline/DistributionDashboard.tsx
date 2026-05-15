import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, Users, Clock, CheckCircle2, XCircle, Timer, AlertTriangle } from "lucide-react";

interface PerformanceData {
  totais: {
    distribuidos: number;
    aceitos: number;
    rejeitados: number;
    timeout: number;
    tempo_medio_resposta_seg: number | null;
  };
  por_corretor: {
    corretor_id: string;
    nome: string;
    recebidos: number;
    aceitos: number;
    rejeitados: number;
    timeouts: number;
    tempo_medio: number | null;
  }[];
  por_segmento: {
    segmento_id: string;
    nome: string;
    distribuidos: number;
    aceitos: number;
    tempo_medio: number | null;
  }[];
  leads_pendentes: number;
}

function formatTime(seconds: number | null): string {
  if (seconds == null) return "--";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m${secs > 0 ? ` ${secs}s` : ""}`;
}

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color || "bg-primary/10"}`}>
            <Icon className={`h-5 w-5 ${color ? "text-white" : "text-primary"}`} />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DistributionDashboard() {
  const [periodo, setPeriodo] = useState("hoje");

  const { data: perf, isLoading } = useQuery<PerformanceData>({
    queryKey: ["distribution-performance", periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_distribuicao_performance", { p_periodo: periodo });
      if (error) throw error;
      return data as unknown as PerformanceData;
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!perf) return null;

  const taxaAceite = perf.totais.distribuidos > 0
    ? Math.round((perf.totais.aceitos / perf.totais.distribuidos) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <Tabs value={periodo} onValueChange={setPeriodo}>
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mês</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={TrendingUp} label="Distribuídos" value={perf.totais.distribuidos} />
        <KpiCard icon={CheckCircle2} label="Aceitos" value={perf.totais.aceitos} sub={`${taxaAceite}% taxa`} color="bg-emerald-500" />
        <KpiCard icon={XCircle} label="Rejeitados" value={perf.totais.rejeitados} color="bg-destructive" />
        <KpiCard icon={Timer} label="Timeout" value={perf.totais.timeout} color="bg-amber-500" />
        <KpiCard icon={Clock} label="Tempo Médio" value={formatTime(perf.totais.tempo_medio_resposta_seg)} color="bg-blue-500" />
      </div>

      {perf.leads_pendentes > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">
            {perf.leads_pendentes} leads aguardando distribuição
          </span>
        </div>
      )}

      {/* Ranking por Corretor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Ranking de Velocidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          {perf.por_corretor.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período</p>
          ) : (
            <div className="space-y-1.5">
              {perf.por_corretor.map((c, i) => {
                const taxa = c.recebidos > 0 ? Math.round((c.aceitos / c.recebidos) * 100) : 0;
                return (
                  <div key={c.corretor_id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors">
                    <span className={`text-sm font-bold w-6 text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                      {i + 1}º
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.nome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.aceitos} aceitos · {c.rejeitados} rejeitados · {c.timeouts} timeout
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${
                        c.tempo_medio != null && c.tempo_medio <= 120 ? "text-emerald-600" :
                        c.tempo_medio != null && c.tempo_medio <= 300 ? "text-amber-600" : "text-destructive"
                      }`}>
                        {formatTime(c.tempo_medio)}
                      </p>
                      <Badge variant="outline" className="text-[9px]">{taxa}%</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Por Segmento */}
      {perf.por_segmento.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Performance por Segmento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {perf.por_segmento.map((s) => (
                <div key={s.segmento_id} className="p-3 rounded-lg border bg-card">
                  <p className="text-xs font-medium truncate">{s.nome}</p>
                  <p className="text-lg font-bold mt-1">{s.distribuidos}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.aceitos} aceitos · ⏱ {formatTime(s.tempo_medio)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
