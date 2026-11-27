/**
 * _shared/reactivateDiscardedToRoleta.ts
 *
 * Regra (27/11/2026, Lucas): lead DESCARTADO, ARQUIVADO/INATIVADO ou ESTAGNADO
 * (lead_estagnado_vai_fila_ceo) que recebe novo interesse externo volta como
 * NOVO LEAD na FILA CEO (sem corretor, distribuição manual). NÃO volta para o
 * corretor antigo e o corretor antigo NÃO é avisado. O histórico recebe o novo
 * interesse completo, como num lead novo.
 *
 * Lead ATIVO e em dia continua com o dono atual — esse caminho fica nos receivers.
 *
 * IDs: pipeline_leads.corretor_id / gerente_id → auth.users.id
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  /** Motivo do retorno, para o histórico */
  motivo?: "descartado" | "estagnado";
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

  let motivo = opts.motivo;
  if (!motivo) {
    const { data: antes } = await admin
      .from("pipeline_leads").select("stage_id, arquivado").eq("id", opts.leadId).maybeSingle();
    motivo = antes && antes.stage_id !== DESCARTE_STAGE_ID && antes.arquivado !== true ? "estagnado" : "descartado";
  }

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
    estagnado: false,
    estagnado_em: null,
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

  // Histórico completo do novo interesse (como num lead novo). Sem notificação ao corretor antigo.
  try {
    const { data: lr } = await admin
      .from("pipeline_leads")
      .select("nome, telefone, email, empreendimento, campanha, formulario, anuncio, origem, form_respostas")
      .eq("id", opts.leadId)
      .maybeSingle();
    const linhas: string[] = [];
    const add = (k: string, v: unknown) => {
      const t = v === null || v === undefined ? "" : String(v).trim();
      if (t) linhas.push(`${k}: ${t}`);
    };
    add("Nome", lr?.nome);
    add("Telefone", lr?.telefone);
    add("E-mail", lr?.email);
    add("Produto", opts.interesseLabel || lr?.empreendimento);
    add("Origem", opts.origemLabel);
    add("Campanha", lr?.campanha);
    add("Formulário", lr?.formulario);
    add("Anúncio", lr?.anuncio);
    const fr = lr?.form_respostas;
    if (fr && typeof fr === "object") {
      const pares = Array.isArray(fr)
        ? fr.map((x: Record<string, unknown>) => [x?.pergunta ?? x?.name ?? x?.campo, x?.resposta ?? x?.value ?? x?.valor])
        : Object.entries(fr as Record<string, unknown>);
      const resp = pares
        .filter(([k, v]) => k && v !== null && v !== undefined && String(v).trim() !== "")
        .map(([k, v]) => `• ${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
      if (resp.length) linhas.push(`Respostas do formulário:\n${resp.join("\n")}`);
    }
    if (opts.mensagem) linhas.push(`Mensagem: "${opts.mensagem}"`);
    const situacao = motivo === "estagnado" ? "estagnado" : "em Descarte/inativado";
    await admin.from("pipeline_atividades").insert({
      pipeline_lead_id: opts.leadId,
      tipo: "entrada",
      titulo: `🔄 Novo interesse — ${opts.interesseLabel} (${opts.origemLabel}) · enviado para a Fila CEO`,
      descricao:
        `${linhas.join("\n")}\n\nLead estava ${situacao} e voltou como Novo Lead na Fila CEO para distribuição manual.`,
      data: todayStamp,
      prioridade: "alta",
      status: "completed",
      created_by: "00000000-0000-0000-0000-000000000000",
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

  // Fila CEO: sem distribuição automática.
  return { ok: true, distributed: false, corretor_id: null, reason: "fila_ceo_novo_interesse" };
}

/** true quando o lead ativo está estagnado e o novo interesse deve levá-lo à Fila CEO. Erro nunca bloqueia (false). */
export async function leadEstagnadoVaiFilaCeo(admin: SupabaseClient, leadId: string): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("lead_estagnado_vai_fila_ceo", { p_lead_id: leadId });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
