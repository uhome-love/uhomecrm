// oferta-ativa-historico-reaproveitar — Fase 1
// Lista leads que o corretor logado marcou como 'nao_atendeu' nas últimas 24h
// e que ainda não viraram aproveitado/visita, para permitir reabrir.

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

    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prof) return errorResponse("profile not found", 404);
    const meuProfileId = prof.id as string;

    const urlObj = new URL(req.url);
    const sessao_id = urlObj.searchParams.get("sessao_id") ??
      (await req.json().catch(() => ({})))?.sessao_id;
    if (!sessao_id) return errorResponse("sessao_id required", 400);

    const cutoffIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    // Pega todas ligações minhas na sessão nas últimas 24h
    const { data: ligs, error } = await admin
      .from("oferta_ativa_ligacoes")
      .select("id, pipeline_lead_id, resultado, observacao, created_at")
      .eq("sessao_id", sessao_id)
      .eq("corretor_id", meuProfileId)
      .gte("created_at", cutoffIso)
      .order("created_at", { ascending: false });
    if (error) return errorResponse(error.message, 500);

    // Filtra: manter último resultado por lead; só listar quando último foi nao_atendeu
    const byLead = new Map<string, any>();
    for (const l of ligs ?? []) {
      if (!byLead.has(l.pipeline_lead_id)) byLead.set(l.pipeline_lead_id, l);
    }
    const naoAtendeu = Array.from(byLead.values()).filter(
      (l) => l.resultado === "nao_atendeu",
    );

    if (naoAtendeu.length === 0) return jsonResponse({ ok: true, itens: [] });

    // Enriquece com pipeline_lead + fila (para saber se ainda está disponível)
    const leadIds = naoAtendeu.map((l) => l.pipeline_lead_id);
    const { data: leads } = await admin
      .from("pipeline_leads")
      .select("id, nome, telefone, empreendimento, motivo_descarte")
      .in("id", leadIds);
    const leadMap = new Map((leads ?? []).map((l: any) => [l.id, l]));

    const { data: filaRows } = await admin
      .from("oferta_ativa_fila")
      .select("id, pipeline_lead_id, cooldown_ate, locked_by, locked_until")
      .eq("sessao_id", sessao_id)
      .in("pipeline_lead_id", leadIds);
    const filaMap = new Map((filaRows ?? []).map((f: any) => [f.pipeline_lead_id, f]));

    const itens = naoAtendeu.map((l) => {
      const lead = leadMap.get(l.pipeline_lead_id);
      const fila = filaMap.get(l.pipeline_lead_id);
      const cooldownAtiva = fila?.cooldown_ate && new Date(fila.cooldown_ate) > new Date();
      return {
        ligacao_id: l.id,
        fila_id: fila?.id ?? null,
        pipeline_lead_id: l.pipeline_lead_id,
        nome: lead?.nome ?? "—",
        telefone: lead?.telefone ?? null,
        empreendimento: lead?.empreendimento ?? null,
        motivo_descarte: lead?.motivo_descarte ?? null,
        observacao: l.observacao,
        ligacao_em: l.created_at,
        na_fila: !!fila,
        pode_reabrir: !!fila && !cooldownAtiva,
        cooldown_ate: fila?.cooldown_ate ?? null,
      };
    });

    return jsonResponse({ ok: true, itens });
  } catch (e) {
    console.error("[historico-reaproveitar] erro:", e);
    return errorResponse((e as Error).message ?? "internal", 500);
  }
});
