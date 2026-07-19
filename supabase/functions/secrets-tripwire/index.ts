// secrets-tripwire
// Roda a cada 10 minutos via pg_cron. Verifica se TODOS os secrets esperados
// (listados em expected.json, derivados via `grep Deno.env.get` no repositório)
// estão PRESENTES no runtime de edge functions.
//
// IMPORTANTE — o que esta tripwire faz e o que NÃO faz:
//   ✓ Detecta PRESENÇA: Deno.env.get(name) retorna string não-vazia?
//   ✗ NÃO valida que a credencial seja aceita pelo serviço externo (validade,
//     expiração, revogação, escopos). Isso é trabalho de probes ativos por
//     integração — ficará para item futuro se necessário.
//
// Quando detecta secret ausente:
//   1. Insere uma notificação categoria 'sla_urgente' para todos os usuários
//      com role 'admin' (= CEO no projeto atual — enum app_role não tem 'ceo').
//   2. Loga em ops_events com level=error / category=system.
//
// Modo de teste: ?force_missing=NOME1,NOME2 finge que esses nomes estão
// ausentes (mesmo se estiverem presentes) para validar o caminho de alerta
// sem precisar deletar um secret de verdade.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Lista derivada via `grep -rhoE 'Deno.env.get("NAME")' supabase/functions/` em 18/05/2026.
// Excluídos:
//   - SUPABASE_* (auto-injetados pela plataforma)
//   - TYPESENSE_HOST / EVOLUTION_API_URL / UHOMESITE_URL (URLs, não secrets)
//   - SITE_SUPABASE_ANON_KEY / SITE_SUPABASE_URL (legacy — código usa UHOMESITE_*)
//   - WHATSAPP_PHONE_ID / WHATSAPP_TOKEN (legacy — canônicos WHATSAPP_PHONE_NUMBER_ID/_ACCESS_TOKEN)
//   - TIKTOK_WEBHOOK_SECRET (ingestão TikTok não configurada)
//   - ELEVENLABS_* / MAILGUN_API_KEY (provedores cancelados em 19/07/2026;
//     código removido — ver auditoria de custo/segurança)
// Atualizar quando edge function nova introduzir secret novo. Ver também expected.json (doc).
const EXPECTED_SECRETS: string[] = [
  "EVOLUTION_API_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "JETIMOB_API_KEY",
  "JETIMOB_LEADS_PRIVATE_KEY",
  "JETIMOB_LEADS_URL_KEY",
  "LANDING_WEBHOOK_SECRET",
  "LOVABLE_API_KEY",
  "META_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "RDSTATION_PRIVATE_TOKEN",
  "SYNC_SECRET",
  "TYPESENSE_ADMIN_API_KEY",
  "TYPESENSE_SEARCH_API_KEY",
  "UHOMESITE_SERVICE_KEY",
  "UHOME_AI_SECRET",
  "VAPID_PRIVATE_KEY",
  "VAPID_PUBLIC_KEY",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const forceMissing = (url.searchParams.get("force_missing") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const list: string[] = EXPECTED_SECRETS;
  const missing: string[] = [];

  for (const name of list) {
    if (forceMissing.includes(name)) {
      missing.push(name);
      continue;
    }
    const v = Deno.env.get(name);
    if (!v || v.trim() === "") missing.push(name);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (missing.length === 0) {
    // healthy — apenas log info
    await supabase.from("ops_events").insert({
      fn: "secrets-tripwire",
      level: "info",
      category: "system",
      message: `OK — ${list.length} secrets presentes`,
      ctx: { checked: list.length },
    });
    return new Response(
      JSON.stringify({ ok: true, checked: list.length, missing: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── ALERTA: secrets ausentes ──
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  const notifs = (admins ?? []).map((a) => ({
    user_id: a.user_id,
    tipo: "sistema",
    categoria: "sla_urgente",
    titulo: `🚨 Secret(s) ausente(s) no backend: ${missing.join(", ")}`,
    mensagem:
      `A tripwire detectou que ${missing.length} secret(s) sumiu/sumiram do runtime de edge functions. ` +
      `Isso pode quebrar integrações (Meta, WhatsApp, Mailgun etc). ` +
      `Reponha imediatamente em Lovable Cloud → Settings → Secrets.`,
    dados: {
      missing,
      detected_at: new Date().toISOString(),
      forced: forceMissing.length > 0,
    },
    lida: false,
  }));

  if (notifs.length > 0) {
    await supabase.from("notifications").insert(notifs);
  }

  await supabase.from("ops_events").insert({
    fn: "secrets-tripwire",
    level: "error",
    category: "system",
    message: `Secret(s) ausente(s): ${missing.join(", ")}`,
    ctx: {
      missing,
      checked: list.length,
      admins_notified: notifs.length,
      forced: forceMissing.length > 0,
    },
  });

  return new Response(
    JSON.stringify({
      ok: false,
      checked: list.length,
      missing,
      admins_notified: notifs.length,
      forced: forceMissing.length > 0,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
