// List approved WhatsApp message templates from Meta Graph API
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GRAPH = "https://graph.facebook.com/v21.0";

// In-memory cache for WABA id (per isolate, ~1h)
let cachedWaba: { id: string; at: number } | null = null;

interface MetaComponent {
  type?: string;
  buttons?: unknown[];
}
interface MetaTemplate {
  name: string;
  language: string;
  status: string;
  category?: string;
  components?: MetaComponent[];
}

async function resolveWabaId(phoneId: string, token: string): Promise<string> {
  if (cachedWaba && Date.now() - cachedWaba.at < 60 * 60 * 1000) return cachedWaba.id;
  const r = await fetch(`${GRAPH}/${phoneId}?fields=whatsapp_business_account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Falha ao resolver WABA: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const id = j?.whatsapp_business_account?.id;
  if (!id) throw new Error("whatsapp_business_account.id ausente na resposta da Meta");
  cachedWaba = { id, at: Date.now() };
  return id;
}

async function fetchAllTemplates(wabaId: string, token: string): Promise<MetaTemplate[]> {
  const out: MetaTemplate[] = [];
  let url: string | null = `${GRAPH}/${wabaId}/message_templates?fields=name,language,status,category,components&limit=200`;
  while (url) {
    const r: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Falha ao listar templates: ${r.status} ${await r.text()}`);
    const j = await r.json();
    if (Array.isArray(j?.data)) out.push(...(j.data as MetaTemplate[]));
    url = j?.paging?.next || null;
    if (out.length > 1000) break; // safety
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claims?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
    if (!phoneId || !accessToken) {
      return new Response(JSON.stringify({ error: "Meta credentials missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wabaId = await resolveWabaId(phoneId, accessToken);
    const all = await fetchAllTemplates(wabaId, accessToken);

    const templates = all
      .filter((t) => t.status === "APPROVED")
      .map((t) => {
        const hasButtons = (t.components || []).some(
          (c) => c?.type === "BUTTONS" && Array.isArray(c.buttons) && c.buttons.length > 0
        );
        return {
          name: t.name,
          language: t.language,
          status: t.status,
          category: t.category || null,
          has_buttons: hasButtons,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return new Response(JSON.stringify({ templates, waba_id: wabaId, total: templates.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
