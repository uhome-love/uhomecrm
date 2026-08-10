import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * useCarteiraSaude — % da carteira em dia + distribuição por SAÚDE (toque real),
 * via rpc_carteira_saude (role-scoped: corretor=ele, gestor=equipe, admin=empresa).
 */
export interface CarteiraSaude {
  total: number;
  ativos: number; // exclui estagnado
  em_dia: number;
  atencao: number;
  desatualizado: number;
  estagnado: number;
  pct_em_dia: number;
}

const ZERO: CarteiraSaude = { total: 0, ativos: 0, em_dia: 0, atencao: 0, desatualizado: 0, estagnado: 0, pct_em_dia: 0 };

export function useCarteiraSaude(params?: { gerenteId?: string | null; userId?: string | null }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["carteira-saude", params?.gerenteId ?? null, params?.userId ?? null, user?.id],
    enabled: !!user,
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    queryFn: async (): Promise<CarteiraSaude> => {
      const { data, error } = await supabase.rpc("rpc_carteira_saude" as never, {
        p_gerente_id: params?.gerenteId ?? null,
        p_user_id: params?.userId ?? null,
      } as never);
      if (error) throw error;
      const d = (data as unknown as Record<string, unknown>) || {};
      return {
        total: Number(d.total) || 0,
        ativos: Number(d.ativos) || 0,
        em_dia: Number(d.em_dia) || 0,
        atencao: Number(d.atencao) || 0,
        desatualizado: Number(d.desatualizado) || 0,
        estagnado: Number(d.estagnado) || 0,
        pct_em_dia: Number(d.pct_em_dia) || 0,
      };
    },
    placeholderData: ZERO,
  });
}
