// oferta-ativa-devolucao-automatica — Onda 3 · Cron diário
// Devolve à base pública:
//   - "separado" com >30 dias sem contato (auto)
//   - "retorno" vencido há mais de 14 dias sem ação
// Autenticação: x-cron-secret ou service-role bearer.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireCronAuth } from "../_shared/cron-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  const denied = requireCronAuth(req);
  if (denied) return denied;

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const now = new Date();
    const cutoff30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
    const cutoff14 = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString();

    // 1) Separados >30d sem contato
    const { data: separados } = await admin
      .from("oferta_ativa_reservados")
      .select("id")
      .is("devolvido_at", null)
      .eq("tipo", "separado")
      .lt("created_at", cutoff30);

    // 2) Retornos vencidos há >14d sem ação
    const { data: retornosStale } = await admin
      .from("oferta_ativa_reservados")
      .select("id")
      .is("devolvido_at", null)
      .eq("tipo", "retorno")
      .lt("agendado_para", cutoff14);

    const idsSep = (separados ?? []).map((r) => r.id);
    const idsRet = (retornosStale ?? []).map((r) => r.id);

    if (idsSep.length) {
      await admin
        .from("oferta_ativa_reservados")
        .update({ devolvido_at: now.toISOString(), devolvido_motivo: "auto_30d" })
        .in("id", idsSep);
    }
    if (idsRet.length) {
      await admin
        .from("oferta_ativa_reservados")
        .update({ devolvido_at: now.toISOString(), devolvido_motivo: "auto_retorno_vencido" })
        .in("id", idsRet);
    }

    console.log("[oa-devolucao-automatica] devolvidos", {
      separados: idsSep.length,
      retornos_vencidos: idsRet.length,
    });

    return jsonResponse({
      ok: true,
      devolvidos_separados: idsSep.length,
      devolvidos_retornos_vencidos: idsRet.length,
    });
  } catch (e) {
    console.error("[oa-devolucao-automatica]", (e as Error).message);
    return errorResponse((e as Error).message, 500);
  }
});
