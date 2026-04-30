/**
 * vitrine-bridge — endpoint único do CRM para criar/listar/ler vitrines no banco do site.
 *
 * Por que existe:
 *   - Antes, o CRM inseria vitrines com a anon key do site (supabaseSite). RLS deixava passar
 *     com corretor_id/created_by NULL → "Minhas Vitrines" ficava vazia e o corretor não
 *     aparecia na vitrine pública. ~302 registros órfãos foram criados desse jeito.
 *   - Agora toda criação passa por aqui: validamos o JWT do CRM, resolvemos o profile do
 *     corretor no banco do site (uhomesales_id == auth.users.id, fallback por email),
 *     e gravamos com service role bypass-RLS, garantindo FKs corretas.
 *
 * Actions:
 *   - create_vitrine   → cria vitrine vinculada ao usuário autenticado
 *   - list_vitrines    → lista vitrines do usuário (created_by = me)
 *   - get_vitrine      → busca vitrine por id (público; chamada do CRM admin)
 *   - track_event      → incrementa visualizacoes/cliques (chamada pública via /vitrine/:id)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const SITE_URL = Deno.env.get("UHOMESITE_URL");
const SITE_SERVICE_KEY = Deno.env.get("UHOMESITE_SERVICE_KEY");
const PUBLIC_DOMAIN = "https://uhome.com.br";

function siteClient() {
  if (!SITE_URL || !SITE_SERVICE_KEY) {
    throw new Error("UHOMESITE_URL/UHOMESITE_SERVICE_KEY not configured");
  }
  return createClient(SITE_URL, SITE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function crmClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/**
 * Resolve site profile (id, slug_ref) for the authenticated CRM user.
 * Tries uhomesales_id == crm user.id first, then falls back to email.
 */
async function resolveSiteProfile(site: ReturnType<typeof siteClient>, crmUserId: string) {
  // Try by uhomesales_id
  const byId = await site
    .from("profiles")
    .select("id, slug_ref, nome, telefone, avatar_url")
    .eq("uhomesales_id", crmUserId)
    .maybeSingle();

  if (byId.data) return { profile: byId.data, matchedBy: "uhomesales_id" as const };

  // Fallback: lookup CRM auth user email and match by email on site profiles
  const crm = crmClient();
  const { data: userInfo } = await crm.auth.admin.getUserById(crmUserId);
  const email = userInfo?.user?.email;
  if (!email) return { profile: null, matchedBy: null };

  const byEmail = await site
    .from("profiles")
    .select("id, slug_ref, nome, telefone, avatar_url")
    .eq("email", email)
    .maybeSingle();

  if (byEmail.data) {
    // Best-effort backfill of uhomesales_id so future calls hit the fast path
    await site
      .from("profiles")
      .update({ uhomesales_id: crmUserId })
      .eq("id", byEmail.data.id);
    return { profile: byEmail.data, matchedBy: "email" as const };
  }

  return { profile: null, matchedBy: null };
}

/**
 * Build the snapshot of imoveis (resolvidos no momento da criação).
 * Garante que a vitrine renderiza mesmo se o imóvel sair do catálogo depois.
 */
