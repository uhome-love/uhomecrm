import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";

export interface Missao {
  id: string;
  label: string;
  emoji: string;
  meta: number;
  atual: number;
  pontosPorUnidade: number;
  progresso: number;
  completa: boolean;
}

export interface LeadRadar {
  id: string;
  nome: string;
  telefone: string | null;
  empreendimento: string | null;
  diasSemContato: number;
  temperatura: string;
  stage_nome: string;
}

export interface RankingEntry {
  corretor_id: string;
  corretor_nome: string;
  pontos_total: number;
  novos: number;
  contatos: number;
  qualificados: number;
  possiveis_visitas: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
}

export function useMissoesLeads() {
  const { user } = useAuth();
  const { progress } = useCorretorProgress();

  // Build missions from existing progress data
  const missoes: Missao[] = [
    {
      id: "ligacoes",
      label: "Fazer ligações",
      emoji: "📞",
      meta: progress.metaLigacoes,
      atual: progress.tentativas,
      pontosPorUnidade: 8,
      progresso: progress.progLigacoes,
      completa: progress.missaoCumprida,
    },
    {
      id: "aproveitados",
      label: "Leads responderam",
      emoji: "💬",
      meta: progress.metaAproveitados,
      atual: progress.aproveitados,
      pontosPorUnidade: 15,
      progresso: progress.progAproveitados,
      completa: progress.missaoAproveitados,
    },
    {
      id: "visitas",
      label: "Gerar visitas",
      emoji: "📅",
      meta: progress.metaVisitas,
      atual: progress.visitasMarcadas,
      pontosPorUnidade: 40,
      progresso: progress.progVisitas,
      completa: progress.missaoVisitas,
    },
  ];

  const missaoGeral = Math.round(
    missoes.reduce((sum, m) => sum + m.progresso, 0) / missoes.length
  );

  // Radar: pipeline leads assigned to this corretor needing action
  const { data: radarLeads = [], isLoading: radarLoading } = useQuery({
    queryKey: ["radar-leads-pendentes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_leads")
        .select(`
          id, nome, telefone, empreendimento, temperatura,
          updated_at, data_proxima_acao, stage_id,
          pipeline_stages!inner(nome)
        `)
        .eq("corretor_id", user!.id)
        .not("stage_id", "is", null)
        .order("updated_at", { ascending: true })
        .limit(30);

      if (error) throw error;

      const now = new Date();
      return (data || []).map((l: any) => {
        const lastUpdate = new Date(l.updated_at);
        const diasSemContato = Math.floor(
          (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: l.id,
          nome: l.nome,
          telefone: l.telefone,
          empreendimento: l.empreendimento,
          diasSemContato,
          temperatura: l.temperatura || "morno",
          stage_nome: l.pipeline_stages?.nome || "—",
        } as LeadRadar;
      }).sort((a: LeadRadar, b: LeadRadar) => b.diasSemContato - a.diasSemContato);
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Ranking
  const { data: ranking = [], isLoading: rankingLoading } = useQuery({
    queryKey: ["ranking-pipeline-leads", "dia"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ranking_pipeline_leads", {
        p_periodo: "dia",
      });
      if (error) throw error;
      return (data || []) as RankingEntry[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    missoes,
    missaoGeral,
    progress,
    radarLeads,
    radarLoading,
    ranking,
    rankingLoading,
    userId: user?.id,
  };
}
