/**
 * useLeadMatch — manages the lead-property match flow on /imoveis.
 *
 * State: selected lead, matched imovel codes, save flow.
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MatchedLead {
  id: string;
  nome: string;
  telefone: string | null;
  etapa: string | null;
  valor_min?: number | null;
  valor_max?: number | null;
  bairro_regiao?: string | null;
  dormitorios?: number | null;
}

export function useLeadMatch() {
  const { user } = useAuth();
  const [matchedLead, setMatchedLead] = useState<MatchedLead | null>(null);
  const [matchedCodigos, setMatchedCodigos] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const selectLead = useCallback((lead: MatchedLead) => {
    setMatchedLead(lead);
    setMatchedCodigos(new Set());
  }, []);

  const clearMatch = useCallback(() => {
    setMatchedLead(null);
    setMatchedCodigos(new Set());
  }, []);

  const toggleImovel = useCallback((codigo: string) => {
    setMatchedCodigos(prev => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  }, []);

  const saveIndicacoes = useCallback(async (observacao?: string) => {
    if (!matchedLead || !user?.id || matchedCodigos.size === 0) return false;
    setSaving(true);
    try {
      const rows = Array.from(matchedCodigos).map(codigo => ({
        lead_id: matchedLead.id,
        imovel_codigo: codigo,
        observacao: observacao || null,
        criado_por: user.id,
      }));

      const { error } = await supabase
        .from("lead_imoveis_indicados" as any)
        .insert(rows);

      if (error) throw error;
      toast.success(`${matchedCodigos.size} imóve${matchedCodigos.size === 1 ? "l salvo" : "is salvos"} para ${matchedLead.nome}`);
      clearMatch();
      return true;
    } catch (err: any) {
      console.error("Erro ao salvar indicações:", err);
      toast.error("Erro ao salvar indicações");
      return false;
    } finally {
      setSaving(false);
    }
  }, [matchedLead, matchedCodigos, user?.id, clearMatch]);

  return {
    matchedLead,
    matchedCodigos,
    selectLead,
    clearMatch,
    toggleImovel,
    saveIndicacoes,
    saving,
    hasMatch: !!matchedLead,
  };
}
