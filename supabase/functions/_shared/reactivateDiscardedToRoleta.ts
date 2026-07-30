/**
 * _shared/reactivateDiscardedToRoleta.ts
 *
 * Regra: lead que estava em DESCARTE (ou arquivado) e recebe um novo touch de
 * origem externa (Meta, Landing, ImovelWeb, RD Station) volta como NOVO LEAD e
 * entra na roleta — NÃO volta para o corretor que o descartou.
 *
 * Lead ATIVO no pipeline continua com o dono atual (apenas notificação de novo
 * interesse) — esse caminho fica nos receivers.
 *
 * IDs: pipeline_leads.corretor_id / gerente_id → auth.users.id
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { distributeLeadDirect } from "./roleta-distribution.ts";

export const NOVO_LEAD_STAGE_ID = "d3843b2f-2fa1-4c31-9129-4eb0ed21f019";
export const DESCARTE_STAGE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";

export interface ReactivateToRoletaOptions {
  supabaseUrl: string;
  serviceKey: string;
  leadId: string;
  /** auth.users.id do corretor que tinha o lead descartado (será excluído da roleta) */
  corretorAnteriorId: string | null;
  /** Ex.: "Meta Ads", "Landing Page", "ImovelWeb", "RD Station" */
  origemLabel: string;
  /** Empreendimento / interesse demonstrado agora */
  interesseLabel: string;
  /** Observações completas já montadas pelo receiver (opcional) */
  observacoes?: string | null;
  mensagem?: string | null;
  traceId?: string;
  logger?: {
    info?: (msg: string, ctx?: Record<string, unknown>) => void;
    warn?: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => void;
    error?: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => void;
  };
}

export interface ReactivateToRoletaResult {
  ok: boolean;
  error?: string;
  distributed: boolean;
  corretor_id?: string | null;
  reason?: string;
}

export async function reactivateDiscardedToRoleta(
  admin: SupabaseClient,
  opts: ReactivateToRoletaOptions,
): Promise<ReactivateToRoletaResult> {
  const L = opts.logger ?? {};
  const nowIso = new Date().toISOString();
  const todayStamp = nowIso.slice(0, 10);

  const updatePayload: Record<string, unknown> = {
    stage_id: NOVO_LEAD_STAGE_ID,
    stage_changed_at: nowIso,
    arquivado: false,
    aceite_status: "pendente_distribuicao",
    corretor_id: null,
    gerente_id: null,
    motivo_descarte: null,
    tipo_descarte: null,
    reengajamento_status: null,
    updated_at: nowIso,
  };
  if (opts.observacoes !== undefined && opts.observacoes !== null) {
    updatePayload.observacoes = opts.observacoes;
  }

  const { error: upErr } = await admin
    .from("pipeline_leads")
    .update(updatePayload)
    .eq("id", opts.leadId);

  if (upErr) {
    L.error?.("reactivateDiscardedToRoleta: update falhou", { leadId: opts.leadId }, upErr);
    return { ok: false, error: upErr.message, distributed: false };
  }

  // Atividade de histórico (created_by pode ser nulo — lead sem dono agora)
  try {
    await admin.from("pipeline_atividades").insert({
      pipeline_lead_id: opts.leadId,
      tipo: "entrada",
      titulo: `🔄 Lead descartado retornou — enviado para a roleta`,
      descricao:
        `Novo interesse em ${opts.interesseLabel} (${opts.origemLabel}).` +
        `${opts.mensagem ? `\nMensagem: "${opts.mensagem}"` : ""}` +
        `\nLead estava em Descarte/arquivado e voltou como Novo Lead para distribuição na roleta.`,
      data: todayStamp,
      prioridade: "alta",
      status: "completed",
      created_by: opts.corretorAnteriorId,
    });
  } catch (e) {
    L.warn?.("reactivateDiscardedToRoleta: atividade falhou", { leadId: opts.leadId }, e);
  }

  // Exclusividade com Oferta Ativa: lead ativo no pipeline não pode estar na oferta ativa
  try {
    const { data: leadRow } = await admin
      .from("pipeline_leads")
      .select("telefone, telefone_normalizado")
      .eq("id", opts.leadId)
      .maybeSingle();
    const phones = [leadRow?.telefone_normalizado, leadRow?.telefone].filter(Boolean) as string[];
    if (phones.length > 0) {
      await admin.from("oferta_ativa_leads").delete().in("telefone_normalizado", phones);
      await admin.from("oferta_ativa_leads").delete().in("telefone", phones);
    }
  } catch (e) {
    L.warn?.("reactivateDiscardedToRoleta: limpeza oferta ativa falhou", { leadId: opts.leadId }, e);
  }

  // Distribui na roleta excluindo quem descartou
  const dist = await distributeLeadDirect(
    opts.supabaseUrl,
    opts.serviceKey,
    opts.leadId,
    opts.traceId ?? crypto.randomUUID(),
    L,
    2,
    opts.corretorAnteriorId ?? null,
  );

  return {
    ok: true,
    distributed: !!dist.success,
    corretor_id: dist.corretor_id ?? null,
    reason: dist.reason,
  };
}
