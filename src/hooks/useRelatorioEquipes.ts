/**
 * useRelatorioEquipes — consome a RPC get_relatorio_equipes.
 *
 * Retorna os indicadores por corretor (agrupados por equipe), a lista de
 * negócios em andamento e os empreendimentos com melhor resultado, para o
 * período informado. Somente leitura — não altera nada no CRM.
 *
 * Resolução de gestorId:
 *  - admin/diretor → filters.equipe ?? undefined (undefined = todas as equipes)
 *  - gerente       → sempre user.id (própria equipe)
 *  - corretor      → bloqueado pela RPC (forbidden)
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { resolvePeriodo } from "@/hooks/useRelatoriosCentral";
import type { CentralPeriodo } from "@/components/central-v2/useCentralUrlState";

const STALE_MS = 5 * 60 * 1000;
const GC_MS = 15 * 60 * 1000;

export interface CorretorRow {
  gerente_id: string;
  gerente_nome: string;
  nome: string;
  avatar_url: string | null;
  leads_recebidos: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
  pipeline_ativo: number;
  negocios_andamento: number;
  descartes: number;
  estagnados: number;
  vendas_assinadas: number;
  vgv: number;
}

export interface NegocioAndamento {
  equipe: string;
  corretor: string;
  cliente: string;
  empreendimento: string | null;
  valor_estimado: number | null;
  dias_na_etapa: number;
}

export interface TopEmpreendimento {
  empreendimento: string;
  leads: number;
}

export interface RelatorioEquipesData {
  periodo: { start: string; end: string };
  corretores: CorretorRow[];
  negocios_andamento: NegocioAndamento[];
  top_empreendimentos: TopEmpreendimento[];
}

export interface RelatorioEquipesFilters {
  periodo: CentralPeriodo;
  de?: string;
  ate?: string;
  equipe?: string;
}

export function useRelatorioEquipes(filters: RelatorioEquipesFilters) {
  const { user } = useAuth();
  const { isAdmin, isDiretor } = useUserRole();

  const gestorId = useMemo<string | null | undefined>(() => {
    if (!user?.id) return null;
    if (isAdmin || isDiretor) return filters.equipe ?? undefined;
    return user.id;
  }, [user?.id, isAdmin, isDiretor, filters.equipe]);

  const range = useMemo(
    () => resolvePeriodo(filters.periodo, filters.de, filters.ate),
    [filters.periodo, filters.de, filters.ate]
  );

  const query = useQuery<RelatorioEquipesData>({
    enabled: gestorId !== null,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
    queryKey: ["relatorio-equipes", gestorId ?? "ALL", range.start, range.end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_relatorio_equipes", {
        p_gestor_id: gestorId ?? null,
        p_start: range.start,
        p_end: range.end,
      } as never);
      if (error) {
        const msg = String(error.message || "").toLowerCase();
        if (msg.includes("forbidden") || msg.includes("unauthorized")) {
          throw new Error("forbidden");
        }
        throw error;
      }
      return (data as unknown as RelatorioEquipesData) ?? {
        periodo: range,
        corretores: [],
        negocios_andamento: [],
        top_empreendimentos: [],
      };
    },
  });

  return { query, range, gestorId };
}
