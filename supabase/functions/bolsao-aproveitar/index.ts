// bolsao-aproveitar — invólucro fino: toda a regra de aproveitamento (trava por telefone, dono único,
// opt-out, reserva, reativação atômica) vive na função de banco `oa_aproveitar`. Mantido por compatibilidade.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const ERRO_LEGADO: Record<string, string> = {
  com_outro: "DUPLICATE_ACTIVE", comigo: "DUPLICATE_ACTIVE", duplicado: "DUPLICATE_ACTIVE",
  em_ligacao_com_outro: "RESERVA_DE_OUTRO", mexido: "RESERVA_DE_OUTRO", sem_ligacao: "RESERVA_DE_OUTRO",
  nao_elegivel: "NAO_ELEGIVEL", nao_encontrado: "NAO_ELEGIVEL", bloqueado: "CONTATO_BLOQUEADO",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const body = await req.json().catch(() => ({}));
    const leadId: string | undefined = typeof body?.pipeline_lead_id === "string" ? body.pipeline_lead_id : undefined;
    if (!leadId || !/^[0-9a-f-]{36}$/i.test(leadId)) return errorResponse("pipeline_lead_id required", 400);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: reserva } = await userClient.from("bolsao_reservas").select("porta").eq("pipeline_lead_id", leadId).maybeSingle();
    const origem = reserva?.porta === "descartados" ? "descartados" : "estagnados";
    const { data, error } = await userClient.rpc("oa_aproveitar", { p_origem: origem, p_lead_id: leadId, p_via: "ao_vivo" });
    if (error) return jsonResponse({ ok: false, error: "FALHA", detail: error.message }, 200);
    const r = data as { ok: boolean; status: string; pipeline_lead_id?: string; corretor_nome?: string };
    if (r.ok) return jsonResponse({ ok: true, pipeline_lead_id: r.pipeline_lead_id ?? leadId });
    return jsonResponse({ ok: false, error: ERRO_LEGADO[r.status] ?? "FALHA", status: r.status, corretor_nome: r.corretor_nome ?? null }, 200);
  } catch (e) {
    console.error("[bolsao-aproveitar]", e);
    return jsonResponse({ ok: false, error: "FALHA", detail: (e as Error).message ?? "internal" }, 200);
  }
});
