/**
 * _shared/reactivateLead.ts — helper compartilhado para reativar leads da Oferta Ativa.
 *
 * Faz dedup por telefone_normalizado e, se disponível, reativa o lead para o pipeline
 * do corretor logado, atualizando stage, aceite_status, limpando descarte e
 * registrando atividade em pipeline_atividades.
 *
 * Uma fonte de verdade só — usada tanto pelo registrar-resultado quanto pelo
 * histórico-reaproveitar.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const NOVO_LEAD_STAGE_ID = "d3843b2f-2fa1-4c31-9129-4eb0ed21f019";
export const VISITA_STAGE_ID = "a857139f-c419-4e37-ae17-5f5e70b21172";
export const DESCARTE_STAGE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";

export interface CheckAvailabilityResult {
  disponivel: boolean;
  duplicate_lead_id: string | null;
}

/** Retorna disponivel=false quando existe outro lead ATIVO (não arquivado, fora do descarte) com o mesmo telefone. */
export async function checkLeadAvailability(
  admin: SupabaseClient,
  pipeline_lead_id: string,
): Promise<CheckAvailabilityResult> {
  const { data: leadRow } = await admin
    .from("pipeline_leads")
    .select("id, telefone_normalizado")
    .eq("id", pipeline_lead_id)
    .maybeSingle();
  const phone = leadRow?.telefone_normalizado ?? null;
  if (!phone) return { disponivel: true, duplicate_lead_id: null };

  const { data: dupRows } = await admin
    .from("pipeline_leads")
    .select("id")
    .eq("telefone_normalizado", phone)
    .neq("id", pipeline_lead_id)
    .neq("stage_id", DESCARTE_STAGE_ID)
    .eq("arquivado", false)
    .neq("aceite_status", "descartado")
    .limit(1);

  if (dupRows && dupRows.length > 0) {
    return { disponivel: false, duplicate_lead_id: dupRows[0].id };
  }
  return { disponivel: true, duplicate_lead_id: null };
}

export interface ReactivateOptions {
  pipeline_lead_id: string;
  corretor_profile_id: string;
  target_stage_id?: string; // default NOVO_LEAD_STAGE_ID
}

export interface ReactivateResult {
  ok: boolean;
  duplicate_lead_id?: string;
  error?: string;
}

/**
 * Reativa o lead para o pipeline do corretor logado.
 * - arquivado = false
 * - aceite_status = 'aceito'
 * - corretor_id = profile.id do corretor
 * - zera motivo_descarte / tipo_descarte / reengajamento_status
 * - stage_id = target (default Novo Lead)
 * - atualiza stage_changed_at
 * - insere atividade "Reaproveitado — Oferta Ativa / Lista Inteligente de Descartados"
 */
export async function reactivateLead(
  admin: SupabaseClient,
  opts: ReactivateOptions,
): Promise<ReactivateResult> {
  const { pipeline_lead_id, corretor_profile_id } = opts;
  const targetStage = opts.target_stage_id ?? NOVO_LEAD_STAGE_ID;

  const dedup = await checkLeadAvailability(admin, pipeline_lead_id);
  if (!dedup.disponivel) {
    return { ok: false, duplicate_lead_id: dedup.duplicate_lead_id ?? undefined };
  }

  const { error: upErr } = await admin
    .from("pipeline_leads")
    .update({
      arquivado: false,
      aceite_status: "aceito",
      corretor_id: corretor_profile_id,
      motivo_descarte: null,
      tipo_descarte: null,
      reengajamento_status: null,
      stage_id: targetStage,
      stage_changed_at: new Date().toISOString(),
    })
    .eq("id", pipeline_lead_id);
  if (upErr) return { ok: false, error: upErr.message };

  await admin.from("pipeline_atividades").insert({
    pipeline_lead_id,
    corretor_id: corretor_profile_id,
    tipo: "ligacao",
    descricao: "Reaproveitado — Oferta Ativa / Lista Inteligente de Descartados",
  });

  return { ok: true };
}
