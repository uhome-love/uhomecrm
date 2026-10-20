// bolsao-aproveitar — corretor aproveita um lead reservado do Bolsão (estagnados/descartados).
// Valida a reserva ativa do próprio corretor e reutiliza reactivateLead (mesmo fluxo da Oferta Ativa).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { reactivateLead, NOVO_LEAD_STAGE_ID } from "../_shared/reactivateLead.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const leadId: string | undefined = body?.pipeline_lead_id;
    if (!leadId) return errorResponse("pipeline_lead_id required", 400);

    const { data: reserva } = await admin
      .from("bolsao_reservas")
      .select("corretor_id, reservado_ate")
      .eq("pipeline_lead_id", leadId)
      .maybeSingle();
    if (!reserva || reserva.corretor_id !== userId || !reserva.reservado_ate || new Date(reserva.reservado_ate) < new Date()) {
      return jsonResponse({ ok: false, error: "RESERVA_EXPIRADA" }, 409);
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
      return jsonResponse({ ok: false, error: "DUPLICATE_ACTIVE" }, 409);
    }
    if (!react.ok) return errorResponse(react.error ?? "falha ao aproveitar", 500);

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

    return jsonResponse({ ok: true, pipeline_lead_id: leadId });
  } catch (e) {
    console.error("[bolsao-aproveitar]", e);
    return errorResponse((e as Error).message ?? "internal", 500);
  }
});
