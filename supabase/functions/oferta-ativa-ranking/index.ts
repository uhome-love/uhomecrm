// oferta-ativa-ranking — Fase 1
// Agrega ranking por corretor e equipe. verify_jwt=true.

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

    const body = await req.json().catch(() => ({}));
    const sessao_id: string | undefined = body?.sessao_id;
    if (!sessao_id) return errorResponse("sessao_id required", 400);

    // Escopo: admin/diretor veem tudo; gestor vê seu time + ele; corretor vê ranking geral (leitura pública dentro da sessão).
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isAdmin = roleSet.has("admin") || roleSet.has("diretor");
    const isGestor = roleSet.has("gestor");

    let query = admin
      .from("oferta_ativa_participantes")
      .select(
        "corretor_id, gerente_id, equipe_text, pontos, ligacoes_count, aproveitamentos_count, visitas_count, status_online, ultima_acao_at, profiles:corretor_id(nome, foto_url)",
      )
      .eq("sessao_id", sessao_id);

    if (isGestor && !isAdmin) {
      const { data: gp } = await admin
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (gp?.id) query = query.or(`gerente_id.eq.${gp.id},corretor_id.eq.${gp.id}`);
    }

    const { data: parts, error } = await query;
    if (error) return errorResponse(error.message, 500);

    const corretores = (parts ?? [])
      .map((p: any) => ({
        corretor_id: p.corretor_id,
        nome: p.profiles?.nome ?? "—",
        foto_url: p.profiles?.foto_url ?? null,
        gerente_id: p.gerente_id,
        equipe: p.equipe_text,
        pontos: p.pontos ?? 0,
        ligacoes: p.ligacoes_count ?? 0,
        aproveitamentos: p.aproveitamentos_count ?? 0,
        visitas: p.visitas_count ?? 0,
        status_online: p.status_online,
        ultima_acao_at: p.ultima_acao_at,
      }))
      .sort((a, b) => b.pontos - a.pontos);

    // Agrega por equipe
    const equipeMap = new Map<string, any>();
    for (const c of corretores) {
      const key = c.equipe ?? c.gerente_id ?? "sem_equipe";
      const cur = equipeMap.get(key) ?? {
        equipe: c.equipe ?? "Sem equipe",
        gerente_id: c.gerente_id,
        pontos: 0,
        ligacoes: 0,
        aproveitamentos: 0,
        visitas: 0,
        corretores: 0,
      };
      cur.pontos += c.pontos;
      cur.ligacoes += c.ligacoes;
      cur.aproveitamentos += c.aproveitamentos;
      cur.visitas += c.visitas;
      cur.corretores += 1;
      equipeMap.set(key, cur);
    }
    const equipes = Array.from(equipeMap.values()).sort((a, b) => b.pontos - a.pontos);

    return jsonResponse({ ok: true, corretores, equipes });
  } catch (e) {
    console.error("[ranking] erro:", e);
    return errorResponse((e as Error).message ?? "internal", 500);
  }
});
