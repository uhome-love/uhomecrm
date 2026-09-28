// pagina-empreendimento-resposta — endpoint PÚBLICO da página pós-formulário
// (/v/casa-tua-canoas). Só grava em pagina_empreendimento_respostas.
// Nunca devolve dados de leads. Fase 2: tenta vincular ao lead e avisar o corretor (best-effort).
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders } from "../_shared/cors.ts";
import { vincularSeguro } from "../_shared/vincularRespostaPagina.ts";

const MAX_BYTES = 4096;
const SLUGS = ["casa-tua-canoas"] as const;

const Body = z.object({
  slug: z.enum(SLUGS),
  f: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/).optional().nullable(),
  telefone: z.string().max(30),
  periodo: z.enum(["sabado_manha", "sabado_tarde", "domingo", "dia_semana"]),
  respostas: z.object({
    quem: z.enum(["casal", "familia_filhos", "familia_pets", "so_eu"]).optional(),
    quando: z.enum(["quanto_antes", "ate_1_ano", "pesquisando"]).optional(),
    peso: z.enum(["patio_espaco", "seguranca", "localizacao", "lazer"]).optional(),
  }).strict().default({}),
  utm: z.object({
    utm_source: z.string().max(100).optional(),
    utm_medium: z.string().max(100).optional(),
    utm_campaign: z.string().max(100).optional(),
    utm_content: z.string().max(100).optional(),
    utm_term: z.string().max(100).optional(),
  }).strict().default({}),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BYTES) return json({ error: "payload_too_large" }, 413);
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ error: "payload_too_large" }, 413);

  let parsed;
  try {
    parsed = Body.safeParse(JSON.parse(raw));
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!parsed.success) return json({ error: "invalid_payload" }, 400);
  const b = parsed.data;

  const digits = b.telefone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length < 10 || digits.length > 11) return json({ error: "telefone_invalido" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = await sha256(`${ip}|pagina-emp|${Deno.env.get("SUPABASE_URL")}`);

  try {
    const since10 = new Date(Date.now() - 10 * 60_000).toISOString();
    const since60 = new Date(Date.now() - 60 * 60_000).toISOString();
    const [{ count: ipCount }, { count: telCount }] = await Promise.all([
      supabase.from("pagina_empreendimento_respostas").select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash).gte("created_at", since10),
      supabase.from("pagina_empreendimento_respostas").select("id", { count: "exact", head: true })
        .eq("telefone_digitado", digits).gte("created_at", since60),
    ]);
    if ((ipCount ?? 0) >= 5 || (telCount ?? 0) >= 3) return json({ error: "rate_limited" }, 429);

    const { data: row, error } = await supabase.from("pagina_empreendimento_respostas").insert({
      empreendimento_slug: b.slug,
      form_ref: b.f ?? null,
      telefone_digitado: digits,
      respostas: b.respostas,
      periodo_visita: b.periodo,
      utm: b.utm,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
      ip_hash: ipHash,
    }).select("id, status, lead_id, telefone_normalizado, telefone_digitado, respostas, periodo_visita").single();
    if (error) throw error;
    // Vínculo best-effort: nunca falha a resposta ao visitante, nunca devolve dados do lead.
    await vincularSeguro(supabase, row, "pagina-empreendimento-resposta");
    return json({ ok: true });
  } catch (e) {
    console.error("pagina-empreendimento-resposta error:", (e as Error)?.message);
    try {
      await supabase.from("ops_events").insert({
        fn: "pagina-empreendimento-resposta",
        level: "error",
        category: "pagina_publica",
        message: "insert_falhou",
        ctx: { slug: b.slug, form_ref: b.f ?? null },
        error_detail: String((e as Error)?.message || e).slice(0, 300),
      });
    } catch (_) { /* best-effort */ }
    return json({ error: "internal_error" }, 500);
  }
});
