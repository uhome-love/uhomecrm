import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Activity, Clock, TrendingUp, MapPin, Users, UserX, AlertTriangle } from "lucide-react";
import { differenceInDays, differenceInMinutes } from "date-fns";

type Nivel = "bom" | "atencao" | "critico";

interface Indicador {
  id: string;
  label: string;
  valor: string;
  nivel: Nivel;
  icon: React.ElementType;
  rota: string;
}

const NIVEL_STYLES: Record<Nivel, { bg: string; border: string; text: string; dot: string }> = {
  bom: { bg: "bg-success/5", border: "border-success/30", text: "text-success", dot: "bg-success" },
  atencao: { bg: "bg-warning/5", border: "border-warning/30", text: "text-warning", dot: "bg-warning" },
  critico: { bg: "bg-destructive/5", border: "border-destructive/30", text: "text-destructive", dot: "bg-destructive" },
};

export default function SaudeOperacao() {
  const navigate = useNavigate();
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // 1. SLA médio — from distribuicao_historico today
    const today = new Date().toISOString().slice(0, 10);
    const { data: dist } = await supabase
      .from("distribuicao_historico")
      .select("tempo_resposta_seg")
      .gte("created_at", `${today}T00:00:00`)
      .not("tempo_resposta_seg", "is", null);

    const tempos = (dist || []).map(d => d.tempo_resposta_seg!).filter(t => t > 0);
    const slaMediaSeg = tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
    const slaMin = Math.round(slaMediaSeg / 60);
    const slaNivel: Nivel = slaMin <= 15 ? "bom" : slaMin <= 30 ? "atencao" : "critico";

    // 2. Taxa de aproveitamento — pipeline_leads aproveitados / total
    const { count: totalLeads } = await supabase.from("pipeline_leads").select("id", { count: "exact", head: true }) as any;
    const { count: aproveitados } = await (supabase.from("pipeline_leads").select("id", { count: "exact", head: true }) as any).in("etapa", ["visita_marcada", "visita_realizada", "proposta", "contrato", "venda"]);
    const taxaAprov = totalLeads && totalLeads > 0 ? Math.round(((aproveitados || 0) / totalLeads) * 100) : 0;
    const aprovNivel: Nivel = taxaAprov > 15 ? "bom" : taxaAprov >= 10 ? "atencao" : "critico";

    // 3. Conversão Lead → Visita
    const { count: visitasMarcadas } = await (supabase.from("pipeline_leads").select("id", { count: "exact", head: true }) as any).in("etapa", ["visita_marcada", "visita_realizada", "proposta", "contrato", "venda"]);
    const convVisita = totalLeads && totalLeads > 0 ? Math.round(((visitasMarcadas || 0) / totalLeads) * 100) : 0;
    const convNivel: Nivel = convVisita > 8 ? "bom" : convVisita >= 4 ? "atencao" : "critico";

    // 4. Negócios parados no PDN (>10 dias sem atualização, exceto assinado/caiu)
    const { data: pdnAtivos } = await supabase
      .from("pdn_entries")
      .select("updated_at, situacao")
      .neq("situacao", "assinado")
      .neq("situacao", "caiu");
    const now = new Date();
    const parados = (pdnAtivos || []).filter(p => differenceInDays(now, new Date(p.updated_at)) > 10).length;
    const paradosNivel: Nivel = parados === 0 ? "bom" : parados <= 3 ? "atencao" : "critico";

    // 5. Presença da equipe — corretor_disponibilidade online hoje
    const { count: totalCorretores } = await supabase.from("team_members").select("id", { count: "exact", head: true }).eq("status", "ativo");
    const { count: presentes } = await supabase.from("corretor_disponibilidade").select("id", { count: "exact", head: true }).eq("status", "online");
    const pctPresenca = totalCorretores && totalCorretores > 0 ? Math.round(((presentes || 0) / totalCorretores) * 100) : 0;
    const presNivel: Nivel = pctPresenca > 90 ? "bom" : pctPresenca >= 70 ? "atencao" : "critico";

    // 6. Leads na fila (sem corretor)
    const { count: naFila } = await (supabase.from("pipeline_leads").select("id", { count: "exact", head: true }) as any).is("corretor_id", null).neq("etapa", "perdido").neq("etapa", "venda");
    const filaNivel: Nivel = (naFila || 0) === 0 ? "bom" : (naFila || 0) <= 5 ? "atencao" : "critico";

    setIndicadores([
      { id: "sla", label: "Velocidade de Atendimento", valor: `SLA médio: ${slaMin}min`, nivel: slaNivel, icon: Clock, rota: "/pipeline" },
      { id: "aprov", label: "Aproveitamento de Leads", valor: `${taxaAprov}% dos leads`, nivel: aprovNivel, icon: TrendingUp, rota: "/pipeline" },
      { id: "conv", label: "Lead → Visita", valor: `${convVisita}% conversão`, nivel: convNivel, icon: MapPin, rota: "/agenda-visitas" },
      { id: "pdn", label: "Negócios Parados (PDN)", valor: `${parados} negócios > 10 dias`, nivel: paradosNivel, icon: Activity, rota: "/pdn" },
      { id: "presenca", label: "Presença da Equipe", valor: `${pctPresenca}% presente (${presentes || 0}/${totalCorretores || 0})`, nivel: presNivel, icon: Users, rota: "/disponibilidade" },
      { id: "fila", label: "Leads sem Corretor", valor: `${naFila || 0} na fila`, nivel: filaNivel, icon: UserX, rota: "/pipeline" },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10 * 60 * 1000); // 10min
    return () => clearInterval(interval);
  }, [load]);

  const criticos = indicadores.filter(i => i.nivel === "critico");

  if (loading) return null;

  return (
    <div className="space-y-3">
      {/* Banner crítico */}
      {criticos.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <p className="text-sm font-medium text-warning">
            ⚠️ {criticos.length} indicador{criticos.length > 1 ? "es" : ""} precisa{criticos.length > 1 ? "m" : ""} de atenção
          </p>
          <button
            onClick={() => document.getElementById("saude-grid")?.scrollIntoView({ behavior: "smooth" })}
            className="ml-auto text-xs font-semibold text-warning underline underline-offset-2"
          >
            Ver detalhes
          </button>
        </div>
      )}

      {/* Grid 3x2 */}
      <div id="saude-grid" className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {indicadores.map(ind => {
          const s = NIVEL_STYLES[ind.nivel];
          return (
            <button
              key={ind.id}
              onClick={() => navigate(ind.rota)}
              className={`rounded-xl border ${s.border} ${s.bg} p-4 text-left transition-all hover:shadow-md ${
                ind.nivel === "critico" ? "animate-pulse-subtle" : ""
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-3 w-3 rounded-full ${s.dot} ${ind.nivel === "critico" ? "animate-pulse" : ""}`} />
                <ind.icon className={`h-4 w-4 ${s.text}`} />
              </div>
              <p className="text-xs font-medium text-muted-foreground">{ind.label}</p>
              <p className={`text-sm font-display font-bold mt-1 ${s.text}`}>{ind.valor}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
