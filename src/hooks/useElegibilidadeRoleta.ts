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
  pode_domingo: boolean;
  visitas_semana: number;
  visitas_min_domingo: number;
  leads_desatualizados: number;
  limite_bloqueio: number;
  faltam_para_bloquear: number;
  tem_visita_hoje: boolean;
  leads_para_atualizar: LeadDesatualizado[];
  descartes_mes: number;
  bloqueado_descarte: boolean;
  limite_descartes: number;
  // Presença (novo)
  presente_manha_hoje?: boolean;
  presente_tarde_hoje?: boolean;
  presencas_semana?: number;
  presencas_minimas_domingo?: number;
  noturna_exige_manha_tarde?: boolean;
}

export function useElegibilidadeRoleta() {
  const { user } = useAuth();
  const [elegibilidade, setElegibilidade] = useState<ElegibilidadeRoleta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setCarregando(true);
    setErro(null);
    let lastErr: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await supabase.rpc("get_elegibilidade_roleta", {
          p_corretor_id: user.id,
        });
        if (error) throw error;
        setElegibilidade(data as ElegibilidadeRoleta);
        setCarregando(false);
        return;
      } catch (err: any) {
        lastErr = err;
        console.error("[useElegibilidadeRoleta] tentativa", attempt + 1, err);
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    setErro(lastErr?.message || "Não foi possível verificar elegibilidade");
    setCarregando(false);
  }, [user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const podeFazerRoleta = elegibilidade
    ? (() => {
        const now = new Date();
        const mins = now.getHours() * 60 + now.getMinutes();
        if (mins >= 18 * 60 + 30) return elegibilidade.pode_roleta_noturna;
        if (mins >= 13 * 60 + 30) return elegibilidade.pode_roleta_tarde;
        return elegibilidade.pode_roleta_manha;
      })()
    : true;

  const leadsDesatualizados = elegibilidade?.leads_desatualizados ?? 0;

  return {
    elegibilidade,
    carregando,
    erro,
    recarregar: carregar,
    podeFazerRoleta,
    leadsDesatualizados,
  };
}
