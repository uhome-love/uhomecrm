// ─────────────────────────────────────────────────────────────────────────────
// pdnSyncEngine — sincroniza ações do gestor no PDN com o pipeline real.
//
// Quando o gestor altera a etapa/VGV do PDN de um negócio vinculado a um
// pipeline_lead, este módulo escreve no `pipeline_leads` e/ou `negocios`
// respeitando as regras do CRM (mesma equipe / CEO / Diretoria via RLS).
// Também dispara notificação interna automática para o corretor.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import type { PdnGrupo, PdnRow } from "@/hooks/usePdn";
import { toast } from "sonner";

// PDN grupo → tipo de pipeline_stages
const GRUPO_TO_STAGE_TIPO: Record<Exclude<PdnGrupo, "caidos">, string> = {
  visita_realizada: "visita",
  em_negociacao: "proposta",
  contrato: "contrato_gerado",
  ganho: "venda",
};

// PDN grupo → fase do negócio
const GRUPO_TO_FASE: Partial<Record<PdnGrupo, string>> = {
  em_negociacao: "proposta",
  contrato: "contrato",
  ganho: "vendido",
};

const GRUPO_LABEL: Record<PdnGrupo, string> = {
  visita_realizada: "Visita Realizada",
  em_negociacao: "Em Negociação",
  contrato: "Contrato",
  ganho: "Ganho",
  caidos: "Caídos",
};

async function notifyBroker(
  row: PdnRow,
  titulo: string,
  mensagem: string,
  categoria = "pdn_atualizacao",
): Promise<void> {
  if (!row.corretorAuthId) return;
  try {
    await supabase.rpc("criar_notificacao", {
      p_user_id: row.corretorAuthId,
      p_tipo: "pdn",
      p_categoria: categoria,
      p_titulo: titulo,
      p_mensagem: mensagem,
      p_dados: {
        pipeline_lead_id: row.pipelineLeadId,
        negocio_id: row.negocioId,
      },
    });
  } catch (e) {
    console.warn("[pdnSync] notificação falhou (não bloqueia)", e);
  }
}

