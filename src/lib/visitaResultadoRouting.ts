// ─────────────────────────────────────────────────────────────────
// visitaResultadoRouting — roteia o lead no pipeline após o resultado
// da visita (registrado pela Agenda de Visitas). Mantém o fluxo único:
// nem todo lead evolui para negócio — cada resultado leva a uma etapa.
// ─────────────────────────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import type { ResultadoVisita } from "@/components/visitas/VisitaResultadoDialog";

export interface RouteLeadContext {
  pipelineLeadId: string;
  resultado: ResultadoVisita;
  userId: string;
  corretorId?: string | null;
  gerenteId?: string | null;
  nome?: string | null;
  empreendimento?: string | null;
  telefone?: string | null;
  valorEstimado?: number | null;
  observacoes?: string | null;
}

interface RouteRule {
  /** tipo da etapa de destino (ou null para permanecer na Visita) */
  destinoTipo: string | null;
  /** mescla estas chaves em flag_status */
  flags?: Record<string, string>;
}

// Mapa resultado → destino no pipeline. "continuar_visitando" e "reagendar"
// mantêm o lead na Visita (não evolui). Só "quer proposta" cria negócio.
const ROUTES: Record<ResultadoVisita, RouteRule> = {
  gostou_quer_proposta: { destinoTipo: "proposta", flags: { status_negociacao: "proposta_enviada" } },
  gostou_vai_pensar: { destinoTipo: "aquecimento", flags: { prazo: "30" } },
  nao_gostou: { destinoTipo: "descarte" },
  nao_compareceu: { destinoTipo: null, flags: { status_visita: "no_show" } },
  reagendar: { destinoTipo: null, flags: { status_visita: "reagendada" } },
  quer_ver_outro: { destinoTipo: "qualificacao", flags: { status_atendimento: "busca" } },
  continuar_visitando: { destinoTipo: null, flags: { status_visita: "realizada" } },
};

/**
 * Move o lead no pipeline de acordo com o resultado da visita.
 * Retorna true se algo foi alterado. Idempotente o suficiente para uso repetido.
 */
export async function routeLeadAfterVisita(ctx: RouteLeadContext): Promise<boolean> {
  const rule = ROUTES[ctx.resultado];
  if (!rule) return false;

  // 1) Lê estado atual do lead (flags + stage atual)
  const { data: leadAtual } = await supabase
    .from("pipeline_leads")
    .select("stage_id, flag_status, negocio_id, pipeline_stages!inner(ordem)")
    .eq("id", ctx.pipelineLeadId)
    .maybeSingle();

  const oldFlags = ((leadAtual as any)?.flag_status as Record<string, any>) || {};
  const oldStageId = (leadAtual as any)?.stage_id as string | undefined;

  const novasFlags = { ...oldFlags, ...(rule.flags || {}) };
  const now = new Date().toISOString();

  const updatePayload: Record<string, any> = {
    flag_status: novasFlags,
    ultima_acao_at: now,
  };

  let destinoStageId: string | null = null;

  if (rule.destinoTipo) {
    const { data: destinoStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_tipo", "leads")
      .eq("tipo", rule.destinoTipo)
      .maybeSingle();
    destinoStageId = (destinoStage?.id as string | undefined) || null;

    if (destinoStageId && destinoStageId !== oldStageId) {
      updatePayload.stage_id = destinoStageId;
      updatePayload.stage_changed_at = now;
      if (rule.destinoTipo === "descarte" && ctx.observacoes) {
        updatePayload.motivo_descarte = ctx.observacoes;
      }
    }
  }

  // 2) Se for "quer proposta", garante o negócio (mesma lógica do board)
  if (rule.destinoTipo === "proposta") {
    await ensureNegocio(ctx, (leadAtual as any)?.negocio_id || null);
  }

  const { error } = await supabase
    .from("pipeline_leads")
    .update(updatePayload as any)
    .eq("id", ctx.pipelineLeadId);

  if (error) {
    console.error("[routeLeadAfterVisita] erro ao atualizar lead:", error);
    return false;
  }

  // 3) Histórico de movimentação (só quando muda de etapa)
  if (updatePayload.stage_id && oldStageId) {
    await supabase.from("pipeline_historico").insert({
      pipeline_lead_id: ctx.pipelineLeadId,
      stage_anterior_id: oldStageId,
      stage_novo_id: updatePayload.stage_id,
      movido_por: ctx.userId,
      observacao: `Resultado da visita: ${ctx.resultado}`,
    } as any).then(() => {}, () => {});
  }

  return true;
}

/** Cria o negócio vinculado ao lead se ainda não existir (FK usa profiles.id). */
async function ensureNegocio(ctx: RouteLeadContext, negocioIdAtual: string | null): Promise<void> {
  try {
    let negocioId = negocioIdAtual;
    if (!negocioId) {
      const { data: existing } = await supabase
        .from("negocios")
        .select("id")
        .eq("pipeline_lead_id", ctx.pipelineLeadId)
        .limit(1)
        .maybeSingle();
      negocioId = (existing?.id as string | undefined) || null;
    }

    if (!negocioId) {
      const ids = [ctx.corretorId, ctx.gerenteId || ctx.userId].filter(Boolean) as string[];
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, user_id")
        .in("user_id", ids);
      const profileMap = new Map((profileRows || []).map((p) => [p.user_id, p.id]));

      const { data: negocio } = await supabase
        .from("negocios")
        .insert({
          nome_cliente: ctx.nome || "Sem nome",
          pipeline_lead_id: ctx.pipelineLeadId,
          corretor_id: ctx.corretorId ? profileMap.get(ctx.corretorId) || null : null,
          gerente_id: profileMap.get(ctx.gerenteId || ctx.userId) || null,
          empreendimento: ctx.empreendimento || null,
          telefone: ctx.telefone || null,
          fase: "proposta",
          origem: "pipeline_convertido",
          vgv_estimado: ctx.valorEstimado || null,
        } as any)
        .select("id")
        .single();
      negocioId = (negocio?.id as string | undefined) || null;
    }

    if (negocioId && !negocioIdAtual) {
      await supabase.from("pipeline_leads").update({ negocio_id: negocioId } as any).eq("id", ctx.pipelineLeadId);
    }
  } catch (e) {
    console.error("[routeLeadAfterVisita] erro ao garantir negócio:", e);
  }
}
