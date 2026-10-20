// bolsao-aproveitar — corretor aproveita um lead reservado do Bolsão (estagnados/descartados).
// Também aceita { acao: "renovar" } para estender a reserva enquanto o cliente está aberto na tela.
// Reserva vencida do próprio corretor ainda pode ser aproveitada se ninguém mais puxou e o lead segue elegível.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { reactivateLead, NOVO_LEAD_STAGE_ID } from "../_shared/reactivateLead.ts";

const RESERVA_MIN = 5;

async function logEvento(admin: SupabaseClient, level: string, message: string, ctx: Record<string, unknown>) {
  try {
    await admin.from("ops_events").insert({ fn: "bolsao-aproveitar", level, category: "bolsao", message, ctx });
  } catch (_) { /* log nunca derruba o fluxo */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  let admin: SupabaseClient | null = null;
  let ctx: Record<string, unknown> = {};
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const leadId: string | undefined = typeof body?.pipeline_lead_id === "string" ? body.pipeline_lead_id : undefined;
    const acao = body?.acao === "renovar" ? "renovar" : "aproveitar";
    if (!leadId || !/^[0-9a-f-]{36}$/i.test(leadId)) return errorResponse("pipeline_lead_id required", 400);
    ctx = { lead_id: leadId, user_id: userId, acao };

    const { data: reserva } = await admin
      .from("bolsao_reservas")
      .select("corretor_id, reservado_ate, porta, ultimo_resultado")
      .eq("pipeline_lead_id", leadId)
      .maybeSingle();

    const agora = new Date();
    const ativa = !!reserva?.reservado_ate && new Date(reserva.reservado_ate) > agora;
    const minha = reserva?.corretor_id === userId;

    if (!reserva || (!minha && ativa)) {
      await logEvento(admin, "warn", "Reserva de outro corretor", ctx);
      return jsonResponse({ ok: false, error: "RESERVA_DE_OUTRO" }, 200);
    }
    if (!minha) {
      await logEvento(admin, "warn", "Reserva não pertence ao corretor", ctx);
      return jsonResponse({ ok: false, error: "RESERVA_DE_OUTRO" }, 200);
    }
    if (reserva.ultimo_resultado === "aproveitado") {
      return jsonResponse({ ok: true, pipeline_lead_id: leadId, ja_aproveitado: true }, 200);
    }

    // Reserva vencida: só segue se o lead ainda é elegível na mesma porta.
    if (!ativa) {
      const { data: eleg, error: elegErr } = await admin.rpc("bolsao_elegiveis", { p_porta: reserva.porta });
      if (elegErr) throw elegErr;
      const aindaElegivel = (eleg ?? []).some((r: { lead_id: string }) => r.lead_id === leadId);
      if (!aindaElegivel) {
        await logEvento(admin, "warn", "Reserva vencida e lead não elegível", ctx);
        return jsonResponse({ ok: false, error: "NAO_ELEGIVEL" }, 200);
      }
    }

    if (acao === "renovar") {
      const ate = new Date(agora.getTime() + RESERVA_MIN * 60_000).toISOString();
      await admin.from("bolsao_reservas").update({ reservado_ate: ate, updated_at: agora.toISOString() })
        .eq("pipeline_lead_id", leadId).eq("corretor_id", userId);
      return jsonResponse({ ok: true, reservado_ate: ate }, 200);
    }

    const { data: prof } = await admin.from("profiles").select("id").eq("user_id", userId).maybeSingle();
    if (!prof) return errorResponse("profile not found", 404);

    const react = await reactivateLead(admin, {
      pipeline_lead_id: leadId,
      corretor_auth_id: userId,
      corretor_profile_id: prof.id as string,
      target_stage_id: NOVO_LEAD_STAGE_ID,
    });
    if (!react.ok && react.duplicate_lead_id) {
      await logEvento(admin, "warn", "Telefone ativo com outro corretor", { ...ctx, duplicate: react.duplicate_lead_id });
      return jsonResponse({ ok: false, error: "DUPLICATE_ACTIVE" }, 200);
    }
    if (!react.ok) {
      await logEvento(admin, "error", "Falha ao reativar lead", { ...ctx, error: react.error });
      return jsonResponse({ ok: false, error: "FALHA", detail: react.error ?? null }, 200);
    }

    const now = new Date().toISOString();
    await admin.from("pipeline_leads").update({
      reaproveitado_em: now,
      estagnado: false,
      estagnado_em: null,
      estagnado_aviso_em: null,
      estagnado_prazo_em: null,
      ultimo_toque_at: now,
    }).eq("id", leadId);

    await admin.from("bolsao_reservas").update({
      reservado_ate: null,
      ultimo_resultado: "aproveitado",
      updated_at: now,
    }).eq("pipeline_lead_id", leadId);

    await logEvento(admin, "info", "Lead aproveitado", { ...ctx, reserva_vencida: !ativa });
    return jsonResponse({ ok: true, pipeline_lead_id: leadId });
  } catch (e) {
    console.error("[bolsao-aproveitar]", e);
    if (admin) await logEvento(admin, "error", "Erro inesperado", { ...ctx, error: (e as Error).message });
    return jsonResponse({ ok: false, error: "FALHA", detail: (e as Error).message ?? "internal" }, 200);
  }
});
