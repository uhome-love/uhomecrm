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

// Mapa resultado → destino no pipeline. Regra fixa: TODA visita realizada passa
// obrigatoriamente por "Pós-Visita" antes de evoluir para negócio (definição
// conjunta corretor+gerente). Só "reagendar" e "nao_compareceu" (que não realizaram)
// fogem à regra.
const ROUTES: Record<ResultadoVisita, RouteRule> = {
  gostou_quer_proposta: {
    destinoTipo: "pos_visita",
    flags: { status_visita: "realizada", status_negociacao: "proposta_solicitada", interesse: "alto" },
  },
  gostou_vai_pensar: {
    destinoTipo: "pos_visita",
    flags: { status_visita: "realizada", interesse: "medio" },
  },
  nao_gostou: {
    destinoTipo: "pos_visita",
    flags: { status_visita: "realizada", interesse: "baixo", descarte_sugerido: "sim" },
  },
  quer_ver_outro: {
    destinoTipo: "pos_visita",
    flags: { status_visita: "realizada", precisa_novas_opcoes: "sim" },
  },
  continuar_visitando: {
    destinoTipo: "pos_visita",
    flags: { status_visita: "realizada" },
  },
  nao_compareceu: { destinoTipo: "aquecimento", flags: { status_visita: "no_show" } },
  reagendar: { destinoTipo: null, flags: { status_visita: "reagendada" } },
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

  // Negócio só é criado quando o lead sai de Pós-Visita para Em Negociação
  // (arrasto manual do corretor após alinhamento com o gerente). Nada a fazer aqui.



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

