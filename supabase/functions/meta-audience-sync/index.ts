// meta-audience-sync — Sincronização de Público do Meta (Custom Audience)
//
// Escopo atual: PROBE (leitura de escopo do token) + DRY RUN (contagem elegível).
// A escrita real no Meta (criação de público / upload de usuários) ainda NÃO está
// habilitada — retorna 501 até a Fase 2 ser liberada.
//
// Auth: JWT de admin/diretor  OU  header x-cron-secret === CAPI_CRON_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const PAGE = 1000; // teto de linhas do PostgREST — paginação obrigatória

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Definicao = {
  segmento?: string;
  empreendimento_ids?: string[];
  lead_ids?: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---------- auth ----------
  const cronSecret = Deno.env.get("CAPI_CRON_SECRET");
  const providedCron = req.headers.get("x-cron-secret");
  const isCron = !!(cronSecret && providedCron && providedCron === cronSecret);

  if (!isCron) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await anon.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const uid = claims.claims.sub as string;
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    const { data: isDiretor } = await admin.rpc("has_role", { _user_id: uid, _role: "diretor" });
    if (!isAdmin && !isDiretor) return json({ error: "Forbidden" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const mode: string = body?.mode ?? "dry_run";
  const dryRun: boolean = body?.dry_run !== false;

  // ---------- credenciais Marketing API ----------
  const { data: settings } = await admin
    .from("integration_settings")
    .select("key, value")
    .in("key", ["meta_ads_access_token", "meta_ads_account_id"]);
  const map: Record<string, string> = {};
  (settings ?? []).forEach((s: any) => { map[s.key] = s.value; });

  let accessToken = map.meta_ads_access_token ?? "";
  if (accessToken === "vault:meta_ads_access_token") {
    const { data: vaultToken } = await admin.rpc("get_meta_ads_token_internal");
    accessToken = (vaultToken as string | null) ?? "";
  }
  const accountId = map.meta_ads_account_id ?? "";

  // ---------- PROBE: só leitura, nunca expõe o token ----------
  if (mode === "probe") {
    if (!accessToken || !accountId) return json({ error: "Meta Ads não configurado" }, 400);

    const out: Record<string, unknown> = { ad_account_id: accountId };

    try {
      const r = await fetch(
        `${META_BASE}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(accessToken)}`,
      );
      const j = await r.json();
      const d = j?.data ?? {};
      out.debug_token = {
        ok: r.ok,
        is_valid: d.is_valid ?? null,
        type: d.type ?? null,
        app_id: d.app_id ?? null,
        expires_at: d.expires_at ?? null,
        scopes: d.scopes ?? null,
        has_ads_management: Array.isArray(d.scopes) ? d.scopes.includes("ads_management") : null,
        error: j?.error?.message ?? null,
      };
    } catch (e) {
      out.debug_token = { ok: false, error: (e as Error).message };
    }

    try {
      const r = await fetch(
        `${META_BASE}/${accountId}/customaudiences?limit=1&fields=id,name,subtype,approximate_count_lower_bound&access_token=${encodeURIComponent(accessToken)}`,
      );
      const j = await r.json();
      out.list_customaudiences = {
        status: r.status,
        ok: r.ok,
        count: Array.isArray(j?.data) ? j.data.length : null,
        error: j?.error
          ? {
            message: j.error.message,
            code: j.error.code,
            subcode: j.error.error_subcode,
            user_title: j.error.error_user_title,
          }
          : null,
      };
    } catch (e) {
      out.list_customaudiences = { ok: false, error: (e as Error).message };
    }

    try {
      const r = await fetch(
        `${META_BASE}/${accountId}?fields=id,name,business,tos_accepted&access_token=${encodeURIComponent(accessToken)}`,
      );
      const j = await r.json();
      out.account = {
        ok: r.ok,
        name: j?.name ?? null,
        business_id: j?.business?.id ?? null,
        business_name: j?.business?.name ?? null,
        tos_accepted: j?.tos_accepted ?? null,
        error: j?.error?.message ?? null,
      };
    } catch (e) {
      out.account = { ok: false, error: (e as Error).message };
    }

    return json({ ok: true, mode: "probe", ...out });
  }

  // ---------- resolve segmento ----------
  const segmentoChave: string | undefined = body?.segmento_chave;
  let definicao: Definicao | null = body?.definicao ?? null;
  let audienceId: string | null = null;

  if (segmentoChave) {
    const { data: aud, error } = await admin
      .from("meta_audiences")
      .select("id, definicao")
      .eq("segmento_chave", segmentoChave)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!aud) return json({ error: `segmento_chave desconhecido: ${segmentoChave}` }, 404);
    audienceId = aud.id;
    definicao = (aud.definicao ?? {}) as Definicao;
  }

  if (!definicao) return json({ error: "informe segmento_chave ou definicao" }, 400);

  // ---------- coleta hasheada, paginada ----------
  const membros: Array<[string, string]> = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.rpc("rpc_meta_audience_membros", {
      _definicao: definicao,
      _limit: PAGE,
      _offset: offset,
    });
    if (error) return json({ error: error.message }, 500);
    const rows = (data ?? []) as Array<{ email_sha256: string | null; phone_sha256: string | null }>;
    for (const r of rows) membros.push([r.email_sha256 ?? "", r.phone_sha256 ?? ""]);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  const comEmail = membros.filter((m) => m[0]).length;
  const comFone = membros.filter((m) => m[1]).length;

  if (dryRun) {
    const duracao = Date.now() - started;
    await admin.from("meta_audience_runs").insert({
      audience_id: audienceId,
      segmento_chave: segmentoChave ?? (definicao.segmento ?? "ad_hoc"),
      dry_run: true,
      total_elegivel: membros.length,
      enviados: 0,
      duracao_ms: duracao,
      detalhes: { com_email: comEmail, com_telefone: comFone, definicao },
    });
    if (audienceId) {
      await admin
        .from("meta_audiences")
        .update({ ultimo_total_elegivel: membros.length })
        .eq("id", audienceId);
    }
    return json({
      ok: true,
      mode: "dry_run",
      segmento_chave: segmentoChave ?? null,
      definicao,
      total_elegivel: membros.length,
      com_email: comEmail,
      com_telefone: comFone,
      duracao_ms: duracao,
      enviado_ao_meta: false,
    });
  }

  // ---------- escrita real ----------
  if (!accessToken || !accountId) return json({ error: "Meta Ads não configurado" }, 400);
  if (!audienceId) return json({ error: "envio real exige segmento_chave cadastrado" }, 400);

  const { data: audRow, error: audErr } = await admin
    .from("meta_audiences")
    .select("id, nome, meta_custom_audience_id")
    .eq("id", audienceId)
    .maybeSingle();
  if (audErr || !audRow) return json({ error: audErr?.message ?? "segmento não encontrado" }, 500);

  let caId: string | null = audRow.meta_custom_audience_id ?? null;

  // 1) cria o público, se ainda não existir
  if (!caId) {
    const params = new URLSearchParams({
      name: `Uhome | ${audRow.nome}`,
      subtype: "CUSTOM",
      customer_file_source: "BOTH_USER_AND_PARTNER_PROVIDED",
      description: `Segmento ${segmentoChave} sincronizado pelo CRM U.Home`,
      access_token: accessToken,
    });
    const r = await fetch(`${META_BASE}/${accountId}/customaudiences`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const j = await r.json();
    if (!r.ok || !j?.id) {
      await admin.from("meta_audience_runs").insert({
        audience_id: audienceId,
        segmento_chave: segmentoChave,
        dry_run: false,
        total_elegivel: membros.length,
        enviados: 0,
        duracao_ms: Date.now() - started,
        erro: j?.error?.message ?? `HTTP ${r.status}`,
        detalhes: { etapa: "create_audience", error: j?.error ?? null },
      });
      return json({ ok: false, etapa: "create_audience", error: j?.error ?? `HTTP ${r.status}` }, 502);
    }
    caId = j.id as string;
    await admin
      .from("meta_audiences")
      .update({ meta_custom_audience_id: caId, ad_account_id: accountId })
      .eq("id", audienceId);
  }

  // 2) upload em lotes de até 10.000
  const BATCH = 10000;
  const sessionId = Date.now() % 2147483647;
  const totalBatches = Math.max(1, Math.ceil(membros.length / BATCH));
  let numReceived = 0;
  let numInvalid = 0;
  let enviados = 0;
  const lotes: unknown[] = [];

  for (let i = 0; i < totalBatches; i++) {
    const slice = membros.slice(i * BATCH, (i + 1) * BATCH);
    const payload = {
      schema: ["EMAIL", "PHONE"],
      data: slice,
    };
    const params = new URLSearchParams({
      payload: JSON.stringify(payload),
      session: JSON.stringify({
        session_id: sessionId,
        batch_seq: i + 1,
        last_batch_flag: i + 1 === totalBatches,
        estimated_num_total: membros.length,
      }),
      access_token: accessToken,
    });
    const r = await fetch(`${META_BASE}/${caId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const j = await r.json();
    if (!r.ok) {
      await admin.from("meta_audience_runs").insert({
        audience_id: audienceId,
        segmento_chave: segmentoChave,
        dry_run: false,
        total_elegivel: membros.length,
        enviados,
        duracao_ms: Date.now() - started,
        erro: j?.error?.message ?? `HTTP ${r.status}`,
        detalhes: { etapa: "upload_users", batch_seq: i + 1, error: j?.error ?? null, lotes },
      });
      return json(
        {
          ok: false,
          etapa: "upload_users",
          meta_custom_audience_id: caId,
          batch_seq: i + 1,
          error: j?.error ?? `HTTP ${r.status}`,
        },
        502,
      );
    }
    numReceived += Number(j?.num_received ?? 0);
    numInvalid += Number(j?.num_invalid_entries ?? 0);
    enviados += slice.length;
    lotes.push({ batch_seq: i + 1, enviados: slice.length, num_received: j?.num_received, num_invalid_entries: j?.num_invalid_entries });
  }

  const duracaoMs = Date.now() - started;
  await admin.from("meta_audience_runs").insert({
    audience_id: audienceId,
    segmento_chave: segmentoChave,
    dry_run: false,
    total_elegivel: membros.length,
    enviados,
    recebidos: numReceived,
    invalidos: numInvalid,
    duracao_ms: duracaoMs,
    detalhes: { com_email: comEmail, com_telefone: comFone, lotes, session_id: sessionId },
  });
  await admin
    .from("meta_audiences")
    .update({
      ultimo_total_elegivel: membros.length,
      ultima_sync_at: new Date().toISOString(),
    })
    .eq("id", audienceId);

  return json({
    ok: true,
    mode: "sync",
    segmento_chave: segmentoChave,
    meta_custom_audience_id: caId,
    total_elegivel: membros.length,
    enviados,
    num_received: numReceived,
    num_invalid_entries: numInvalid,
    com_email: comEmail,
    com_telefone: comFone,
    duracao_ms: duracaoMs,
  });
});

