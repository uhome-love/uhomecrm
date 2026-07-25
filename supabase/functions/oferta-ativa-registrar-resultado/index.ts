// oferta-ativa-registrar-resultado — Fase 2 (gamificação + Pular real + cooldown 2h)
// Registra resultado da ligação, atualiza fila/participantes e reativa lead quando aplicável.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { reactivateLead, VISITA_STAGE_ID, NOVO_LEAD_STAGE_ID } from "../_shared/reactivateLead.ts";

// Cooldown do "não atendeu" — 2h (era 1h) — Mutirão interno (fila.cooldown_ate)
const COOLDOWN_MS_NAO_ATENDEU = 2 * 60 * 60 * 1000;

// Onda 2 — TTL global de cooldown (oferta_ativa_cooldowns) por resultado.
// mutirao_bypass=true faz o Mutirão ao vivo IGNORAR este cooldown.
const COOLDOWN_TTL_DAYS: Record<string, number | null> = {
  nao_atendeu: 7,
  sem_interesse: 30,
  descarte_definitivo: null,   // NULL = permanente
  aproveitado: 0,              // 0 = não grava
  visita_agendada: 0,
  pulado: 0,
};

const PONTOS: Record<string, number> = {
  pulado: 0,
  nao_atendeu: 1,
  sem_interesse: 1,
  aproveitado: 4,
  visita_agendada: 10,
};

