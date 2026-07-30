// meta-capi-track — endpoint público para eventos de navegador do site (uhome.com.br)
// Recebe um evento (ViewContent, Lead, Schedule...), hasheia o PII no servidor,
// carimba event_time = agora (UNIX segundos) e enfileira em meta_capi_queue.
// Deduplicação com o pixel do navegador via o mesmo event_id.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  event_name: z.enum(["ViewContent", "Lead", "Schedule", "Purchase", "Search", "Contact"]),
  event_id: z.string().min(6).max(120).optional(),
  email: z.string().max(255).optional().nullable(),
  telefone: z.string().max(40).optional().nullable(),
  nome: z.string().max(200).optional().nullable(),
  cep: z.string().max(20).optional().nullable(),
  fbc: z.string().max(255).optional().nullable(),
  fbp: z.string().max(255).optional().nullable(),
  fbclid: z.string().max(255).optional().nullable(),
  url: z.string().max(1000).optional().nullable(),
  empreendimento: z.string().max(200).optional().nullable(),
  content_ids: z.array(z.string().max(120)).max(20).optional(),
  value: z.number().finite().optional(),
  currency: z.string().length(3).optional(),
});

function normalizeAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function sha256(raw: string | null | undefined): Promise<string | null> {
  if (!raw) return null;
  const norm = normalizeAccents(String(raw)).trim().toLowerCase();
  if (!norm) return null;
  const buf = new TextEncoder().encode(norm);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11) d = `55${d}`;
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors }, 400);
  }
  const b = parsed.data;

  const nowSec = Math.floor(Date.now() / 1000);
  const eventId = b.event_id?.trim() || `uhome_site_${b.event_name}_${nowSec}_${crypto.randomUUID().slice(0, 8)}`;

  // fbc: usa o enviado, ou constrói a partir do fbclid
  const fbc = b.fbc?.trim() || (b.fbclid?.trim() ? `fb.1.${Date.now()}.${b.fbclid.trim()}` : null);

  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const ua = req.headers.get("user-agent") || null;

  const nome = (b.nome || "").trim();
  const firstName = nome ? nome.split(/\s+/)[0] : null;
  const lastName = nome && nome.includes(" ") ? nome.slice(nome.indexOf(" ") + 1).trim() : null;

  const user_data: Record<string, unknown> = {};
  const em = await sha256(b.email);
  const ph = await sha256(normalizePhone(b.telefone));
  const fn = await sha256(firstName);
  const ln = await sha256(lastName);
  const zp = await sha256((b.cep || "").replace(/\D/g, "") || null);
  const ct = await sha256("porto alegre");
  const st = await sha256("rs");
  const country = await sha256("br");

  if (em) user_data.em = [em];
  if (ph) user_data.ph = [ph];
  if (fn) user_data.fn = [fn];
  if (ln) user_data.ln = [ln];
  if (zp) user_data.zp = [zp];
  if (ct) user_data.ct = [ct];
  if (st) user_data.st = [st];
  if (country) user_data.country = [country];
  if (fbc) user_data.fbc = fbc;
  if (b.fbp?.trim()) user_data.fbp = b.fbp.trim();
  if (ua) user_data.client_user_agent = ua;
  if (ip) user_data.client_ip_address = ip;

  // Sem nenhum sinal de identidade o Meta descarta o evento
  if (!em && !ph && !fbc && !user_data.fbp) {
    return json({ ok: false, error: "sem sinais de identidade (email, telefone, fbc ou fbp)" }, 400);
  }

  const custom_data: Record<string, unknown> = {
    event_source: "site",
    lead_event_source: "uhome",
  };
  if (b.empreendimento) custom_data.empreendimento = b.empreendimento;
  if (b.content_ids?.length) {
    custom_data.content_ids = b.content_ids;
    custom_data.content_type = "product";
  }
  if (typeof b.value === "number") {
    custom_data.value = b.value;
    custom_data.currency = b.currency || "BRL";
  }

  const payload: Record<string, unknown> = {
    action_source: "website",
    event_name: b.event_name,
    event_time: nowSec,
    event_id: eventId,
    user_data,
    custom_data,
  };
  if (b.url) payload.event_source_url = b.url;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase.from("meta_capi_queue").insert({
    event_id: eventId,
    event_name: b.event_name,
    event_time: new Date(nowSec * 1000).toISOString(),
    payload,
  });

  if (error && !error.message.includes("duplicate key")) {
    console.error("meta-capi-track insert error:", error.message);
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, event_id: eventId, queued: true });
});
