// =============================================================================
// Hook unificado de elegibilidade da roleta.
// Fonte única de verdade usada por StatusElegibilidadeRoleta e OportunidadesDoDia.
// =============================================================================

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface LeadDesatualizado {
  id: string;
  nome: string;
  stage: string;
  dias_sem_tarefa: number;
}

export interface ElegibilidadeRoleta {
  pode_roleta_manha: boolean;
  pode_roleta_tarde: boolean;
  pode_roleta_noturna: boolean;
  leads_desatualizados: number;
  limite_bloqueio: number;
  faltam_para_bloquear: number;
  tem_visita_hoje: boolean;
  leads_para_atualizar: LeadDesatualizado[];
}

export function useElegibilidadeRoleta() {
  const { user } = useAuth();
  const [elegibilidade, setElegibilidade] = useState<ElegibilidadeRoleta | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setCarregando(true);
    try {
      const { data, error } = await supabase.rpc("get_elegibilidade_roleta", {
        p_corretor_id: user.id,
      });
      if (error) throw error;
      setElegibilidade(data as ElegibilidadeRoleta);
    } catch (err) {
      console.error("[useElegibilidadeRoleta] Erro:", err);
    } finally {
      setCarregando(false);
    }
  }, [user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const podeFazerRoleta = elegibilidade
    ? elegibilidade.pode_roleta_manha
    : true;

  const leadsDesatualizados = elegibilidade?.leads_desatualizados ?? 0;

  return {
    elegibilidade,
    carregando,
    recarregar: carregar,
    podeFazerRoleta,
    leadsDesatualizados,
  };
}
