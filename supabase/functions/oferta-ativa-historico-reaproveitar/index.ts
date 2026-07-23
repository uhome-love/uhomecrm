// oferta-ativa-historico-reaproveitar — Fase 2
// Lista TODAS as interações do corretor (ligações, pulos, aproveitamentos, visitas)
// na sessão nas últimas 24h, com status de disponibilidade para o botão "Aproveitar".
// Disponibilidade usa o MESMO dedup por telefone_normalizado do registrar-resultado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import {
  reactivateLead,
  NOVO_LEAD_STAGE_ID,
  DESCARTE_STAGE_ID,
} from "../_shared/reactivateLead.ts";

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
    const meuAuthId = userId;

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? "list";
    const sessao_id: string | undefined = body?.sessao_id;
    if (!sessao_id) return errorResponse("sessao_id required", 400);

    // ─── Ação: aproveitar um item do histórico ───
    if (action === "aproveitar") {
      const pipeline_lead_id: string | undefined = body?.pipeline_lead_id;
      if (!pipeline_lead_id) return errorResponse("pipeline_lead_id required", 400);

      const react = await reactivateLead(admin, {
        pipeline_lead_id,
        corretor_auth_id: meuAuthId,
        corretor_profile_id: meuProfileId,
        target_stage_id: NOVO_LEAD_STAGE_ID,
      });
      if (!react.ok && react.duplicate_lead_id) {
        return jsonResponse(
          { ok: false, error: "DUPLICATE_ACTIVE", duplicate_lead_id: react.duplicate_lead_id },
          409,
        );
      }
      if (!react.ok) return errorResponse(react.error ?? "reativar lead falhou", 500);

      // Remove da fila se ainda estiver lá
      await admin
        .from("oferta_ativa_fila")
        .delete()
        .eq("sessao_id", sessao_id)
        .eq("pipeline_lead_id", pipeline_lead_id);

      // Registra evento no feed
      const { data: profNome } = await admin.from("profiles").select("nome").eq("id", meuProfileId).maybeSingle();
      await admin.from("pulse_events").insert({
        tipo: "oa_aproveitado",
        corretor_id: meuProfileId,
        titulo: `${profNome?.nome ?? "Corretor"} aproveitou pelo histórico`,
        descricao: null,
        metadata: { sessao_id, pipeline_lead_id, pontos: 4, balde: null, via: "historico" },
      });

      return jsonResponse({ ok: true, reactivated: true, target_stage_name: "Novo Lead", pipeline_lead_id });
    }

    // ─── Ação padrão: list ───
    const cutoffIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const { data: ligs, error } = await admin
      .from("oferta_ativa_ligacoes")
      .select("id, pipeline_lead_id, resultado, observacao, created_at")
      .eq("sessao_id", sessao_id)
      .eq("corretor_id", meuProfileId)
      .gte("created_at", cutoffIso)
      .order("created_at", { ascending: false });
    if (error) return errorResponse(error.message, 500);

    if (!ligs || ligs.length === 0) return jsonResponse({ ok: true, itens: [] });

    // Mantém último resultado por lead (o mais recente)
    const byLead = new Map<string, any>();
    for (const l of ligs) {
      if (!byLead.has(l.pipeline_lead_id)) byLead.set(l.pipeline_lead_id, l);
    }
    const itensLig = Array.from(byLead.values());

    const leadIds = itensLig.map((l) => l.pipeline_lead_id);
    const { data: leads } = await admin
      .from("pipeline_leads")
      .select("id, nome, telefone, telefone_normalizado, empreendimento, motivo_descarte")
      .in("id", leadIds);
    const leadMap = new Map((leads ?? []).map((l: any) => [l.id, l]));

    // Dedup por telefone: existe OUTRO lead ATIVO (arquivado=false, fora do descarte)
    // com o mesmo telefone_normalizado? Ignora a própria linha descartada (mesmo id).
    // Sem telefone_normalizado → tratado como disponível.
    const leadIdSet = new Set<string>((leads ?? []).map((l: any) => l.id));
    const phones = (leads ?? [])
      .map((l: any) => l.telefone_normalizado)
      .filter((p): p is string => !!p);
    const duplicateSet = new Set<string>();
    if (phones.length > 0) {
      const { data: dupRows } = await admin
        .from("pipeline_leads")
        .select("id, telefone_normalizado")
        .in("telefone_normalizado", phones)
        .neq("stage_id", DESCARTE_STAGE_ID)
        .eq("arquivado", false);
      for (const d of dupRows ?? []) {
        if (leadIdSet.has(d.id)) continue; // ignora a(s) própria(s) linha(s) do histórico
        if (d.telefone_normalizado) duplicateSet.add(d.telefone_normalizado);
      }
    }

    const itens = itensLig.map((l) => {
      const lead = leadMap.get(l.pipeline_lead_id);
      const phone = lead?.telefone_normalizado ?? null;
      const jaAtribuido = !!(phone && duplicateSet.has(phone));
      return {
        ligacao_id: l.id,
        pipeline_lead_id: l.pipeline_lead_id,
        nome: lead?.nome ?? "—",
        telefone: lead?.telefone ?? null,
        empreendimento: lead?.empreendimento ?? null,
        motivo_descarte: lead?.motivo_descarte ?? null,
        resultado: l.resultado,
        observacao: l.observacao,
        ligacao_em: l.created_at,
        pode_aproveitar: !jaAtribuido,
        motivo_indisponivel: jaAtribuido ? "ja_atribuido" : null,
      };
    });

    return jsonResponse({ ok: true, itens });
  } catch (e) {
    console.error("[historico-reaproveitar] erro:", e);
    return errorResponse((e as Error).message ?? "internal", 500);
  }
});
