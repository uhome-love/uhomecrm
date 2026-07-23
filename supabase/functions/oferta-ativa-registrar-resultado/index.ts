// oferta-ativa-registrar-resultado — Fase 1
// Registra resultado da ligação, atualiza fila/participantes e reativa lead quando aplicável.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const NOVO_LEAD_STAGE_ID = "d3843b2f-2fa1-4c31-9129-4eb0ed21f019";
const VISITA_STAGE_ID = "a857139f-c419-4e37-ae17-5f5e70b21172";
const DESCARTE_STAGE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";

const PONTOS: Record<string, number> = {
  nao_atendeu: 1,
  sem_interesse: 1,
  aproveitado: 4,
  visita_agendada: 10,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const { data: prof } = await admin
      .from("profiles")
      .select("id, nome")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prof) return errorResponse("profile not found", 404);
    const meuProfileId = prof.id as string;

    const body = await req.json().catch(() => ({}));
    const {
      sessao_id,
      fila_id,
      pipeline_lead_id,
      resultado,
      observacao,
      motivo_perda,
      visita_payload,
    } = body ?? {};

    if (!sessao_id || !fila_id || !pipeline_lead_id || !resultado) {
      return errorResponse("sessao_id, fila_id, pipeline_lead_id, resultado required", 400);
    }
    if (!(resultado in PONTOS)) return errorResponse("resultado inválido", 400);
    if (resultado === "sem_interesse" && !motivo_perda) {
      return errorResponse("motivo_perda obrigatório para sem_interesse", 400);
    }
    if (resultado === "visita_agendada" && !visita_payload) {
      return errorResponse("visita_payload obrigatório para visita_agendada", 400);
    }

    // Confere lock
    const { data: filaRow } = await admin
      .from("oferta_ativa_fila")
      .select("id, sessao_id, pipeline_lead_id, locked_by, locked_until")
      .eq("id", fila_id)
      .maybeSingle();
    if (!filaRow) return errorResponse("fila_id inválido", 404);
    if (filaRow.pipeline_lead_id !== pipeline_lead_id) {
      return errorResponse("fila/lead mismatch", 400);
    }
    if (filaRow.locked_by !== meuProfileId) {
      return errorResponse("lock não pertence a você", 409);
    }
    if (filaRow.locked_until && new Date(filaRow.locked_until) < new Date()) {
      return errorResponse("lock expirado", 409);
    }

    // 1) Insere ligação
    const pontos = PONTOS[resultado];
    const { data: ligIns, error: ligErr } = await admin
      .from("oferta_ativa_ligacoes")
      .insert({
        sessao_id,
        pipeline_lead_id,
        corretor_id: meuProfileId,
        resultado,
        observacao: observacao ?? null,
        motivo_perda: motivo_perda ?? null,
        pontos,
      })
      .select("id")
      .maybeSingle();
    if (ligErr) return errorResponse(`insert ligacao: ${ligErr.message}`, 500);

    // 2) Atualiza participante (aggregate counters)
    const { data: partRow } = await admin
      .from("oferta_ativa_participantes")
      .select("id, ligacoes_count, aproveitamentos_count, visitas_count, pontos, meta_ligacoes, meta_aproveitamentos, meta_visitas")
      .eq("sessao_id", sessao_id)
      .eq("corretor_id", meuProfileId)
      .maybeSingle();
    if (partRow) {
      const newLig = (partRow.ligacoes_count ?? 0) + 1;
      const newAprov =
        (partRow.aproveitamentos_count ?? 0) +
        (resultado === "aproveitado" || resultado === "visita_agendada" ? 1 : 0);
      const newVis = (partRow.visitas_count ?? 0) + (resultado === "visita_agendada" ? 1 : 0);
      const newPontos = (partRow.pontos ?? 0) + pontos;
      await admin
        .from("oferta_ativa_participantes")
        .update({
          ligacoes_count: newLig,
          aproveitamentos_count: newAprov,
          visitas_count: newVis,
          pontos: newPontos,
          ultima_acao_at: new Date().toISOString(),
          status_online: "online",
          updated_at: new Date().toISOString(),
        })
        .eq("id", partRow.id);
    }

    // 3) Atualiza fila conforme resultado
    let dedupHitId: string | null = null;
    let reactivated = false;
    let visitaId: string | null = null;

    if (resultado === "nao_atendeu") {
      await admin
        .from("oferta_ativa_fila")
        .update({
          locked_by: null,
          locked_until: null,
          cooldown_ate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", fila_id);
    } else if (resultado === "sem_interesse") {
      await admin.from("oferta_ativa_fila").delete().eq("id", fila_id);
    } else if (resultado === "aproveitado" || resultado === "visita_agendada") {
      // DEDUP: existe ativo com mesmo telefone_normalizado?
      const { data: leadRow } = await admin
        .from("pipeline_leads")
        .select("id, telefone_normalizado")
        .eq("id", pipeline_lead_id)
        .maybeSingle();
      const phone = leadRow?.telefone_normalizado ?? null;
      if (phone) {
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
          dedupHitId = dupRows[0].id;
          // rollback: apaga ligacao inserida para não contar
          if (ligIns?.id) await admin.from("oferta_ativa_ligacoes").delete().eq("id", ligIns.id);
          // reverte participante
          if (partRow) {
            await admin
              .from("oferta_ativa_participantes")
              .update({
                ligacoes_count: partRow.ligacoes_count ?? 0,
                aproveitamentos_count: partRow.aproveitamentos_count ?? 0,
                visitas_count: partRow.visitas_count ?? 0,
                pontos: partRow.pontos ?? 0,
              })
              .eq("id", partRow.id);
          }
          // libera lock
          await admin
            .from("oferta_ativa_fila")
            .update({ locked_by: null, locked_until: null })
            .eq("id", fila_id);
          return jsonResponse(
            { ok: false, error: "DUPLICATE_ACTIVE", duplicate_lead_id: dedupHitId },
            409,
          );
        }
      }

      // Reativa lead
      const targetStage = resultado === "visita_agendada" ? VISITA_STAGE_ID : NOVO_LEAD_STAGE_ID;
      const { error: upLeadErr } = await admin
        .from("pipeline_leads")
        .update({
          arquivado: false,
          aceite_status: "aceito",
          corretor_id: meuProfileId,
          motivo_descarte: null,
          tipo_descarte: null,
          reengajamento_status: null,
          stage_id: targetStage,
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", pipeline_lead_id);
      if (upLeadErr) return errorResponse(`reativar lead: ${upLeadErr.message}`, 500);
      reactivated = true;

      // Registra atividade
      await admin.from("pipeline_atividades").insert({
        pipeline_lead_id,
        corretor_id: meuProfileId,
        tipo: "ligacao",
        descricao: "Reaproveitado — Oferta Ativa / Lista Inteligente de Descartados",
      });

      // Visita
      if (resultado === "visita_agendada" && visita_payload) {
        const { data: vIns, error: vErr } = await admin
          .from("visitas")
          .insert({
            pipeline_lead_id,
            corretor_id: meuProfileId,
            data_visita: visita_payload.data_visita ?? visita_payload.data ?? null,
            hora_visita: visita_payload.hora_visita ?? visita_payload.hora ?? null,
            empreendimento: visita_payload.empreendimento ?? null,
            nome_cliente: visita_payload.nome_cliente ?? null,
            telefone: visita_payload.telefone ?? null,
            local_visita: visita_payload.local_visita ?? null,
            status: "marcada",
            origem: "oferta_ativa",
            observacoes: visita_payload.observacoes ?? null,
            created_by: userId,
          })
          .select("id")
          .maybeSingle();
        if (vErr) console.warn("[registrar-resultado] visita insert:", vErr.message);
        visitaId = vIns?.id ?? null;

        // Fallback: garante que stage é Visita caso trigger não tenha movido
        await admin
          .from("pipeline_leads")
          .update({ stage_id: VISITA_STAGE_ID })
          .eq("id", pipeline_lead_id)
          .neq("stage_id", VISITA_STAGE_ID);
      }

      // Remove da fila
      await admin.from("oferta_ativa_fila").delete().eq("id", fila_id);
    }

    // 4) pulse_events
    const pulseTipo =
      resultado === "visita_agendada"
        ? "oa_visita"
        : resultado === "aproveitado"
        ? "oa_aproveitado"
        : "oa_ligacao";
    await admin.from("pulse_events").insert({
      tipo: pulseTipo,
      corretor_id: meuProfileId,
      titulo: `${prof.nome ?? "Corretor"} — ${resultado}`,
      descricao: observacao ?? null,
      metadata: { sessao_id, pipeline_lead_id, pontos, balde: null },
    });

    // 5) Ranking snapshot
    const { data: rankRows } = await admin
      .from("oferta_ativa_participantes")
      .select("corretor_id, pontos, ligacoes_count, aproveitamentos_count, visitas_count")
      .eq("sessao_id", sessao_id)
      .order("pontos", { ascending: false })
      .limit(10);

    const bateuMeta =
      partRow &&
      ((partRow.meta_ligacoes > 0 && (partRow.ligacoes_count + 1) >= partRow.meta_ligacoes) ||
        (resultado === "visita_agendada" &&
          partRow.meta_visitas > 0 &&
          (partRow.visitas_count + 1) >= partRow.meta_visitas));

    return jsonResponse({
      ok: true,
      reactivated,
      visita_id: visitaId,
      pontos,
      bateu_meta: !!bateuMeta,
      ranking_top10: rankRows ?? [],
    });
  } catch (e) {
    console.error("[registrar-resultado] erro:", e);
    return errorResponse((e as Error).message ?? "internal", 500);
  }
});
