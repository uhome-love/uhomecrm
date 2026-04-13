/**
 * useCorretorHomeData — Data for the unified Corretor Home
 * 
 * Fetches:
 * - Follow-ups pendentes (leads with data_proxima_acao = today or overdue)
 * - Visitas do dia (from visitas table)
 * - Mini funil pessoal (lead distribution by stage)
 * - Evolução semanal (last 7 days performance)
 * - Negócios sem ação (PDN entries without proxima_acao)
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, differenceInDays } from "date-fns";

export interface FollowUpLead {
  id: string;
  nome: string;
  telefone: string | null;
  empreendimento: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  temperatura: string;
  stage_nome: string;
  dias_atrasado: number;
}

export interface VisitaHoje {
  id: string;
  nome_cliente: string;
  empreendimento: string | null;
  hora_visita: string | null;
  status: string;
  telefone: string | null;
}

export interface FunilItem {
  stage_id: string;
  stage_nome: string;
  stage_cor: string;
  count: number;
  ordem: number;
}

export interface DiaPerformance {
  data: string;
  tentativas: number;
  aproveitados: number;
  pontos: number;
  visitas: number;
}

export function useCorretorHomeData() {
  const { user } = useAuth();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  // Follow-ups pendentes
  const { data: followUps = [], isLoading: followUpsLoading } = useQuery({
    queryKey: ["corretor-followups", user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_leads")
        .select(`
          id, nome, telefone, empreendimento, temperatura,
          proxima_acao, data_proxima_acao,
          pipeline_stages!inner(nome)
        `)
        .eq("corretor_id", user!.id)
        .not("data_proxima_acao", "is", null)
        .lte("data_proxima_acao", today)
        .order("data_proxima_acao", { ascending: true })
        .limit(20);

      if (error) throw error;
      return (data || []).map((l: any) => ({
        id: l.id,
        nome: l.nome,
        telefone: l.telefone,
        empreendimento: l.empreendimento,
        proxima_acao: l.proxima_acao,
        data_proxima_acao: l.data_proxima_acao,
        temperatura: l.temperatura || "morno",
        stage_nome: l.pipeline_stages?.nome || "—",
        dias_atrasado: differenceInDays(new Date(), new Date(l.data_proxima_acao + "T12:00:00")),
      })) as FollowUpLead[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Visitas do dia
  const { data: visitasHoje = [], isLoading: visitasLoading } = useQuery({
    queryKey: ["corretor-visitas-hoje", user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas")
        .select("id, nome_cliente, empreendimento, hora_visita, status, telefone")
        .eq("corretor_id", user!.id)
        .eq("data_visita", today)
        .in("status", ["marcada", "confirmada", "realizada", "reagendada"])
        .order("hora_visita", { ascending: true });

      if (error) throw error;
      return (data || []) as VisitaHoje[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Mini funil pessoal
  const { data: funil = [], isLoading: funilLoading } = useQuery({
    queryKey: ["corretor-funil", user?.id],
    queryFn: async () => {
      // Get stages
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, nome, cor, ordem, tipo")
        .eq("ativo", true)
        .order("ordem");

      // Get lead counts by stage — only active leads (not archived)
      const { data: leads } = await supabase
        .from("pipeline_leads")
        .select("stage_id")
        .eq("corretor_id", user!.id)
        .eq("arquivado", false);

      if (!stages || !leads) return [];

      const countMap: Record<string, number> = {};
      leads.forEach(l => { countMap[l.stage_id] = (countMap[l.stage_id] || 0) + 1; });

      return stages
        .filter(s => countMap[s.id])
        .map(s => ({
          stage_id: s.id,
          stage_nome: s.nome,
          stage_cor: s.cor,
          count: countMap[s.id] || 0,
          ordem: s.ordem,
        })) as FunilItem[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Evolução semanal (últimos 7 dias)
  const { data: evolucao = [], isLoading: evolucaoLoading } = useQuery({
    queryKey: ["corretor-evolucao-semanal", user?.id],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7);
      
      // Tentativas
      const { data: tentativas } = await supabase
        .from("oferta_ativa_tentativas")
        .select("created_at, resultado, pontos")
        .eq("corretor_id", user!.id)
        .gte("created_at", sevenDaysAgo.toISOString());

      // Visitas
      const { data: visitas } = await supabase
        .from("visitas")
        .select("created_at, status")
        .eq("corretor_id", user!.id)
        .gte("created_at", sevenDaysAgo.toISOString());

      const dayMap: Record<string, DiaPerformance> = {};
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        dayMap[d] = { data: d, tentativas: 0, aproveitados: 0, pontos: 0, visitas: 0 };
      }

      (tentativas || []).forEach(t => {
        const d = new Date(t.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        if (dayMap[d]) {
          dayMap[d].tentativas++;
          dayMap[d].pontos += t.pontos;
          if (t.resultado === "com_interesse") dayMap[d].aproveitados++;
        }
      });

      (visitas || []).forEach(v => {
        const d = new Date(v.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        if (dayMap[d] && ["marcada", "confirmada", "realizada"].includes(v.status)) {
          dayMap[d].visitas++;
        }
      });

      return Object.values(dayMap);
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Exclude descarte and convertido from total leads count
  const totalLeads = funil
    .filter(f => !["Descarte", "Negócio Criado"].includes(f.stage_nome))
    .reduce((sum, f) => sum + f.count, 0);

  return {
    followUps,
    followUpsLoading,
    visitasHoje,
    visitasLoading,
    funil,
    funilLoading,
    totalLeads,
    evolucao,
    evolucaoLoading,
  };
}
