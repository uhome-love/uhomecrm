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

    // Verificação (só admin/diretor): confere no site a página de vários corretores pelo e-mail.
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.verificar_emails)) {
      const { data: papeis } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (!(papeis ?? []).some((p: { role: string }) => p.role === "admin" || p.role === "diretor")) {
        return json({ error: "Só a direção pode fazer essa verificação." }, 403);
      }
      const emails = (body.verificar_emails as unknown[]).filter((e): e is string => typeof e === "string").slice(0, 50);
      const resultados = await Promise.all(emails.map(async (em) => {
        const rr = await fetch(SITE_BRIDGE, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-crm-token": token },
          body: JSON.stringify({ action: "list_natal_links", payload: { email: em } }),
        });
        const cc = await rr.json().catch(() => ({}));
        return { email: em, status: rr.status, nome: cc?.corretor?.nome ?? null, slug: cc?.corretor?.slug ?? null,
          campanha_url: cc?.campanha_url ?? null, produtos: cc?.produtos?.length ?? 0, erro: cc?.error ?? null };
      }));
      return json({ resultados });
    }

    const payload: Record<string, string> = {};
    if (slug) payload.corretor_slug = slug;
    if (email) payload.email = email;

    const r = await fetch(SITE_BRIDGE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-crm-token": token },
      body: JSON.stringify({ action: "list_natal_links", payload }),
    });
    const corpo = await r.json().catch(() => ({}));
    if (r.status === 401) {
      console.error("natal-links: site recusou CRM_BRIDGE_TOKEN");
      return json({ error: "O site recusou a ligação com o CRM. Avise o administrador." }, 502);
    }
    if (!r.ok) return json({ error: corpo?.error ?? "O site não respondeu. Tente de novo." }, r.status);
    return json(corpo);
  } catch (e) {
    console.error("natal-links", e);
    return json({ error: "Não foi possível buscar suas páginas agora." }, 500);
  }
});
