import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = Deno.env.get("META_GRAPH_API_TOKEN");
    const supabase = createClient(supabaseUrl, serviceKey);

    let ids: string[] = [];
    try {
      const body = await req.json();
      if (Array.isArray(body?.ids)) ids = body.ids;
    } catch (_) {
      // no body
    }

    // Só IDs numéricos de formulário Meta (6+ dígitos), únicos
    ids = [...new Set(ids.map((s) => String(s).trim()).filter((s) => /^\d{6,}$/.test(s)))];

    const result: Record<string, string | null> = {};
    if (ids.length === 0) {
      return new Response(JSON.stringify({ names: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Cache existente
    const { data: cached } = await supabase
      .from("meta_form_names")
      .select("form_id, form_name, encontrado")
      .in("form_id", ids);

    const cachedIds = new Set<string>();
    (cached || []).forEach((row: any) => {
      cachedIds.add(row.form_id);
      result[row.form_id] = row.encontrado ? row.form_name : null;
    });

    // 2) IDs ainda desconhecidos → Graph API
    const missing = ids.filter((id) => !cachedIds.has(id));
    if (missing.length > 0 && token) {
      const upserts: any[] = [];
      for (const id of missing) {
        try {
          const url = new URL(`${META_BASE}/${id}`);
          url.searchParams.set("fields", "id,name");
          url.searchParams.set("access_token", token);
          const resp = await fetch(url.toString());
          if (resp.ok) {
            const json = await resp.json();
            const name = json?.name || null;
            result[id] = name;
            upserts.push({ form_id: id, form_name: name, fonte: "graph_api", encontrado: !!name });
          } else {
            await resp.text();
            result[id] = null;
            upserts.push({ form_id: id, form_name: null, fonte: "graph_api", encontrado: false });
          }
        } catch (e) {
          console.warn(`Falha ao resolver form ${id}: ${(e as Error).message}`);
          result[id] = null;
        }
      }
      if (upserts.length > 0) {
        await supabase.from("meta_form_names").upsert(upserts, { onConflict: "form_id" });
      }
    } else if (missing.length > 0 && !token) {
      console.warn("META_GRAPH_API_TOKEN ausente; não é possível resolver nomes.");
    }

    return new Response(JSON.stringify({ names: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resolve-meta-forms error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
