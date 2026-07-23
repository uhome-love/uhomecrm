// oferta-ativa-participantes — Fase 1
// GET (?sessao_id=...) → lista participantes com status derivado.
// POST → heartbeat do corretor logado.
// verify_jwt=true.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const OCIOSO_MIN = 10; // sem ação > 10min = ocioso
const OFFLINE_MIN = 2; // heartbeat > 2min sem chegar = offline

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

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const sessao_id: string | undefined = body?.sessao_id;
      if (!sessao_id) return errorResponse("sessao_id required", 400);

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
            ultimo_heartbeat_at: new Date().toISOString(),
            status_online: "online",
          },
          { onConflict: "sessao_id,corretor_id" },
        );

      return jsonResponse({ ok: true });
    }

    // GET
    const urlObj = new URL(req.url);
    const sessao_id = urlObj.searchParams.get("sessao_id");
    if (!sessao_id) return errorResponse("sessao_id required", 400);

    const { data: parts, error } = await admin
      .from("oferta_ativa_participantes")
      .select(
        "id, corretor_id, gerente_id, equipe_text, status_online, ultima_acao_at, ultimo_heartbeat_at, ligacoes_count, aproveitamentos_count, visitas_count, pontos, profiles:corretor_id(nome, avatar_url)",
      )
      .eq("sessao_id", sessao_id);
    if (error) return errorResponse(error.message, 500);

    const now = Date.now();
    const enriched = (parts ?? []).map((p: any) => {
      const lastAction = p.ultima_acao_at ? new Date(p.ultima_acao_at).getTime() : 0;
      const lastHb = p.ultimo_heartbeat_at ? new Date(p.ultimo_heartbeat_at).getTime() : 0;
      const minSinceHb = lastHb ? (now - lastHb) / 60000 : Infinity;
      const minSinceAction = lastAction ? (now - lastAction) / 60000 : Infinity;

      let derived: string = p.status_online ?? "offline";
      if (minSinceHb > OFFLINE_MIN) derived = "offline";
      else if (minSinceAction > OCIOSO_MIN) derived = "ocioso";
      else derived = "online";

      return {
        corretor_id: p.corretor_id,
        nome: p.profiles?.nome ?? "—",
        foto_url: p.profiles?.foto_url ?? null,
        gerente_id: p.gerente_id,
        equipe: p.equipe_text,
        status_online: derived,
        ultima_acao_at: p.ultima_acao_at,
        ultimo_heartbeat_at: p.ultimo_heartbeat_at,
        ligacoes: p.ligacoes_count ?? 0,
        aproveitamentos: p.aproveitamentos_count ?? 0,
        visitas: p.visitas_count ?? 0,
        pontos: p.pontos ?? 0,
      };
    });

    return jsonResponse({ ok: true, participantes: enriched });
  } catch (e) {
    console.error("[participantes] erro:", e);
    return errorResponse((e as Error).message ?? "internal", 500);
  }
});
