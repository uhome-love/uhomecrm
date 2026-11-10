import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SITE_BRIDGE = "https://huigglwvvzuwwyqvpmec.supabase.co/functions/v1/crm-bridge";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Faça login de novo." }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: c, error: ce } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
    if (ce || !c?.claims) return json({ error: "Faça login de novo." }, 401);
    const userId = c.claims.sub as string;

    const { data: perfil } = await supabase.from("profiles").select("slug_ref, email").eq("user_id", userId).maybeSingle();
    const email = (perfil?.email as string | null) ?? (c.claims.email as string | undefined) ?? null;
    const slug = (perfil?.slug_ref as string | null) ?? null;
    if (!slug && !email) return json({ error: "Seu cadastro não tem e-mail nem link do site." }, 404);

    const token = Deno.env.get("CRM_BRIDGE_TOKEN")?.trim();
    if (!token) return json({ error: "Ligação com o site não configurada." }, 500);

    const payload: Record<string, string> = {};
    if (slug) payload.corretor_slug = slug;
    if (email) payload.email = email;

    const r = await fetch(SITE_BRIDGE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-crm-token": token },
      body: JSON.stringify({ action: "list_natal_links", payload }),
    });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: corpo?.error ?? "O site não respondeu. Tente de novo." }, r.status);
    return json(corpo);
  } catch (e) {
    console.error("natal-links", e);
    return json({ error: "Não foi possível buscar suas páginas agora." }, 500);
  }
});
