import { useMemo } from "react";
import { differenceInDays } from "date-fns";

interface LeadWithDate {
  id: string;
  ultima_acao_at?: string;
  updated_at?: string;
  stage_changed_at?: string;
  modulo_atual?: string;
  corretor_id?: string | null;
}

export interface LeadParadoInfo {
  leadId: string;
  diasParado: number;
  severity: "warning" | "danger";
}

/**
 * Calculates stalled leads from a list based on ultima_acao_at.
 * Warning: 3-5 days, Danger: 6+ days.
 */
export function useLeadsParados(leads: LeadWithDate[], userId?: string) {
  const leadsParados = useMemo(() => {
    const now = new Date();
    const result: LeadParadoInfo[] = [];

    for (const lead of leads) {
      // Skip pos_vendas leads
      if ((lead as any).modulo_atual === "pos_vendas") continue;

      // Filter by corretor if userId provided
      if (userId && lead.corretor_id && lead.corretor_id !== userId) continue;

      const refDate = lead.ultima_acao_at || lead.stage_changed_at || lead.updated_at;
      if (!refDate) continue;

      const dias = differenceInDays(now, new Date(refDate));
      if (dias >= 3) {
        result.push({
          leadId: lead.id,
          diasParado: dias,
          severity: dias >= 6 ? "danger" : "warning",
        });
      }
    }

    return result.sort((a, b) => b.diasParado - a.diasParado);
  }, [leads, userId]);

  const paradoMap = useMemo(() => {
    const map = new Map<string, LeadParadoInfo>();
    for (const p of leadsParados) map.set(p.leadId, p);
    return map;
  }, [leadsParados]);

  return {
    leadsParados,
    paradoMap,
    totalWarning: leadsParados.filter(l => l.severity === "warning").length,
    totalDanger: leadsParados.filter(l => l.severity === "danger").length,
  };
}