// ── 1) Sincroniza etapa PDN → pipeline_leads + negocios ──────────────────────
export async function syncPipelineStageFromPdn(
  row: PdnRow,
  grupo: Exclude<PdnGrupo, "caidos">,
  userId: string | null,
): Promise<{ negocioId: string | null } | null> {
  if (!row.pipelineLeadId) return null;
  const nowIso = new Date().toISOString();
  const stageTipo = GRUPO_TO_STAGE_TIPO[grupo];

  // resolve stage_id destino
  const { data: stageRow } = await supabase
    .from("pipeline_stages")
    .select("id, tipo, ordem")
    .eq("pipeline_tipo", "leads")
    .eq("tipo", stageTipo)
    .maybeSingle();
  if (!stageRow?.id) {
    toast.error(`Etapa "${GRUPO_LABEL[grupo]}" não encontrada no pipeline`);
    return null;
  }

  // estado atual do lead
  const { data: leadAtual } = await supabase
    .from("pipeline_leads")
    .select("id, stage_id, negocio_id, corretor_id, nome, flag_status")
    .eq("id", row.pipelineLeadId)
    .maybeSingle();
  if (!leadAtual) {
    toast.error("Lead não encontrado no pipeline");
    return null;
  }

  const oldStageId = (leadAtual as any).stage_id as string | undefined;
  let negocioId = (leadAtual as any).negocio_id as string | null;

  const updatePayload: Record<string, unknown> = {
    ultima_acao_at: nowIso,
    updated_at: nowIso,
  };
  if (oldStageId !== stageRow.id) {
    updatePayload.stage_id = stageRow.id;
    updatePayload.stage_changed_at = nowIso;
  }
  // Flag específica p/ visita realizada
  if (grupo === "visita_realizada") {
    const flag = { ...(((leadAtual as any).flag_status as Record<string, unknown>) || {}) };
    flag.status_visita = "realizada";
    updatePayload.flag_status = flag;
  }

  // 1) Cria negócio se necessário (em_negociacao/contrato/ganho)
  const needsNegocio = grupo === "em_negociacao" || grupo === "contrato" || grupo === "ganho";
  if (needsNegocio && !negocioId) {
    // resolve profile ids
    const authId = (leadAtual as any).corretor_id as string | null;
    let corretorProfileId: string | null = null;
    let gerenteProfileId: string | null = null;
    if (authId) {
      const { data: p1 } = await supabase.from("profiles").select("id").eq("user_id", authId).maybeSingle();
      corretorProfileId = (p1?.id as string | undefined) || null;
    }
    if (userId) {
      const { data: p2 } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
      gerenteProfileId = (p2?.id as string | undefined) || null;
    }
    const { data: neg, error: negErr } = await supabase
      .from("negocios")
      .insert({
        nome_cliente: (leadAtual as any).nome || row.nome || "Sem nome",
        pipeline_lead_id: row.pipelineLeadId,
        corretor_id: corretorProfileId,
        gerente_id: gerenteProfileId,
        empreendimento: row.empreendimento && row.empreendimento !== "—" ? row.empreendimento : null,
        vgv_estimado: row.vgv || null,
        fase: GRUPO_TO_FASE[grupo] || "proposta",
        origem: "pdn_gestor",
        status: "ativo",
      } as any)
      .select("id")
      .single();
    if (negErr) {
      console.error("[pdnSync] erro criando negócio", negErr);
      toast.error("Erro ao criar negócio");
      return null;
    }
    negocioId = (neg?.id as string | undefined) || null;
    if (negocioId) updatePayload.negocio_id = negocioId;
  } else if (needsNegocio && negocioId) {
    // atualiza fase / data_assinatura
    const fase = GRUPO_TO_FASE[grupo];
    const negPatch: Record<string, unknown> = { updated_at: nowIso };
    if (fase) negPatch.fase = fase;
    if (grupo === "ganho") {
      negPatch.data_assinatura = new Date().toISOString().slice(0, 10);
      // VGV final quando marca ganho
      if (row.vgv > 0) negPatch.vgv_final = row.vgv;
    }
    await supabase.from("negocios").update(negPatch as any).eq("id", negocioId);
  }

  // 2) Update pipeline_lead
  const { error: leadErr } = await supabase
    .from("pipeline_leads")
    .update(updatePayload as any)
    .eq("id", row.pipelineLeadId);
  if (leadErr) {
    console.error("[pdnSync] erro atualizando lead", leadErr);
    toast.error("Você não tem permissão para alterar este lead");
    return null;
  }

  // 3) Histórico de movimentação
  if (updatePayload.stage_id && oldStageId) {
    supabase
      .from("pipeline_historico")
      .insert({
        pipeline_lead_id: row.pipelineLeadId,
        stage_anterior_id: oldStageId,
        stage_novo_id: stageRow.id,
        movido_por: userId,
        observacao: `Movido pelo gestor via PDN: ${GRUPO_LABEL[grupo]}`,
      } as any)
      .then(() => undefined, () => undefined);
  }

  // 4) Notificação automática para o corretor
  await notifyBroker(
    row,
    `PDN: etapa alterada para ${GRUPO_LABEL[grupo]}`,
    `Gestor moveu ${row.nome} para "${GRUPO_LABEL[grupo]}".`,
    "pdn_etapa",
  );

  toast.success(`${row.nome}: pipeline atualizado para ${GRUPO_LABEL[grupo]}`);
  return { negocioId };
}

