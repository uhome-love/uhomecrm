/**
 * Negocios Relink Service — Onda 0 Etapa 4
 *
 * Religação efetiva entre `negocios` e `pipeline_leads`.
 * Toda mutação de `lead_id` em negócios passa POR AQUI.
 *
 * Regras:
 *  - approve(): seta lead_id = lead_id_proposto, marca método 'aprovado_ceo'
 *  - reject(): zera lead_id_proposto, marca método 'rejeitado'
 *  - manualLink(): permite religar a um lead diferente do proposto
 *  - Tudo soft (sem delete), com timestamp updated_at automático.
 */
import { supabase } from "@/integrations/supabase/client";

export type RelinkMetodo =
  | "A_nome_telefone_corretor"
  | "B_nome_telefone"
  | "C_telefone_corretor"
  | "D_somente_telefone"
  | "manual"
  | "aprovado_ceo"
  | "rejeitado";

export interface RelinkPayload {
  negocioId: string;
  leadId: string; // lead a ser vinculado
}

export const negociosRelinkService = {
  /** Aprova o candidato sugerido: vincula lead_id ao lead_id_proposto */
  async approve(negocioId: string, leadIdProposto: string) {
    const { error } = await supabase
      .from("negocios")
      .update({
        lead_id: leadIdProposto,
        lead_id_match_metodo: "aprovado_ceo",
        lead_id_match_score: 1,
        requer_aprovacao_ceo: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", negocioId);
    if (error) throw error;
  },

  /** Rejeita o candidato: zera proposto, marca como rejeitado (não apaga histórico) */
  async reject(negocioId: string) {
    const { error } = await supabase
      .from("negocios")
      .update({
        lead_id_proposto: null,
        lead_id_match_metodo: "rejeitado",
        lead_id_match_score: null,
        requer_aprovacao_ceo: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", negocioId);
    if (error) throw error;
  },

  /** Religação manual a um lead diferente do proposto */
  async manualLink(negocioId: string, leadId: string) {
    const { error } = await supabase
      .from("negocios")
      .update({
        lead_id: leadId,
        lead_id_proposto: leadId,
        lead_id_match_metodo: "manual",
        lead_id_match_score: 1,
        requer_aprovacao_ceo: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", negocioId);
    if (error) throw error;
  },

  /** Arquiva como "sem lead disponível" — remove da fila sem deletar negócio */
  async archiveNoLead(negocioId: string) {
    const { error } = await supabase
      .from("negocios")
      .update({
        lead_id_match_metodo: "sem_lead",
        lead_id_match_score: null,
        requer_aprovacao_ceo: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", negocioId);
    if (error) throw error;
  },

  /** Apaga negócio de teste — delete físico (uso exclusivo CEO) */
  async deleteAsTest(negocioId: string) {
    const { error } = await supabase.from("negocios").delete().eq("id", negocioId);
    if (error) throw error;
  },
};
