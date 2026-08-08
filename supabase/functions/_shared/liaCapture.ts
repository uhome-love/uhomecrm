/**
 * _shared/liaCapture.ts
 *
 * Desvio de captura da Lia (Casa Tua Canoas) na ENTRADA do lead de campanha.
 * Usado por receive-meta-lead e meta-leads-backfill.
 *
 * Regra: se o campaign_id (ou form_id) do lead casar com ia_config.captura_lia,
 * o lead NÃO segue para pipeline_leads/roleta — vai para a caixa isolada ia_leads.
 * Exceção: o desfecho "dono ativo", em que o lead segue o caminho normal do
 * pipeline E TAMBÉM ganha um card bloqueado em ia_leads (para a campanha da Lia
 * ser mensurável), além de avisar o corretor dono.
 *
 * Quatro desfechos da checagem de telefone:
 *   1. dono_ativo            → card bloqueado + avisa o dono + segue no pipeline
 *   2. opt_out               → card bloqueado, nenhum envio, não vai ao pipeline
 *   3. descartado_liberado   → Lia atende (telefone só em Descarte/Inativo/arquivado)
 *   4. inedito               → Lia atende
 *
 * Nada aqui envia mensagem. Envio depende de ia_config.enviar_habilitado.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const DESCARTE_STAGE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";
export const CAIU_STAGE_ID = "43997e74-aa71-4796-b7d0-11abae2d49ac";

export type ChecagemResultado =
  | "dono_ativo"
  | "opt_out"
  | "descartado_liberado"
  | "inedito";

export interface LiaCaptureInput {
  nome?: string | null;
  email?: string | null;
  /** Telefone já normalizado (só dígitos, sem DDI) */
  telefone: string | null;
  meta_lead_id?: string | null;
  campaign_id?: string | null;
  form_id?: string | null;
  adset_id?: string | null;
  ad_id?: string | null;
  origem?: string;
  payload_bruto?: unknown;
}

export interface LiaCaptureResult {
  /** true = a Lia assumiu; o chamador deve PARAR e não criar lead no pipeline */
  desviar: boolean;
  capturado: boolean;
  resultado?: ChecagemResultado;
  ia_lead_id?: string | null;
  motivo?: string;
  alerta_form_desconhecido?: boolean;
}

interface CapturaConfig {
  campaign_ids: string[];
  form_ids: string[];
}

/** Lê ia_config.captura_lia e decide se este lead pertence à campanha da Lia. */
export async function matchCapturaLia(
  admin: SupabaseClient,
  campaignId: string | null | undefined,
  formId: string | null | undefined,
): Promise<{ match: boolean; alertaFormDesconhecido: boolean }> {
  const { data, error } = await admin
    .from("ia_config")
    .select("captura_lia")
    .limit(1)
    .maybeSingle();

  if (error || !data) return { match: false, alertaFormDesconhecido: false };

  const cfg = (data.captura_lia || {}) as Partial<CapturaConfig>;
  const campaigns = (cfg.campaign_ids || []).map(String);
  const forms = (cfg.form_ids || []).map(String);

  // Listas vazias = captura desligada. Comportamento idêntico ao de hoje.
  if (campaigns.length === 0 && forms.length === 0) {
    return { match: false, alertaFormDesconhecido: false };
  }

  const campMatch = !!campaignId && campaigns.includes(String(campaignId));
  const formMatch = !!formId && forms.includes(String(formId));

  // campaign bate mas o form é desconhecido: captura mesmo assim + alerta.
  const alertaFormDesconhecido = campMatch && forms.length > 0 && !formMatch;

  return { match: campMatch || formMatch, alertaFormDesconhecido };
}

function last8(tel: string): string {
  return tel.replace(/\D/g, "").slice(-8);
}

/** Checagem de telefone com os quatro desfechos. */
async function checarTelefone(
  admin: SupabaseClient,
  telefone: string,
): Promise<{
  resultado: ChecagemResultado;
  detalhe: Record<string, unknown>;
  donoId?: string | null;
  pipelineLeadId?: string | null;
  pipelineLeadNome?: string | null;
}> {
  const l8 = last8(telefone);

  // (a) Opt-out tem precedência sobre tudo: nunca reabre conversa.
  const { data: supressao } = await admin
    .from("meta_supressao")
    .select("id, motivo")
    .eq("telefone_last8", l8)
    .limit(1)
    .maybeSingle();

  let optOutMotivo: string | null = supressao ? (supressao.motivo || "meta_supressao") : null;

  if (!optOutMotivo) {
    const { data: baseLead } = await admin
      .from("base_leads")
      .select("id, opt_out_motivo")
      .ilike("telefone", `%${l8}`)
      .not("opt_out_motivo", "is", null)
      .limit(1)
      .maybeSingle();
    if (baseLead?.opt_out_motivo) optOutMotivo = String(baseLead.opt_out_motivo);
  }

  if (optOutMotivo) {
    return { resultado: "opt_out", detalhe: { opt_out_motivo: optOutMotivo, telefone_last8: l8 } };
  }

  // (b) Telefone no pipeline?
  const { data: leads } = await admin
    .from("pipeline_leads")
    .select("id, nome, corretor_id, stage_id, arquivado, inativo")
    .eq("telefone", telefone)
    .order("created_at", { ascending: false })
    .limit(5);

  const rows = leads || [];
  if (rows.length === 0) {
    return { resultado: "inedito", detalhe: { telefone_last8: l8 } };
  }

  const isFechado = (r: Record<string, unknown>) =>
    r.arquivado === true ||
    r.inativo === true ||
    r.stage_id === DESCARTE_STAGE_ID ||
    r.stage_id === CAIU_STAGE_ID;

  const ativo = rows.find((r) => !isFechado(r as Record<string, unknown>));

  if (ativo) {
    return {
      resultado: "dono_ativo",
      detalhe: { pipeline_lead_id: ativo.id, corretor_id: ativo.corretor_id, telefone_last8: l8 },
      donoId: ativo.corretor_id,
      pipelineLeadId: ativo.id,
      pipelineLeadNome: ativo.nome,
    };
  }

  // Só existe em Descarte / Caiu / Inativo / arquivado → a Lia atende.
  return {
    resultado: "descartado_liberado",
    detalhe: { pipeline_lead_id: rows[0].id, telefone_last8: l8 },
    pipelineLeadId: rows[0].id,
    pipelineLeadNome: rows[0].nome,
  };
}

