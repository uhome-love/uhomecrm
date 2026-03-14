/**
 * useCheckpointSummary — React hook for the canonical checkpoint data layer
 * 
 * Wraps the get_checkpoint_summary RPC for use in manager and CEO components.
 * Provides both live OA stats and saved checkpoint values with auth_user_id resolution.
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchCheckpointSummary,
  resolveEffectiveMetrics,
  type CheckpointSummaryRow,
} from "@/lib/checkpointService";

interface UseCheckpointSummaryOptions {
  date: string;
  userIds?: string[];
  enabled?: boolean;
}

export interface ResolvedCheckpointRow extends CheckpointSummaryRow {
  /** Effective metrics (live OA if available, else saved) */
  eff_ligacoes: number;
  eff_aproveitados: number;
  eff_visitas_marcadas: number;
  eff_visitas_realizadas: number;
  eff_propostas: number;
}

export function useCheckpointSummary({ date, userIds, enabled = true }: UseCheckpointSummaryOptions) {
  const [rows, setRows] = useState<ResolvedCheckpointRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const raw = await fetchCheckpointSummary(date, userIds);
    const resolved: ResolvedCheckpointRow[] = raw.map(row => {
      const eff = resolveEffectiveMetrics(row);
      return {
        ...row,
        eff_ligacoes: eff.ligacoes,
        eff_aproveitados: eff.aproveitados,
        eff_visitas_marcadas: eff.visitas_marcadas,
        eff_visitas_realizadas: eff.visitas_realizadas,
        eff_propostas: eff.propostas,
      };
    });
    setRows(resolved);
    setLoading(false);
  }, [date, userIds?.join(","), enabled]);

  useEffect(() => { load(); }, [load]);

  const totals = rows.reduce(
    (acc, r) => ({
      ligacoes: acc.ligacoes + r.eff_ligacoes,
      aproveitados: acc.aproveitados + r.eff_aproveitados,
      visitas_marcadas: acc.visitas_marcadas + r.eff_visitas_marcadas,
      visitas_realizadas: acc.visitas_realizadas + r.eff_visitas_realizadas,
      propostas: acc.propostas + r.eff_propostas,
      presentes: acc.presentes + (!["ausente", "atestado", "folga", "nao_informado"].includes(r.presenca) ? 1 : 0),
      total: acc.total + 1,
      meta_ligacoes: acc.meta_ligacoes + r.meta_ligacoes,
      meta_aproveitados: acc.meta_aproveitados + r.meta_aproveitados,
    }),
    { ligacoes: 0, aproveitados: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, presentes: 0, total: 0, meta_ligacoes: 0, meta_aproveitados: 0 }
  );

  return { rows, loading, totals, reload: load };
}
