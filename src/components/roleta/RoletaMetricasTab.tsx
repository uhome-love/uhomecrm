import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Clock, Users, AlertTriangle, CheckCircle2, XCircle, Timer } from "lucide-react";
import { todayBRT } from "@/lib/utils";

interface MetricasData {
  distribuidos_hoje: number;
  distribuidos_manha: number;
  distribuidos_tarde: number;
  distribuidos_noturna: number;
  fila_ceo: number;
  aguardando_aceite: number;
  timeouts_hoje: number;
  rejeitados_hoje: number;
  aceitos_hoje: number;
  corretores_ativos: number;
  leads_por_corretor: { nome: string; leads: number; aceitos: number; rejeitados: number; }[];
}

export default function RoletaMetricasTab() {
  const [data, setData] = useState<MetricasData | null>(null);
  const [loading, setLoading] = useState(true);
  const hoje = todayBRT();

  useEffect(() => {
    loadMetricas();
  }, []);

  async function loadMetricas() {
    setLoading(true);
    try {
      const todayStart = `${hoje}T00:00:00-03:00`;
      const todayEnd = `${hoje}T23:59:59-03:00`;

      // Parallel queries
      const [distRes, filaRes, aguardandoRes, histRes, filaAtiva] = await Promise.all([
        // Distributed today
        supabase.from("distribuicao_historico")
          .select("corretor_id, acao, created_at")
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd),
        // CEO queue
        supabase.from("pipeline_leads")
          .select("id", { count: "exact", head: true })
          .eq("aceite_status", "pendente_distribuicao")
          .is("corretor_id", null),
        // Waiting acceptance
        supabase.from("pipeline_leads")
          .select("id", { count: "exact", head: true })
          .eq("aceite_status", "aguardando_aceite"),
        // History for acceptance metrics
        supabase.from("distribuicao_historico")
          .select("corretor_id, acao")
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd),
        // Active brokers
        supabase.from("roleta_fila")
          .select("corretor_id")
          .eq("data", hoje)
          .eq("ativo", true),
      ]);

      const allHist = histRes.data || [];
      const distribuidos = allHist.filter(h => h.acao === "distribuido");
      const aceitos = allHist.filter(h => h.acao === "aceito");
      const rejeitados = allHist.filter(h => h.acao === "rejeitado");
      const timeouts = allHist.filter(h => h.acao === "timeout" || h.acao === "expirado");

      // Per-corretor breakdown
      const corretorMap = new Map<string, { leads: number; aceitos: number; rejeitados: number }>();
      for (const d of distribuidos) {
        if (!d.corretor_id) continue;
        const entry = corretorMap.get(d.corretor_id) || { leads: 0, aceitos: 0, rejeitados: 0 };
        entry.leads++;
        corretorMap.set(d.corretor_id, entry);
      }
      for (const a of aceitos) {
        if (!a.corretor_id) continue;
        const entry = corretorMap.get(a.corretor_id) || { leads: 0, aceitos: 0, rejeitados: 0 };
        entry.aceitos++;
        corretorMap.set(a.corretor_id, entry);
      }
      for (const r of rejeitados) {
        if (!r.corretor_id) continue;
        const entry = corretorMap.get(r.corretor_id) || { leads: 0, aceitos: 0, rejeitados: 0 };
        entry.rejeitados++;
        corretorMap.set(r.corretor_id, entry);
      }

      // Get broker names
      const ids = [...corretorMap.keys()];
      const { data: profiles } = ids.length > 0
        ? await supabase.from("profiles").select("user_id, nome").in("user_id", ids)
        : { data: [] };
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.nome]));

      const leadsPorCorretor = [...corretorMap.entries()].map(([uid, stats]) => ({
        nome: (nameMap.get(uid) as string) || "Corretor",
        ...stats,
      })).sort((a, b) => b.leads - a.leads);

      const uniqueCorretores = new Set((filaAtiva.data || []).map(f => f.corretor_id));

      setData({
        distribuidos_hoje: distribuidos.length,
        distribuidos_manha: 0, // simplified
        distribuidos_tarde: 0,
        distribuidos_noturna: 0,
        fila_ceo: filaRes.count || 0,
        aguardando_aceite: aguardandoRes.count || 0,
        timeouts_hoje: timeouts.length,
        rejeitados_hoje: rejeitados.length,
        aceitos_hoje: aceitos.length,
        corretores_ativos: uniqueCorretores.size,
        leads_por_corretor: leadsPorCorretor,
      });
    } catch (err) {
      console.error("Erro ao carregar métricas:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!data) return <p className="text-center text-muted-foreground py-8">Erro ao carregar métricas</p>;

  const taxaAceite = data.distribuidos_hoje > 0
    ? Math.round((data.aceitos_hoje / data.distribuidos_hoje) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{data.distribuidos_hoje}</p>
            <p className="text-xs text-muted-foreground">Distribuídos hoje</p>
          </CardContent>
        </Card>
        <Card className="border-amber-300/50">
          <CardContent className="pt-4 pb-3 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold text-amber-600">{data.fila_ceo}</p>
            <p className="text-xs text-muted-foreground">Fila CEO</p>
          </CardContent>
        </Card>
        <Card className="border-blue-300/50">
          <CardContent className="pt-4 pb-3 text-center">
            <Timer className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold text-blue-600">{data.aguardando_aceite}</p>
            <p className="text-xs text-muted-foreground">Aguardando aceite</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{data.corretores_ativos}</p>
            <p className="text-xs text-muted-foreground">Corretores ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Acceptance stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
            <p className="text-xl font-bold text-emerald-600">{data.aceitos_hoje}</p>
            <p className="text-xs text-muted-foreground">Aceitos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <XCircle className="h-4 w-4 mx-auto text-destructive mb-1" />
            <p className="text-xl font-bold text-destructive">{data.rejeitados_hoje + data.timeouts_hoje}</p>
            <p className="text-xs text-muted-foreground">Rejeitados/Timeout</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{taxaAceite}%</p>
            <p className="text-xs text-muted-foreground">Taxa de aceite</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-broker table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Leads por Corretor (hoje)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.leads_por_corretor.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead distribuído hoje</p>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-4 text-xs text-muted-foreground font-medium px-2 pb-1 border-b">
                <span>Corretor</span>
                <span className="text-center">Recebidos</span>
                <span className="text-center">Aceitos</span>
                <span className="text-center">Rejeitados</span>
              </div>
              {data.leads_por_corretor.map((c, i) => (
                <div key={i} className="grid grid-cols-4 text-sm px-2 py-1.5 rounded hover:bg-muted/50">
                  <span className="font-medium truncate">{c.nome}</span>
                  <span className="text-center">{c.leads}</span>
                  <span className="text-center text-emerald-600">{c.aceitos}</span>
                  <span className="text-center text-destructive">{c.rejeitados}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
