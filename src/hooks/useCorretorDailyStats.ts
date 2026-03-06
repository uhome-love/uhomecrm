import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export interface CorretorDailyStats {
  ligacoes: number;
  whatsapps: number;
  emails: number;
  aproveitados: number;
  sem_interesse: number;
  numero_errado: number;
  tentativas: number;
  pontos: number;
  taxa_aproveitamento: number;
  visitas_marcadas: number;
}

export function useCorretorDailyStats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["corretor-daily-stats", user?.id],
    queryFn: async () => {
      // Compute today's BRT boundaries reliably (America/Sao_Paulo = UTC-3)
      // Using Intl to get the actual date in BRT, avoiding DST issues
      const nowUtc = new Date();
      const brtDateStr = nowUtc.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // "YYYY-MM-DD"
      const dayStartUtc = new Date(`${brtDateStr}T00:00:00-03:00`).toISOString();

      const { data, error } = await supabase
        .from("oferta_ativa_tentativas")
        .select("canal, resultado, pontos")
        .eq("corretor_id", user!.id)
        .gte("created_at", dayStartUtc);

      if (error) throw error;

      const s: CorretorDailyStats = {
        ligacoes: 0, whatsapps: 0, emails: 0,
        aproveitados: 0, sem_interesse: 0, numero_errado: 0,
        tentativas: 0, pontos: 0, taxa_aproveitamento: 0,
        visitas_marcadas: 0,
      };

      for (const t of data || []) {
        s.tentativas++;
        s.pontos += t.pontos;
        if (t.canal === "ligacao") s.ligacoes++;
        if (t.canal === "whatsapp") s.whatsapps++;
        if (t.canal === "email") s.emails++;
        if (t.resultado === "com_interesse") s.aproveitados++;
        if (t.resultado === "sem_interesse") s.sem_interesse++;
        if (t.resultado === "numero_errado") s.numero_errado++;
      }

      s.taxa_aproveitamento = s.tentativas > 0
        ? Math.round((s.aproveitados / s.tentativas) * 100)
        : 0;

      // Count visitas_marcadas from BOTH sources:
      // 1) Agenda de Visitas (visitas table) — includes manual + OA-created
      // 2) This is the TRUE source of truth for "visitas marcadas"
      try {
        const { data: visitasData, error: visitasError } = await supabase
          .from("visitas")
          .select("id")
          .eq("corretor_id", user!.id)
          .gte("created_at", dayStartUtc)
          .in("status", ["marcada", "confirmada", "realizada", "reagendada"]);

        if (visitasError) {
          console.error("Erro ao buscar visitas marcadas:", visitasError);
          // Fallback to checkpoint RPC
          const { data: visitasCount } = await supabase
            .rpc("get_corretor_daily_visitas", { p_user_id: user!.id });
          s.visitas_marcadas = Number(visitasCount || 0);
        } else {
          s.visitas_marcadas = visitasData?.length || 0;
        }
      } catch (err) {
        console.error("Erro ao buscar visitas marcadas:", err);
      }

      return s;
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  /**
   * Optimistic update: immediately patch stats cache after a call result.
   * This ensures the UI updates instantly without waiting for refetch.
   */
  const applyOptimisticUpdate = useCallback((resultado: string, canal: string, pontos: number, visitaMarcada: boolean) => {
    queryClient.setQueryData<CorretorDailyStats>(["corretor-daily-stats", user?.id], (old) => {
      if (!old) return old;
      const updated = { ...old };
      updated.tentativas += 1;
      updated.pontos += pontos;
      if (canal === "ligacao") updated.ligacoes += 1;
      if (canal === "whatsapp") updated.whatsapps += 1;
      if (canal === "email") updated.emails += 1;
      if (resultado === "com_interesse") updated.aproveitados += 1;
      if (resultado === "sem_interesse") updated.sem_interesse += 1;
      if (resultado === "numero_errado") updated.numero_errado += 1;
      if (visitaMarcada) updated.visitas_marcadas += 1;
      updated.taxa_aproveitamento = updated.tentativas > 0
        ? Math.round((updated.aproveitados / updated.tentativas) * 100)
        : 0;
      return updated;
    });
    // Also schedule a background refetch to sync with server
    queryClient.invalidateQueries({ queryKey: ["corretor-daily-stats"] });
  }, [queryClient, user?.id]);

  const defaultStats: CorretorDailyStats = {
    ligacoes: 0, whatsapps: 0, emails: 0,
    aproveitados: 0, sem_interesse: 0, numero_errado: 0,
    tentativas: 0, pontos: 0, taxa_aproveitamento: 0,
    visitas_marcadas: 0,
  };

  return {
    stats: stats || defaultStats,
    isLoading,
    applyOptimisticUpdate,
  };
}

export interface CorretorGoals {
  id: string;
  corretor_id: string;
  data: string;
  meta_ligacoes: number;
  meta_aproveitados: number;
  meta_visitas_marcadas: number;
  observacao: string | null;
}

export function useCorretorDailyGoals() {
  const { user } = useAuth();
  // Use BRT date consistently with daily stats
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const { data: goals, isLoading, refetch } = useQuery({
    queryKey: ["corretor-daily-goals", user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corretor_daily_goals")
        .select("*")
        .eq("corretor_id", user!.id)
        .eq("data", today)
        .maybeSingle();
      if (error) throw error;
      return data as CorretorGoals | null;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  const saveGoals = async (metaLigacoes: number, metaAproveitados: number, metaVisitasMarcadas: number, observacao?: string) => {
    if (!user) return;
    const payload = {
      corretor_id: user.id,
      data: today,
      meta_ligacoes: metaLigacoes,
      meta_aproveitados: metaAproveitados,
      meta_visitas_marcadas: metaVisitasMarcadas,
      observacao: observacao || null,
      status: "ativo",
    };

    if (goals) {
      await supabase
        .from("corretor_daily_goals")
        .update(payload)
        .eq("id", goals.id);
    } else {
      await supabase
        .from("corretor_daily_goals")
        .insert(payload);
    }
    refetch();
  };

  return { goals, isLoading, saveGoals, refetch };
}

export function useDailyMotivation() {
  const today = format(new Date(), "yyyy-MM-dd");

  const MOTIVATIONS = [
    "Cada ligação é uma chance de mudar a vida de alguém. Faça valer.",
    "Disciplina supera talento. Ritmo e constância vencem o dia.",
    "O mercado recompensa quem aparece todos os dias. Você está aqui.",
    "Não espere o lead perfeito. Crie a oportunidade perfeita.",
    "Foco total. Uma ligação por vez, um resultado por vez.",
    "Quem liga mais, vende mais. Simples assim.",
    "Hoje é dia de bater meta. Sem desculpas, só execução.",
    "Seu próximo aproveitado está na próxima ligação. Não pare.",
    "Consistência é o que separa bons corretores de grandes corretores.",
    "Meta, ritmo e execução. Essa é a fórmula.",
  ];

  const { data: motivation } = useQuery({
    queryKey: ["daily-motivation", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("corretor_motivations")
        .select("*")
        .eq("data", today)
        .maybeSingle();

      if (data) return data.mensagem;

      const dayOfYear = Math.floor(
        (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
      );
      return MOTIVATIONS[dayOfYear % MOTIVATIONS.length];
    },
    staleTime: 5 * 60_000,
  });

  return motivation || MOTIVATIONS[0];
}
