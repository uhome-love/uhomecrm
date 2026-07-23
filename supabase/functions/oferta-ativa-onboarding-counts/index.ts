// oferta-ativa-onboarding-counts — conta leads DISPONÍVEIS na fila por
// empreendimento_id e segmento_id, para exibir no OnboardingModal.

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
    if (!sessao_id) return errorResponse("sessao_id required", 400);

    // Resolve profile do corretor
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    const meuProfileId = prof?.id ?? null;

    const nowIso = new Date().toISOString();

    // Paginação: pega todas as linhas disponíveis da fila (>1000 é comum)
    const pageSize = 1000;
    let from = 0;
    const empCounts = new Map<string, number>();
    const segCounts = new Map<string, number>();

    while (true) {
      let q = admin
        .from("oferta_ativa_fila")
        .select("empreendimento_id, segmento_id, locked_by, locked_until, claimed_by, claimed_until, cooldown_ate, ultimo_corretor_id")
        .eq("sessao_id", sessao_id)
        .or(`locked_by.is.null,locked_until.lte.${nowIso}`)
        .or(`claimed_by.is.null,claimed_until.lte.${nowIso}`)
        .or(`cooldown_ate.is.null,cooldown_ate.lte.${nowIso}`)
        .range(from, from + pageSize - 1);

      const { data, error } = await q;
      if (error) return errorResponse(error.message, 500);
      if (!data || data.length === 0) break;

      for (const r of data) {
        // Filtra "meu último dono" no JS (evita OR combinado difícil no PostgREST)
        if (meuProfileId && r.ultimo_corretor_id === meuProfileId) continue;
        if (r.empreendimento_id) {
          empCounts.set(r.empreendimento_id, (empCounts.get(r.empreendimento_id) ?? 0) + 1);
        }
        if (r.segmento_id) {
          segCounts.set(r.segmento_id, (segCounts.get(r.segmento_id) ?? 0) + 1);
        }
      }

      if (data.length < pageSize) break;
      from += pageSize;
    }

    return jsonResponse({
      ok: true,
      empreendimentos: [...empCounts.entries()].map(([id, count]) => ({ id, count })),
      segmentos: [...segCounts.entries()].map(([id, count]) => ({ id, count })),
    });
  } catch (e) {
    console.error("[onboarding-counts] erro:", e);
    return errorResponse((e as Error).message ?? "internal", 500);
  }
});
