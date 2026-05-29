/**
 * useEquipesView — Visão executiva "Equipes" do Pipeline (CEO/Admin).
 *
 * Backed pela RPC `get_pipeline_equipes_overview()` (SECURITY DEFINER, admin-only).
 * Retorna um JSON aninhado em 3 níveis: escritório (global) → gestores → corretores.
 *
 * VGV: a RPC entrega DOIS valores monetários por nível —
 *  - vgv_assinado_mes  → base da meta (compara com meta_vgv de ceo_metas_mensais)
 *  - vgv_pipeline_ativo → SUM(negocios status='ativo'), número secundário
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export interface EquipesCorretor {
  auth_id: string;
  profile_id: string | null;
  nome: string | null;
  leads_ativos: number;
  atrasados: number;
  negocios: number;
  ultima_atividade: string | null;
}

export interface EquipesGestor {
  auth_id: string;
  profile_id: string | null;
  nome: string | null;
  avatar_url: string | null;
  qtd_corretores: number;
  total_leads: number;
  atrasados: number;
  negocios: number;
  vgv_assinado_mes: number;
  vgv_pipeline_ativo: number;
  meta_vgv: number | null;
  meta_pct: number | null;
  corretores: EquipesCorretor[];
}

export interface EquipesEscritorio {
  total_leads_ativos: number;
  atrasados: number;
  negocios: number;
  vgv_assinado_mes: number;
  vgv_pipeline_ativo: number;
}

export interface EquipesOverview {
  escritorio: EquipesEscritorio;
  gestores: EquipesGestor[];
}

export function useEquipesView() {
  const { isAdmin } = useUserRole();

  return useQuery({
    queryKey: ["pipeline", "equipes-overview"],
    queryFn: async (): Promise<EquipesOverview> => {
      const { data, error } = await supabase.rpc("get_pipeline_equipes_overview");
      if (error) throw error;
      return (data as unknown as EquipesOverview) ?? { escritorio: {
        total_leads_ativos: 0, atrasados: 0, negocios: 0, vgv_assinado_mes: 0, vgv_pipeline_ativo: 0,
      }, gestores: [] };
    },
    enabled: isAdmin,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}
