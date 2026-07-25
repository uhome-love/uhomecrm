// oferta-ativa-reservar — Onda 3 · Reservados
// Ações unificadas sobre `oferta_ativa_reservados`:
//   POST { action: "reservar", pipeline_lead_id, tipo, agendado_para?, observacao?, lista_id? }
//   POST { action: "devolver", reservado_id, motivo? }
//   POST { action: "reagendar", reservado_id, agendado_para }
// Regras:
//   - Corretor só age nos seus próprios reservados.
//   - Máximo 20 "separado" ativos por corretor.
//   - Um lead não pode ter 2 reservas ativas do mesmo corretor.
//   - tipo='retorno' exige agendado_para.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const LIMITE_SEPARADOS = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

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

    const body = await req.json().catch(() => ({}));
    const { action } = body ?? {};

    if (action === "reservar") {
      const { pipeline_lead_id, tipo, agendado_para, observacao, lista_id } = body;
      if (!pipeline_lead_id || !tipo) {
        return errorResponse("pipeline_lead_id e tipo obrigatórios", 400);
      }
      if (tipo !== "retorno" && tipo !== "separado") {
        return errorResponse("tipo inválido (retorno|separado)", 400);
      }
      if (tipo === "retorno" && !agendado_para) {
        return errorResponse("agendado_para obrigatório para retorno", 400);
      }

      // Já tem reserva ativa deste corretor pra esse lead?
      const { data: existente } = await admin
        .from("oferta_ativa_reservados")
        .select("id, tipo")
        .eq("pipeline_lead_id", pipeline_lead_id)
        .eq("corretor_id", meuProfileId)
        .is("devolvido_at", null)
        .maybeSingle();
      if (existente) {
        return jsonResponse(
          { ok: false, code: "JA_RESERVADO", reservado_id: existente.id, tipo: existente.tipo },
          409,
        );
      }

      // Limite de 20 separados
      if (tipo === "separado") {
        const { count } = await admin
          .from("oferta_ativa_reservados")
          .select("id", { count: "exact", head: true })
          .eq("corretor_id", meuProfileId)
          .eq("tipo", "separado")
          .is("devolvido_at", null);
        if ((count ?? 0) >= LIMITE_SEPARADOS) {
          return jsonResponse(
            { ok: false, code: "LIMITE_SEPARADOS", limite: LIMITE_SEPARADOS },
            409,
          );
        }
      }

      const { data: ins, error: insErr } = await admin
        .from("oferta_ativa_reservados")
        .insert({
          pipeline_lead_id,
          corretor_id: meuProfileId,
          tipo,
          agendado_para: agendado_para ?? null,
          observacao: observacao ?? null,
          lista_id: lista_id ?? null,
        })
        .select("id")
        .maybeSingle();
      if (insErr) return errorResponse(`insert: ${insErr.message}`, 500);
      return jsonResponse({ ok: true, id: ins?.id });
    }

    if (action === "devolver") {
      const { reservado_id, motivo } = body;
      if (!reservado_id) return errorResponse("reservado_id obrigatório", 400);

      // Confere ownership
      const { data: row } = await admin
        .from("oferta_ativa_reservados")
        .select("id, corretor_id, devolvido_at")
        .eq("id", reservado_id)
        .maybeSingle();
      if (!row) return errorResponse("reservado não encontrado", 404);
      if (row.corretor_id !== meuProfileId) return errorResponse("sem permissão", 403);
      if (row.devolvido_at) return jsonResponse({ ok: true, code: "JA_DEVOLVIDO" });

      const { error: updErr } = await admin
        .from("oferta_ativa_reservados")
        .update({
          devolvido_at: new Date().toISOString(),
          devolvido_motivo: motivo ?? "manual",
        })
        .eq("id", reservado_id);
      if (updErr) return errorResponse(`update: ${updErr.message}`, 500);
      return jsonResponse({ ok: true });
    }

    if (action === "reagendar") {
      const { reservado_id, agendado_para } = body;
      if (!reservado_id || !agendado_para) {
        return errorResponse("reservado_id e agendado_para obrigatórios", 400);
      }
      const { data: row } = await admin
        .from("oferta_ativa_reservados")
        .select("id, corretor_id, devolvido_at, tipo")
        .eq("id", reservado_id)
        .maybeSingle();
      if (!row) return errorResponse("reservado não encontrado", 404);
      if (row.corretor_id !== meuProfileId) return errorResponse("sem permissão", 403);
      if (row.devolvido_at) return errorResponse("reserva já devolvida", 409);
      if (row.tipo !== "retorno") {
        return errorResponse("só retornos podem ser reagendados", 400);
      }

      const { error: updErr } = await admin
        .from("oferta_ativa_reservados")
        .update({ agendado_para })
        .eq("id", reservado_id);
      if (updErr) return errorResponse(`update: ${updErr.message}`, 500);
      return jsonResponse({ ok: true });
    }

    return errorResponse("action inválida (reservar|devolver|reagendar)", 400);
  } catch (e) {
    console.error("[oferta-ativa-reservar] erro:", (e as Error).message);
    return errorResponse((e as Error).message, 500);
  }
});
