// oferta-ativa-proximo-lead — RPC estendida (lock + dados do lead + emp/segmento em 1 chamada).
// Corretor. verify_jwt=true.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
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

    const body = await req.json().catch(() => ({}));
    const sessao_id: string | undefined = body?.sessao_id;
    const empreendimento_ids: string[] = Array.isArray(body?.empreendimento_ids) ? body.empreendimento_ids : [];
    const segmento_ids: string[] = Array.isArray(body?.segmento_ids) ? body.segmento_ids : [];
    if (!sessao_id) return errorResponse("sessao_id required", 400);

    // profile + sessão + team em paralelo
    const [profRes, sessaoRes, teamRes] = await Promise.all([
      admin.from("profiles").select("id, nome").eq("user_id", userId).maybeSingle(),
      admin.from("oferta_ativa_sessoes").select("id, status, inicio_at, fim_at").eq("id", sessao_id).maybeSingle(),
      admin.from("team_members").select("gerente_id, equipe").eq("user_id", userId).eq("status", "ativo").maybeSingle(),
    ]);

    const prof = profRes.data;
    if (!prof) return errorResponse("profile not found", 404);
    const meuProfileId = prof.id as string;

    const sessao = sessaoRes.data;
    if (!sessao) return errorResponse("sessao not found", 404);
    if (sessao.status !== "ao_vivo") return errorResponse("sessao não está ao vivo", 409);
    const now = new Date();
    if (new Date(sessao.inicio_at) > now || new Date(sessao.fim_at) < now) {
      return errorResponse("sessao fora da janela", 409);
    }

    // Heartbeat participante (fire-and-forget, não bloqueia lock)
    const teamRow = teamRes.data;
    (async () => {
      let gerenteProfileId: string | null = null;
      if (teamRow?.gerente_id) {
        const { data: gp } = await admin.from("profiles").select("id").eq("user_id", teamRow.gerente_id).maybeSingle();
        gerenteProfileId = gp?.id ?? null;
      }
      await admin.from("oferta_ativa_participantes").upsert(
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
    })().catch(() => {});

    // Lock atômico via RPC estendida (retorna lead + emp + segmento numa chamada)
    const { data: rpcRows, error: rpcErr } = await admin.rpc("oferta_ativa_lock_next_lead", {
      p_sessao_id: sessao_id,
      p_corretor_id: meuProfileId,
      p_empreendimento_ids: empreendimento_ids,
      p_segmento_ids: segmento_ids,
    });
    if (rpcErr) return errorResponse(rpcErr.message, 500);

    const r = Array.isArray(rpcRows) && rpcRows.length > 0 ? (rpcRows[0] as any) : null;
    if (!r) {
      return jsonResponse({ ok: true, lead: null, reason: "fila_vazia" });
    }

    return jsonResponse({
      ok: true,
      fila_id: r.id,
      balde: r.balde,
      bucket_order: r.bucket_order,
      locked_until: r.locked_until,
      lead: {
        id: r.pipeline_lead_id,
        nome: r.lead_nome,
        telefone: r.lead_telefone,
        telefone_normalizado: r.lead_telefone_normalizado,
        email: r.lead_email,
        empreendimento_raw: r.lead_empreendimento_raw,
        empreendimento_canonico: r.empreendimento_id
          ? { id: r.empreendimento_id, nome: r.empreendimento_nome, segmento_id: r.empreendimento_segmento_id }
          : null,
        segmento: r.segmento_id
          ? { id: r.segmento_id, nome: r.segmento_nome, cor: r.segmento_cor }
          : null,
        campanha: r.lead_campanha,
        origem: r.lead_origem,
        motivo_descarte: r.lead_motivo_descarte,
        reengajamento_status: r.lead_reengajamento_status,
        stage_changed_at: r.lead_stage_changed_at,
        dias_desde_descarte: r.lead_dias_desde_descarte,
        score: r.lead_score,
        score_temperatura: r.lead_temperatura,
        created_at: r.lead_created_at,
      },
    });
  } catch (e) {
    console.error("[proximo-lead] erro:", e);
    return errorResponse((e as Error).message ?? "internal", 500);
  }
});
