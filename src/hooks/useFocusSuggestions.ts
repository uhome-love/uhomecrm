/**
 * useFocusSuggestions — carrega os 3 buckets de sugestão do FocusEmptyState.
 *
 * Retorna IDs (não objetos). O click reabre o Modo Foco via reload({ leadIds })
 * para que o useFocusLeads hidrate com a régua de saúde + ordenação canônica.
 *
 * Prioridade: A > B > C (visita > vence_2d > sem_tarefa). Exclusão centralizada.
 */
import { useEffect, useState, useCallback } from "react";
import {
  fetchLeadIdsSemTarefa,
  fetchLeadIdsVence2d,
  fetchLeadIdsVisitaSemFollowup,
  applyPriorityExclusion,
  type FocusSuggestionBuckets,
} from "@/lib/focusSuggestions";

interface UseFocusSuggestionsReturn {
  buckets: FocusSuggestionBuckets;
  loading: boolean;
  reload: () => Promise<void>;
}

const EMPTY: FocusSuggestionBuckets = { visitaSemFollowup: [], vence2d: [], semTarefa: [] };

export function useFocusSuggestions(
  corretorAuthId: string | null,
  enabled: boolean
): UseFocusSuggestionsReturn {
  const [buckets, setBuckets] = useState<FocusSuggestionBuckets>(EMPTY);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!corretorAuthId) return;
    setLoading(true);
    try {
      const [visitaSemFollowup, vence2d, semTarefa] = await Promise.all([
        fetchLeadIdsVisitaSemFollowup(corretorAuthId),
        fetchLeadIdsVence2d(corretorAuthId),
        fetchLeadIdsSemTarefa(corretorAuthId),
      ]);
      setBuckets(applyPriorityExclusion({ visitaSemFollowup, vence2d, semTarefa }));
    } catch (err) {
      console.error("[useFocusSuggestions] error:", err);
      setBuckets(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [corretorAuthId]);

  useEffect(() => {
    if (enabled && corretorAuthId) {
      void reload();
    }
  }, [enabled, corretorAuthId, reload]);

  return { buckets, loading, reload };
}
