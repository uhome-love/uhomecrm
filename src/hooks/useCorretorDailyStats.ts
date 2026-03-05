import { useQuery } from "@tanstack/react-query";
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

  const { data: stats, isLoading } = useQuery({
    queryKey: ["corretor-daily-stats", user?.id],
    queryFn: async () => {
      // Use Brazil timezone (UTC-3) for "today" boundary
      const today = new Date();
      today.setHours(3, 0, 0, 0); // UTC midnight = 03:00 UTC (BRT = UTC-3)
      if (new Date() < today) today.setDate(today.getDate() - 1); // If before 3am UTC, use yesterday's boundary

      const { data, error } = await supabase
        .from("oferta_ativa_tentativas")
        .select("canal, resultado, pontos")
        .eq("corretor_id", user!.id)
        .gte("created_at", today.toISOString());

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

      // Count visitas_marcadas from checkpoint_lines
      try {
        const { data: tm } = await supabase
          .from("team_members")
          .select("id, gerente_id")
          .eq("user_id", user!.id)
          .eq("status", "ativo")
          .maybeSingle();

        if (tm) {
          const { data: cp } = await supabase
            .from("checkpoints")
            .select("id")
            .eq("gerente_id", tm.gerente_id)
            .eq("data", today.toISOString().split("T")[0])
            .maybeSingle();

          if (cp) {
            const { data: line } = await supabase
              .from("checkpoint_lines")
              .select("real_visitas_marcadas")
              .eq("checkpoint_id", cp.id)
              .eq("corretor_id", tm.id)
              .maybeSingle();

            if (line?.real_visitas_marcadas) {
              s.visitas_marcadas = line.real_visitas_marcadas;
            }
          }
        }
      } catch (err) {
        console.error("Erro ao buscar visitas marcadas:", err);
      }

      return s;
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false, // Prevent tab-switch refetch causing UI jumps
  });

  return {
    stats: stats || {
      ligacoes: 0, whatsapps: 0, emails: 0,
      aproveitados: 0, sem_interesse: 0, numero_errado: 0,
      tentativas: 0, pontos: 0, taxa_aproveitamento: 0,
      visitas_marcadas: 0,
    },
    isLoading,
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
  const today = format(new Date(), "yyyy-MM-dd");

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
