/**
 * useCorretorIds — Hook canônico para resolver IDs do usuário logado.
 *
 * Algumas tabelas usam auth.users.id em corretor_id; outras usam profiles.id.
 * Ver mapa completo em mem://arquitetura/database/id-mapping-logic.
 *
 * Use authId para: pipeline_leads, oferta_ativa_*, corretor_daily_goals,
 *   custom_lists, coaching_sessions, comunicacao_historico, roleta_desbloqueios,
 *   distribuicao_historico, visitas
 *
 * Use profileId para: negocios, whatsapp_*, roleta_distribuicoes, roleta_fila,
 *   roleta_credenciamentos, academia_*, lead_progressao, pos_vendas
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/customClient";
import { useAuth } from "@/hooks/useAuth";

export interface CorretorIds {
  authId: string | null;
  profileId: string | null;
  isLoading: boolean;
}

export function useCorretorIds(): CorretorIds {
  const { user } = useAuth();
  const authId = user?.id ?? null;

  const { data: profileId, isLoading } = useQuery({
    queryKey: ["corretor-ids", "profile", authId],
    queryFn: async () => {
      if (!authId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", authId)
        .maybeSingle();
      if (error) {
        console.error("[useCorretorIds] erro buscando profile:", error);
        return null;
      }
      return (data?.id as string | undefined) ?? null;
    },
    enabled: !!authId,
    staleTime: 1000 * 60 * 60, // 1h — id de profile não muda
    gcTime: 1000 * 60 * 60 * 4,
  });

  return {
    authId,
    profileId: profileId ?? null,
    isLoading: !!authId && isLoading,
  };
}