// ── 2) Sincroniza VGV / empreendimento PDN → negocios ────────────────────────
export async function syncNegocioVgvFromPdn(
  row: PdnRow,
  vgv: number | null,
  empreendimento: string | null,
): Promise<boolean> {
  if (!row.negocioId) return false;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (vgv != null) patch.vgv_final = vgv; // sempre vgv_final (100%)
  if (empreendimento !== null) patch.empreendimento = empreendimento || null;
  if (Object.keys(patch).length === 1) return false;
  const { error } = await supabase.from("negocios").update(patch as any).eq("id", row.negocioId);
  if (error) {
    console.error("[pdnSync] erro atualizando VGV/empreendimento", error);
    toast.error("Sem permissão para atualizar o negócio");
    return false;
  }
  const bits: string[] = [];
  if (vgv != null) bits.push(`VGV atualizado`);
  if (empreendimento !== null) bits.push(`empreendimento atualizado`);
  await notifyBroker(row, `PDN: ${bits.join(" e ")}`, `Gestor atualizou ${row.nome} no PDN.`, "pdn_vgv");
  return true;
}

// ── 3) Descarte / inativação via PDN ─────────────────────────────────────────
export async function discardLeadFromPdn(row: PdnRow, motivo: string, userId: string | null): Promise<boolean> {
  if (!row.pipelineLeadId) return false;
  const nowIso = new Date().toISOString();
  const { data: descarteStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("pipeline_tipo", "leads")
    .eq("tipo", "descarte")
    .maybeSingle();
  if (!descarteStage?.id) {
    toast.error("Etapa Descarte não encontrada");
    return false;
  }
  const { error } = await supabase
    .from("pipeline_leads")
    .update({
      stage_id: descarteStage.id,
      motivo_descarte: motivo || "Descartado pelo gestor via PDN",
      tipo_descarte: "reengajavel",
      stage_changed_at: nowIso,
      ultima_acao_at: nowIso,
      updated_at: nowIso,
    } as any)
    .eq("id", row.pipelineLeadId);
  if (error) {
    console.error("[pdnSync] erro descartando lead", error);
    toast.error("Sem permissão para descartar este lead");
    return false;
  }
  if (row.negocioId) {
    await supabase.from("negocios").update({ status: "perdido", motivo_queda: motivo, updated_at: nowIso } as any).eq("id", row.negocioId);
  }
  await notifyBroker(row, `PDN: lead descartado`, `Gestor descartou ${row.nome}. Motivo: ${motivo || "-"}`, "pdn_descarte");
  toast.success("Lead descartado no pipeline (reengajável)");
  return true;
}

export async function inactivateLeadFromPdn(row: PdnRow, motivo: string): Promise<boolean> {
  if (!row.pipelineLeadId) return false;
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("pipeline_leads")
    .update({
      arquivado: true,
      motivo_descarte: motivo || "Inativado pelo gestor via PDN",
      tipo_descarte: "definitivo",
      ultima_acao_at: nowIso,
      updated_at: nowIso,
    } as any)
    .eq("id", row.pipelineLeadId);
  if (error) {
    console.error("[pdnSync] erro inativando lead", error);
    toast.error("Sem permissão para inativar este lead");
    return false;
  }
  if (row.negocioId) {
    await supabase.from("negocios").update({ status: "arquivado", motivo_queda: motivo, updated_at: nowIso } as any).eq("id", row.negocioId);
  }
  await notifyBroker(row, `PDN: lead inativado`, `Gestor inativou ${row.nome}. Motivo: ${motivo || "-"}`, "pdn_inativado");
  toast.success("Lead inativado definitivamente");
  return true;
}

// Notificação após publicação de observação (chamada pelo publish.ts).
export async function notifyBrokerOfPdnPublish(row: PdnRow, field: "observacao" | "proxima_acao"): Promise<void> {
  const label = field === "observacao" ? "observação" : "próxima ação";
  await notifyBroker(
    row,
    `PDN: ${label} publicada`,
    `Gestor publicou uma ${label} no lead ${row.nome}. Veja no histórico.`,
    "pdn_publicacao",
  );
}
