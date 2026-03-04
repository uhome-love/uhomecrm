import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
}

export function useCorretorDailyStats() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["corretor-daily-stats", user?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

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

      return s;
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  return {
    stats: stats || {
      ligacoes: 0, whatsapps: 0, emails: 0,
      aproveitados: 0, sem_interesse: 0, numero_errado: 0,
      tentativas: 0, pontos: 0, taxa_aproveitamento: 0,
    },
    isLoading,
  };
}

export function useCorretorDailyGoals() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

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
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const saveGoals = async (metaLigacoes: number, metaAproveitados: number, observacao?: string) => {
    if (!user) return;
    const payload = {
      corretor_id: user.id,
      data: today,
      meta_ligacoes: metaLigacoes,
      meta_aproveitados: metaAproveitados,
      observacao: observacao || null,
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

  return { goals, isLoading, saveGoals };
}

export function useDailyMotivation() {
  const today = new Date().toISOString().slice(0, 10);

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

      // Use deterministic fallback based on day
      const dayOfYear = Math.floor(
        (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
      );
      return MOTIVATIONS[dayOfYear % MOTIVATIONS.length];
    },
    staleTime: 5 * 60_000,
  });

  return motivation || MOTIVATIONS[0];
}
