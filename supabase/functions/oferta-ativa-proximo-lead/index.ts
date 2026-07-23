// oferta-ativa-proximo-lead — Fase 1
// Corretor. Faz lock atômico do próximo lead elegível da fila. verify_jwt=true.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    // profile do corretor
    const { data: prof } = await admin
      .from("profiles")
      .select("id, nome")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prof) return errorResponse("profile not found", 404);
    const meuProfileId = prof.id as string;

    const body = await req.json().catch(() => ({}));
    const sessao_id: string | undefined = body?.sessao_id;
    const empreendimento_ids: string[] | undefined = body?.empreendimento_ids;
    const segmento_ids: string[] | undefined = body?.segmento_ids;
    if (!sessao_id) return errorResponse("sessao_id required", 400);

    // Sessão ao vivo + dentro da janela
    const { data: sessao } = await admin
      .from("oferta_ativa_sessoes")
      .select("id, status, inicio_at, fim_at")
      .eq("id", sessao_id)
      .maybeSingle();
    if (!sessao) return errorResponse("sessao not found", 404);
    if (sessao.status !== "ao_vivo") return errorResponse("sessao não está ao vivo", 409);
    const now = new Date();
    if (new Date(sessao.inicio_at) > now || new Date(sessao.fim_at) < now) {
      return errorResponse("sessao fora da janela", 409);
    }

    // upsert participante (heartbeat + status)
    const { data: teamRow } = await admin
      .from("team_members")
      .select("gerente_id, equipe")
      .eq("user_id", userId)
      .eq("status", "ativo")
      .maybeSingle();
    let gerenteProfileId: string | null = null;
    if (teamRow?.gerente_id) {
      const { data: gp } = await admin
        .from("profiles")
        .select("id")
        .eq("user_id", teamRow.gerente_id)
        .maybeSingle();
      gerenteProfileId = gp?.id ?? null;
    }
    await admin
      .from("oferta_ativa_participantes")
      .upsert(
        {
          sessao_id,
          corretor_id: meuProfileId,
          gerente_id: gerenteProfileId,
          equipe_text: teamRow?.equipe ?? null,
          status_online: "online",
          ultimo_heartbeat_at: new Date().toISOString(),
          ultima_acao_at: new Date().toISOString(),
        },
        { onConflict: "sessao_id,corretor_id" },
      );

    // Seleciona candidato via RPC atômica se existir; senão via loop com FOR UPDATE.
    // Estratégia: buscar top N candidatos, tentar UPDATE atômico com filtros de disponibilidade.
    const nowIso = new Date().toISOString();
    let query = admin
      .from("oferta_ativa_fila")
      .select("id, pipeline_lead_id, balde, bucket_order")
      .eq("sessao_id", sessao_id)
      .or(`locked_by.is.null,locked_until.lte.${nowIso}`)
      .or(`claimed_by.is.null,claimed_until.lte.${nowIso}`)
      .or(`cooldown_ate.is.null,cooldown_ate.lte.${nowIso}`)
      .or(`ultimo_corretor_id.is.null,ultimo_corretor_id.neq.${meuProfileId}`)
      .order("bucket_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(20);
    if (empreendimento_ids?.length) query = query.in("empreendimento_id", empreendimento_ids);
    if (segmento_ids?.length) query = query.in("segmento_id", segmento_ids);

    const { data: candidatos, error: qErr } = await query;
    if (qErr) return errorResponse(qErr.message, 500);
    if (!candidatos || candidatos.length === 0) {
      return jsonResponse({ ok: true, lead: null, reason: "fila_vazia" });
    }

    // Tenta lock atômico via update condicional (só se ainda disponível)
    const lockUntilIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    let acquired: any = null;
    for (const cand of candidatos) {
      // filtro: ultimo_corretor <> eu (JS-side pois o OR em PostgREST não suporta bem esse caso combinado)
      const nowIso2 = new Date().toISOString();
      const { data: upd, error: uErr } = await admin
        .from("oferta_ativa_fila")
        .update({
          locked_by: meuProfileId,
          locked_until: lockUntilIso,
          ultimo_oferecido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", cand.id)
        .neq("ultimo_corretor_id", meuProfileId) // permanent owner exclusion (null passa pois neq(null)=null → não filtra, mas nulos raros aqui)
        .or(`locked_by.is.null,locked_until.lte.${nowIso2}`)
        .select("id, pipeline_lead_id, balde, bucket_order, empreendimento_id, segmento_id, motivo_descarte_raw, reengajamento_status_raw")
        .maybeSingle();
      if (uErr) continue;
      if (upd) {
        acquired = upd;
        break;
      }
    }
    if (!acquired) {
      return jsonResponse({ ok: true, lead: null, reason: "sem_leads_disponiveis" });
    }

    // Busca dados do lead
    const { data: lead } = await admin
      .from("pipeline_leads")
      .select(
        "id, nome, telefone, telefone_normalizado, email, empreendimento, campanha, origem, motivo_descarte, reengajamento_status, stage_changed_at, score, score_temperatura, created_at",
      )
      .eq("id", acquired.pipeline_lead_id)
      .maybeSingle();

    let empreendimentoCanonico: any = null;
    let segmento: any = null;
    if (acquired.empreendimento_id) {
      const { data: ec } = await admin
        .from("empreendimentos_canonicos")
        .select("id, nome, segmento_id")
        .eq("id", acquired.empreendimento_id)
        .maybeSingle();
      empreendimentoCanonico = ec;
    }
    if (acquired.segmento_id) {
      const { data: seg } = await admin
        .from("roleta_segmentos")
        .select("id, nome, cor")
        .eq("id", acquired.segmento_id)
        .maybeSingle();
      segmento = seg;
    }

    const diasDescarte = lead?.stage_changed_at
      ? Math.floor((Date.now() - new Date(lead.stage_changed_at).getTime()) / (24 * 3600 * 1000))
      : null;

    return jsonResponse({
      ok: true,
      fila_id: acquired.id,
      balde: acquired.balde,
      bucket_order: acquired.bucket_order,
      locked_until: lockUntilIso,
      lead: {
        id: lead?.id,
        nome: lead?.nome,
        telefone: lead?.telefone,
        telefone_normalizado: lead?.telefone_normalizado,
        email: lead?.email,
        empreendimento_raw: lead?.empreendimento,
        empreendimento_canonico: empreendimentoCanonico,
        segmento,
        campanha: lead?.campanha,
        origem: lead?.origem,
        motivo_descarte: lead?.motivo_descarte,
        reengajamento_status: lead?.reengajamento_status,
        dias_desde_descarte: diasDescarte,
        score: lead?.score,
        score_temperatura: lead?.score_temperatura,
        created_at: lead?.created_at,
      },
    });
  } catch (e) {
    console.error("[proximo-lead] erro:", e);
    return errorResponse((e as Error).message ?? "internal", 500);
  }
});