async function buildImoveisSnapshot(codigos: string[]) {
  const result: Array<Record<string, unknown>> = [];
  if (!codigos.length) return result;

  // 1) properties (CRM)
  const crm = crmClient();
  const { data: crmProps } = await crm
    .from("properties")
    .select("codigo, titulo, bairro, cidade, dormitorios, suites, vagas, banheiros, area_privativa, area_total, valor_venda, fotos, fotos_full, empreendimento, latitude, longitude")
    .in("codigo", codigos)
    .eq("ativo", true);

  const found = new Set<string>();
  for (const p of crmProps ?? []) {
    found.add(p.codigo);
    const fotos = (p.fotos_full?.length ? p.fotos_full : p.fotos) ?? [];
    result.push({
      codigo: p.codigo,
      titulo: p.titulo,
      bairro: p.bairro,
      cidade: p.cidade,
      quartos: p.dormitorios,
      suites: p.suites,
      vagas: p.vagas,
      banheiros: p.banheiros,
      area: p.area_privativa ?? p.area_total,
      valor: p.valor_venda,
      empreendimento: p.empreendimento,
      lat: p.latitude,
      lng: p.longitude,
      fotos: fotos.slice(0, 10),
      _src: "crm_properties",
    });
  }

  // 2) site imoveis (fallback)
  const missing = codigos.filter((c) => !found.has(c));
  if (missing.length) {
    try {
      const site = siteClient();
      const { data: siteProps } = await site
        .from("imoveis")
        .select("id, jetimob_id, slug, titulo, bairro, cidade, preco, area_total, quartos, suites, vagas, banheiros, fotos, foto_principal, condominio_nome, latitude, longitude")
        .in("jetimob_id", missing);
      for (const p of siteProps ?? []) {
        const codigo = p.jetimob_id || String(p.id);
        found.add(codigo);
        const fotosRaw = Array.isArray(p.fotos) ? p.fotos : [];
        const fotos = fotosRaw
          .map((f: unknown) => (typeof f === "string" ? f : (f as { url?: string })?.url))
          .filter(Boolean)
          .slice(0, 10);
        if (!fotos.length && p.foto_principal) fotos.push(p.foto_principal);
        result.push({
          codigo,
          slug: p.slug,
          titulo: p.titulo ?? p.condominio_nome ?? `Imóvel ${codigo}`,
          bairro: p.bairro,
          cidade: p.cidade,
          quartos: p.quartos,
          suites: p.suites,
          vagas: p.vagas,
          banheiros: p.banheiros,
          area: p.area_total,
          valor: p.preco,
          empreendimento: p.condominio_nome,
          lat: p.latitude,
          lng: p.longitude,
          fotos,
          _src: "site_imoveis",
        });
      }
    } catch (e) {
      console.error("[vitrine-bridge] site imoveis fallback failed:", e);
    }
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  let body: { action?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const action = body.action;
  const payload = (body.payload ?? {}) as Record<string, unknown>;

  if (!action) return errorResponse("Missing action", 400);

  try {
    const site = siteClient();

    // ── PUBLIC: track_event (no auth required) ─────────────────────
    if (action === "track_event") {
      const id = payload.id as string;
      const tipo = (payload.tipo as string) ?? "view"; // 'view' | 'whatsapp'
      if (!id) return errorResponse("id required", 400);
      const col = tipo === "whatsapp" ? "cliques_whatsapp" : "visualizacoes";
      const { data: cur } = await site.from("vitrines").select(`id, ${col}`).eq("id", id).maybeSingle();
      if (!cur) return errorResponse("not found", 404);
      const next = (((cur as Record<string, number>)[col] ?? 0) as number) + 1;
      await site.from("vitrines").update({ [col]: next }).eq("id", id);
      return jsonResponse({ ok: true });
    }

    // ── PUBLIC: get_vitrine (admin/CRM page reuses same source as site) ──
    if (action === "get_vitrine") {
      const id = payload.id as string;
      if (!id) return errorResponse("id required", 400);
      // Select tolerante: imoveis_resolvidos só existe após a migration no site.
      // Tentamos primeiro com snapshot; se falhar (coluna inexistente), refazemos sem.
      let v: Record<string, unknown> | null = null;
      const withSnapshot = await site
        .from("vitrines")
        .select("id, titulo, subtitulo, mensagem, mensagem_corretor, created_at, tipo, imovel_codigos, imoveis_resolvidos, created_by, lead_nome, visualizacoes, cliques_whatsapp")
        .eq("id", id)
        .maybeSingle();

      console.log("[vitrine-bridge] get_vitrine", { id, withSnapshotError: withSnapshot.error?.message, hasData: !!withSnapshot.data, siteUrl: SITE_URL });
      if (withSnapshot.error) {
        const fallback = await site
          .from("vitrines")
          .select("id, titulo, subtitulo, mensagem, mensagem_corretor, created_at, tipo, imovel_codigos, created_by, lead_nome, visualizacoes, cliques_whatsapp")
          .eq("id", id)
          .maybeSingle();
        v = fallback.data;
      } else {
        v = withSnapshot.data;
      }

      if (!v) return errorResponse("Vitrine não encontrada", 404);

      // Prefer snapshot; fallback to live build for legacy rows.
      let imoveis = Array.isArray((v as { imoveis_resolvidos?: unknown }).imoveis_resolvidos)
        ? ((v as { imoveis_resolvidos: unknown[] }).imoveis_resolvidos as Record<string, unknown>[])
        : [];
      const codigosArr = (v as { imovel_codigos?: string[] }).imovel_codigos;
      if (!imoveis.length && Array.isArray(codigosArr) && codigosArr.length) {
        imoveis = await buildImoveisSnapshot(codigosArr);
      }

      const vv = v as Record<string, any>;
      let corretor: Record<string, unknown> | null = null;
      if (vv.created_by) {
        const { data: prof } = await site
          .from("profiles")
          .select("nome, telefone, avatar_url")
          .eq("uhomesales_id", vv.created_by)
          .maybeSingle();
        if (prof) corretor = prof;
      }

      return jsonResponse({
        vitrine: {
          id: vv.id,
          titulo: vv.titulo,
          subtitulo: vv.subtitulo,
          mensagem: vv.mensagem ?? vv.mensagem_corretor,
          created_at: vv.created_at,
          tipo: vv.tipo,
          lead_nome: vv.lead_nome,
          visualizacoes: vv.visualizacoes,
          cliques_whatsapp: vv.cliques_whatsapp,
        },
        corretor,
        imoveis,
      });
    }

    // ── AUTH'D actions ─────────────────────────────────────────────
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    if (action === "create_vitrine") {
      console.log("[vitrine-bridge] create_vitrine start", { userId, payloadKeys: Object.keys(payload) });
      const codigos = Array.isArray(payload.imovel_codigos) ? (payload.imovel_codigos as string[]) : [];
      if (!codigos.length) return errorResponse("imovel_codigos required", 400);

      let profile, matchedBy;
      try {
        const r = await resolveSiteProfile(site, userId);
        profile = r.profile; matchedBy = r.matchedBy;
      } catch (e) {
        console.error("[vitrine-bridge] resolveSiteProfile failed:", e);
        return jsonResponse({ error: `Erro ao resolver profile: ${e instanceof Error ? e.message : String(e)}` }, 500);
      }
      console.log("[vitrine-bridge] profile resolved", { matchedBy, hasProfile: !!profile });
      if (!profile) {
        return jsonResponse(
          {
            error: "Profile do corretor não encontrado no site. Avise o admin para sincronizar uhomesales_id.",
            crm_user_id: userId,
          },
          422,
        );
      }

      let snapshot: Array<Record<string, unknown>> = [];
      try {
        snapshot = await buildImoveisSnapshot(codigos);
      } catch (e) {
        console.error("[vitrine-bridge] buildImoveisSnapshot failed:", e);
        return jsonResponse({ error: `Erro ao montar snapshot: ${e instanceof Error ? e.message : String(e)}` }, 500);
      }
      const missing = codigos.filter((c) => !snapshot.find((s) => s.codigo === c));
      console.log("[vitrine-bridge] snapshot built", { codigos: codigos.length, snapshot: snapshot.length, missing: missing.length });

      const insertRow = {
        created_by: userId,             // CRM auth.users.id (filtro de "Minhas Vitrines")
        corretor_id: profile.id,        // FK → profiles.id no banco do site
        corretor_slug: profile.slug_ref ?? null,
        imovel_codigos: codigos,
        imoveis_resolvidos: snapshot,   // snapshot (vitrine continua viva mesmo se imóvel sumir)
        titulo: (payload.titulo as string) ?? "Seleção de imóveis",
        subtitulo: (payload.subtitulo as string) ?? null,
        mensagem: (payload.mensagem as string) ?? null,
        mensagem_corretor: (payload.mensagem_corretor as string) ?? null,
        tipo: (payload.tipo as string) ?? "property_selection",
        lead_id: (payload.lead_id as string) ?? null,
        lead_nome: (payload.lead_nome as string) ?? null,
        lead_telefone: (payload.lead_telefone as string) ?? null,
        pipeline_lead_id: (payload.pipeline_lead_id as string) ?? null,
      };

      const { data, error } = await site
        .from("vitrines")
        .insert(insertRow)
        .select("id")
        .single();

      if (error) {
        console.error("[vitrine-bridge] insert failed:", error);
        return jsonResponse({ error: error.message }, 500);
      }

      return jsonResponse({
        ok: true,
        id: data.id,
        public_url: `${PUBLIC_DOMAIN}/vitrine/${data.id}`,
        imoveis_count: snapshot.length,
        missing_codes: missing,
        profile_matched_by: matchedBy,
      });
    }

    if (action === "list_vitrines") {
      const limit = Math.min(Number(payload.limit ?? 50), 200);
      const { data, error } = await site
        .from("vitrines")
        .select("id, titulo, subtitulo, visualizacoes, cliques_whatsapp, created_at, imovel_codigos, lead_nome, tipo")
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true, vitrines: data ?? [] });
    }

    return errorResponse(`Unknown action: ${action}`, 400);
  } catch (e) {
    console.error("[vitrine-bridge] unexpected error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
