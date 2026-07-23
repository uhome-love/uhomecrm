/**
 * _shared/reactivateLead.ts — helper compartilhado para reativar leads da Oferta Ativa.
 *
 * IMPORTANTE (mapa canônico de IDs):
 * - pipeline_leads.corretor_id / gerente_id  → auth.users.id
 * - oferta_ativa_*.corretor_id               → profiles.id
 *
 * Ver mem://arquitetura/database/id-mapping-logic.
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
  /** auth.users.id do corretor (grava em pipeline_leads.corretor_id) */
  corretor_auth_id: string;
  /** profiles.id do corretor (grava em pipeline_atividades.corretor_id) */
  corretor_profile_id: string;
  target_stage_id?: string; // default NOVO_LEAD_STAGE_ID
}

export interface ReactivateResult {
  ok: boolean;
  duplicate_lead_id?: string;
  error?: string;
  gerente_auth_id?: string | null;
}

/**
 * Reativa o lead para o pipeline do corretor logado.
 * - pipeline_leads.corretor_id = auth.users.id (RLS exige = auth.uid())
 * - pipeline_leads.gerente_id  = auth.users.id do gerente (resolvido via team_members)
 * - arquivado=false, aceite_status='aceito'
 * - zera motivo_descarte / tipo_descarte / reengajamento_status
 * - stage_id = target (default Novo Lead)
 * - registra atividade em pipeline_atividades (usa profiles.id)
 */
export async function reactivateLead(
  admin: SupabaseClient,
  opts: ReactivateOptions,
): Promise<ReactivateResult> {
  const { pipeline_lead_id, corretor_auth_id, corretor_profile_id } = opts;
  const targetStage = opts.target_stage_id ?? NOVO_LEAD_STAGE_ID;

  const dedup = await checkLeadAvailability(admin, pipeline_lead_id);
  if (!dedup.disponivel) {
    return { ok: false, duplicate_lead_id: dedup.duplicate_lead_id ?? undefined };
  }

  // Resolve gerente_id (auth.users.id) via team_members
  let gerenteAuthId: string | null = null;
  const { data: tm } = await admin
    .from("team_members")
    .select("gerente_id")
    .eq("user_id", corretor_auth_id)
    .eq("status", "ativo")
    .limit(1)
    .maybeSingle();
  gerenteAuthId = tm?.gerente_id ?? null;

  const updatePayload: Record<string, unknown> = {
    arquivado: false,
    aceite_status: "aceito",
    corretor_id: corretor_auth_id,
    motivo_descarte: null,
    tipo_descarte: null,
    reengajamento_status: null,
    stage_id: targetStage,
    stage_changed_at: new Date().toISOString(),
  };
  if (gerenteAuthId) updatePayload.gerente_id = gerenteAuthId;

  const { error: upErr } = await admin
    .from("pipeline_leads")
    .update(updatePayload)
    .eq("id", pipeline_lead_id);
  if (upErr) return { ok: false, error: upErr.message };

  // Log da reativação em pipeline_atividades.
  // Schema exige: titulo NOT NULL, status válido, created_by=auth.users.id.
  // Antes essa insert falhava silenciosamente (usava coluna corretor_id inexistente).
  const { error: atvErr } = await admin.from("pipeline_atividades").insert({
    pipeline_lead_id,
    tipo: "ligacao",
    titulo: "Lead reaproveitado — Oferta Ativa",
    descricao: "Reaproveitado — Oferta Ativa / Lista Inteligente de Descartados",
    status: "concluida",
    created_by: corretor_auth_id,
    responsavel_id: corretor_auth_id,
  });
  if (atvErr) console.warn("[reactivateLead] atividade log falhou:", atvErr.message);

  return { ok: true, gerente_auth_id: gerenteAuthId };
}