// Patamares de "level up" (celebração no feed) por pontos acumulados na sessão
const LEVEL_THRESHOLDS = [10, 25, 50, 100];


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
    const meuAuthId = userId; // auth.users.id — usado em pipeline_leads e visitas

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
      .select("id, sessao_id, pipeline_lead_id, locked_by, locked_until, ultimo_corretor_id")
      .eq("id", fila_id)
      .maybeSingle();
    // LEAD_GONE: fila já foi removida (outro corretor aproveitou / sem_interesse / admin resetou).
    // Retorna 200 com code para o cliente avançar suavemente sem toast de erro.
    if (!filaRow) {
      console.warn("[registrar-resultado] LEAD_GONE fila removida", { fila_id, pipeline_lead_id, corretor: meuProfileId, resultado });
      return jsonResponse({
        ok: false,
        code: "LEAD_GONE",
        reason: "Este lead não está mais disponível na fila. Buscando o próximo…",
      });
    }
    if (filaRow.pipeline_lead_id !== pipeline_lead_id) {
      console.warn("[registrar-resultado] LEAD_GONE mismatch", { fila_id, esperado: pipeline_lead_id, atual: filaRow.pipeline_lead_id });
      return jsonResponse({
        ok: false,
        code: "LEAD_GONE",
        reason: "Este lead foi substituído. Buscando o próximo…",
      });
    }
    if (filaRow.locked_by && filaRow.locked_by !== meuProfileId) {
      console.warn("[registrar-resultado] LOCK_TAKEN", { fila_id, locked_by: filaRow.locked_by, meu: meuProfileId });
      return jsonResponse({
        ok: false,
        code: "LEAD_GONE",
        reason: "Este lead já está com outro corretor. Buscando o próximo…",
      });
    }
    if (filaRow.locked_until && new Date(filaRow.locked_until) < new Date()) {
      console.warn("[registrar-resultado] LOCK_EXPIRED", { fila_id, locked_until: filaRow.locked_until });
      return jsonResponse({
        ok: false,
        code: "LEAD_GONE",
        reason: "Seu tempo com este lead expirou. Buscando o próximo…",
      });
    }


    // ─── 1) Insere ligação ───
    const pontos = PONTOS[resultado];
    const contaLigacao = resultado !== "pulado"; // pular não conta ligação
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

    // ─── 2) Atualiza participante (aggregate counters). Pular não incrementa nada. ───
    const { data: partRow } = await admin
      .from("oferta_ativa_participantes")
      .select("id, ligacoes_count, aproveitamentos_count, visitas_count, pontos, meta_ligacoes, meta_aproveitamentos, meta_visitas")
      .eq("sessao_id", sessao_id)
      .eq("corretor_id", meuProfileId)
      .maybeSingle();

    const pontosAntes = partRow?.pontos ?? 0;
    let newPontos = pontosAntes;
    if (partRow && contaLigacao) {
      const newLig = (partRow.ligacoes_count ?? 0) + 1;
      const newAprov =
        (partRow.aproveitamentos_count ?? 0) +
        (resultado === "aproveitado" || resultado === "visita_agendada" ? 1 : 0);
      const newVis = (partRow.visitas_count ?? 0) + (resultado === "visita_agendada" ? 1 : 0);
      newPontos = (partRow.pontos ?? 0) + pontos;
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

    // ─── 3) Atualiza fila conforme resultado ───
    let dedupHitId: string | null = null;
    let reactivated = false;
    let visitaId: string | null = null;

    if (resultado === "pulado") {
      // Solta o lock. NÃO seta cooldown_ate. NÃO toca ultimo_corretor_id (guarda o descartador).
      // O RPC oferta_ativa_lock_next_lead já exclui leads que o corretor pulou nesta sessão.
      await admin
        .from("oferta_ativa_fila")
        .update({
          locked_by: null,
          locked_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fila_id);
    } else if (resultado === "nao_atendeu") {
      await admin
        .from("oferta_ativa_fila")
        .update({
          locked_by: null,
          locked_until: null,
          cooldown_ate: new Date(Date.now() + COOLDOWN_MS_NAO_ATENDEU).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", fila_id);
    } else if (resultado === "sem_interesse") {
      await admin.from("oferta_ativa_fila").delete().eq("id", fila_id);
    } else if (resultado === "aproveitado" || resultado === "visita_agendada") {
      const targetStage = resultado === "visita_agendada" ? VISITA_STAGE_ID : NOVO_LEAD_STAGE_ID;
      const react = await reactivateLead(admin, {
        pipeline_lead_id,
        corretor_auth_id: meuAuthId,
        corretor_profile_id: meuProfileId,
        target_stage_id: targetStage,
      });

      if (!react.ok && react.duplicate_lead_id) {
        dedupHitId = react.duplicate_lead_id;
        // rollback
        if (ligIns?.id) await admin.from("oferta_ativa_ligacoes").delete().eq("id", ligIns.id);
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
        await admin
          .from("oferta_ativa_fila")
          .update({ locked_by: null, locked_until: null })
          .eq("id", fila_id);
        return jsonResponse(
          { ok: false, error: "DUPLICATE_ACTIVE", duplicate_lead_id: dedupHitId },
          409,
        );
      }
      if (!react.ok) return errorResponse(react.error ?? "reativar lead falhou", 500);
      reactivated = true;

      // Visita
      if (resultado === "visita_agendada" && visita_payload) {
        // Busca dados canônicos do lead para fallback
        const { data: leadRow } = await admin
          .from("pipeline_leads")
          .select("nome, telefone")
          .eq("id", pipeline_lead_id)
          .maybeSingle();

        const { data: vIns, error: vErr } = await admin
          .from("visitas")
          .insert({
            pipeline_lead_id,
            corretor_id: meuAuthId, // auth.users.id — RLS/triggers exigem
            gerente_id: react.gerente_auth_id ?? null,
            tipo: "lead",
            data_visita: visita_payload.data_visita ?? visita_payload.data ?? null,
            hora_visita: visita_payload.hora_visita ?? visita_payload.hora ?? null,
            empreendimento: visita_payload.empreendimento ?? null,
            nome_cliente: visita_payload.nome_cliente ?? leadRow?.nome ?? "Cliente",
            telefone: visita_payload.telefone ?? leadRow?.telefone ?? null,
            local_visita: visita_payload.local_visita ?? null,
            status: "marcada",
            origem: "oferta_ativa",
            observacoes: visita_payload.observacoes ?? null,
            responsavel_visita: visita_payload.responsavel_visita ?? "proprio_corretor",
            created_by: userId,
          })
          .select("id")
          .maybeSingle();
        if (vErr) console.warn("[registrar-resultado] visita insert:", vErr.message);
        visitaId = vIns?.id ?? null;

        await admin
          .from("pipeline_leads")
          .update({ stage_id: VISITA_STAGE_ID })
          .eq("id", pipeline_lead_id)
          .neq("stage_id", VISITA_STAGE_ID);
      }

      // Remove da fila
      await admin.from("oferta_ativa_fila").delete().eq("id", fila_id);
    }

    // ─── 4) Pulse events (celebrações) ───
    // Só publica evento para resultados relevantes; pular não vira feed.
    if (resultado === "aproveitado" || resultado === "visita_agendada") {
      const pulseTipo = resultado === "visita_agendada" ? "oa_visita" : "oa_aproveitado";
      await admin.from("pulse_events").insert({
        tipo: pulseTipo,
        corretor_id: meuProfileId,
        titulo: `${prof.nome ?? "Corretor"} ${resultado === "visita_agendada" ? "agendou uma visita" : "aproveitou um lead"}`,
        descricao: observacao ?? null,
        metadata: { sessao_id, pipeline_lead_id, pontos, balde: null },
      });
    }

    // Meta batida
    const bateuMeta =
      partRow && contaLigacao &&
      ((partRow.meta_ligacoes > 0 && (partRow.ligacoes_count + 1) === partRow.meta_ligacoes) ||
        (resultado === "visita_agendada" &&
          partRow.meta_visitas > 0 &&
          (partRow.visitas_count + 1) === partRow.meta_visitas) ||
        ((resultado === "aproveitado" || resultado === "visita_agendada") &&
          partRow.meta_aproveitamentos > 0 &&
          (partRow.aproveitamentos_count + 1) === partRow.meta_aproveitamentos));
    if (bateuMeta) {
      await admin.from("pulse_events").insert({
        tipo: "oa_meta_batida",
        corretor_id: meuProfileId,
        titulo: `${prof.nome ?? "Corretor"} bateu uma meta! 🏆`,
        descricao: null,
        metadata: { sessao_id, pipeline_lead_id },
      });
    }

    // Level up (cruzou patamar de pontos)
    if (contaLigacao) {
      const crossed = LEVEL_THRESHOLDS.find((t) => pontosAntes < t && newPontos >= t);
      if (crossed) {
        await admin.from("pulse_events").insert({
          tipo: "oa_level_up",
          corretor_id: meuProfileId,
          titulo: `${prof.nome ?? "Corretor"} atingiu ${crossed} pts 💎`,
          descricao: null,
          metadata: { sessao_id, level: crossed },
        });
      }
    }

    // Streak: 3+ aproveitamentos/visitas consecutivos
    if (resultado === "aproveitado" || resultado === "visita_agendada") {
      const { data: last3 } = await admin
        .from("oferta_ativa_ligacoes")
        .select("resultado")
        .eq("sessao_id", sessao_id)
        .eq("corretor_id", meuProfileId)
        .in("resultado", ["nao_atendeu", "sem_interesse", "aproveitado", "visita_agendada"])
        .order("created_at", { ascending: false })
        .limit(5);
      const streak = (() => {
        let n = 0;
        for (const r of last3 ?? []) {
          if (r.resultado === "aproveitado" || r.resultado === "visita_agendada") n++;
          else break;
        }
        return n;
      })();
      if (streak >= 3) {
        await admin.from("pulse_events").insert({
          tipo: "oa_streak",
          corretor_id: meuProfileId,
          titulo: `${prof.nome ?? "Corretor"} está em chamas! 🔥 x${streak}`,
          descricao: null,
          metadata: { sessao_id, streak },
        });
      }
    }

    // ─── 5) Ranking snapshot ───
    const { data: rankRows } = await admin
      .from("oferta_ativa_participantes")
      .select("corretor_id, pontos, ligacoes_count, aproveitamentos_count, visitas_count")
      .eq("sessao_id", sessao_id)
      .order("pontos", { ascending: false })
      .limit(10);

    const targetStageName =
      resultado === "visita_agendada" ? "Visita" :
      resultado === "aproveitado" ? "Novo Lead" : null;

    return jsonResponse({
      ok: true,
      reactivated,
      visita_id: visitaId,
      pontos,
      bateu_meta: !!bateuMeta,
      ranking_top10: rankRows ?? [],
      target_stage_name: targetStageName,
      pipeline_lead_id: reactivated ? pipeline_lead_id : null,
    });
  } catch (e) {
    console.error("[registrar-resultado] erro:", e);
    return errorResponse((e as Error).message ?? "internal", 500);
  }
});