/**
 * Ponto único de entrada. Retorna desviar=true quando o chamador deve parar.
 */
export async function capturarLeadLia(
  admin: SupabaseClient,
  input: LiaCaptureInput,
): Promise<LiaCaptureResult> {
  const { match, alertaFormDesconhecido } = await matchCapturaLia(
    admin,
    input.campaign_id,
    input.form_id,
  );
  if (!match) return { desviar: false, capturado: false };

  if (!input.telefone) {
    return { desviar: false, capturado: false, motivo: "sem_telefone" };
  }

  // Idempotência por meta_lead_id (índice único em ia_leads).
  if (input.meta_lead_id) {
    const { data: jaExiste } = await admin
      .from("ia_leads")
      .select("id, checagem_resultado")
      .eq("meta_lead_id", String(input.meta_lead_id))
      .maybeSingle();
    if (jaExiste) {
      return {
        desviar: jaExiste.checagem_resultado !== "dono_ativo",
        capturado: true,
        resultado: (jaExiste.checagem_resultado || undefined) as ChecagemResultado | undefined,
        ia_lead_id: jaExiste.id,
        motivo: "ja_capturado",
        alerta_form_desconhecido: alertaFormDesconhecido,
      };
    }
  }

  const check = await checarTelefone(admin, input.telefone);
  const bloqueado = check.resultado === "dono_ativo" || check.resultado === "opt_out";
  const nowIso = new Date().toISOString();

  const { data: iaLead, error: insErr } = await admin
    .from("ia_leads")
    .insert({
      nome: input.nome || null,
      email: input.email || null,
      telefone: input.telefone,
      telefone_normalizado: input.telefone.replace(/\D/g, ""),
      telefone_last8: last8(input.telefone),
      meta_lead_id: input.meta_lead_id ? String(input.meta_lead_id) : null,
      campaign_id: input.campaign_id ? String(input.campaign_id) : null,
      form_id: input.form_id ? String(input.form_id) : null,
      adset_id: input.adset_id ? String(input.adset_id) : null,
      ad_id: input.ad_id ? String(input.ad_id) : null,
      origem: input.origem || "meta_lia",
      payload_bruto: (input.payload_bruto ?? null) as never,
      etapa: bloqueado ? "bloqueado" : "entrada",
      etapa_motivo: bloqueado ? check.resultado : null,
      checagem_resultado: check.resultado,
      checagem_detalhe: check.detalhe as never,
      opt_out: check.resultado === "opt_out",
      opt_out_at: check.resultado === "opt_out" ? nowIso : null,
      pipeline_lead_id: check.pipelineLeadId || null,
    })
    .select("id")
    .single();

  if (insErr) {
    // Falha na caixa da Lia nunca derruba a entrada do lead.
    console.error("liaCapture insert error:", insErr.message);
    return { desviar: false, capturado: false, motivo: `erro_insert:${insErr.message}` };
  }

  await admin.from("ia_eventos").insert({
    ia_lead_id: iaLead.id,
    tipo: "captura",
    etapa_para: bloqueado ? "bloqueado" : "entrada",
    motivo: check.resultado,
    ator: "sistema",
    detalhe: {
      campaign_id: input.campaign_id || null,
      form_id: input.form_id || null,
      alerta_form_desconhecido: alertaFormDesconhecido,
      ...check.detalhe,
    } as never,
  });

  // Dono ativo: avisa o corretor. Fato novo (preencheu o formulário de novo)
  // vale contato humano.
  if (check.resultado === "dono_ativo" && check.donoId) {
    const hoje = nowIso.slice(0, 10);
    const nome = check.pipelineLeadNome || input.nome || "Lead";
    await admin.from("notifications").insert({
      user_id: check.donoId,
      tipo: "lead",
      categoria: "lead_retorno",
      titulo: `🔄 ${nome} preencheu o formulário da campanha Casa Tua Canoas`,
      mensagem: `${nome} é seu lead ativo e voltou a se cadastrar pela campanha Casa Tua Canoas. Vale um contato agora.`,
      dados: {
        pipeline_lead_id: check.pipelineLeadId,
        ia_lead_id: iaLead.id,
        lead_nome: nome,
        origem: "campanha_lia",
      },
      agrupamento_key: `lia_dono_ativo_${check.pipelineLeadId}_${hoje}`,
    });
  }

  if (alertaFormDesconhecido) {
    await admin.from("ops_events").insert({
      fn: "lia-capture",
      level: "warn",
      category: "business",
      message: "lia_form_id_desconhecido",
      ctx: {
        campaign_id: input.campaign_id || null,
        form_id: input.form_id || null,
        ia_lead_id: iaLead.id,
      } as never,
    });
  }

  return {
    // dono_ativo: o lead segue o caminho normal do pipeline.
    desviar: check.resultado !== "dono_ativo",
    capturado: true,
    resultado: check.resultado,
    ia_lead_id: iaLead.id,
    alerta_form_desconhecido: alertaFormDesconhecido,
  };
}
