import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, limit = 20, min_similarity = 0.3 } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: "query obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Embed query
    const embResp = await fetch(`${AI_GATEWAY}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-embedding-001",
        input: query,
      }),
    });
    if (!embResp.ok) {
      const t = await embResp.text();
      return new Response(JSON.stringify({ error: "embedding failed", details: t }), {
        status: embResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const embJson = await embResp.json();
    const vector = embJson.data?.[0]?.embedding;
    if (!vector) throw new Error("no embedding");

    // Similarity search
    const { data: matches, error: mErr } = await admin.rpc("match_materiais", {
      query_embedding: `[${vector.join(",")}]` as any,
      match_count: Math.max(limit * 3, 30), // over-fetch, agrupamos por material
    });
    if (mErr) throw new Error(`match: ${mErr.message}`);

    // Group by material_id, keep max similarity
    const byMaterial = new Map<string, { similarity: number; snippet: string }>();
    for (const m of (matches ?? []) as any[]) {
      if (m.similarity < min_similarity) continue;
      const cur = byMaterial.get(m.material_id);
      if (!cur || m.similarity > cur.similarity) {
        byMaterial.set(m.material_id, { similarity: m.similarity, snippet: m.content.slice(0, 200) });
      }
    }
    const ranked = [...byMaterial.entries()]
      .sort((a, b) => b[1].similarity - a[1].similarity)
      .slice(0, limit);
    if (ranked.length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch material metadata + empreendimento
    const ids = ranked.map(([id]) => id);
    const { data: mats } = await admin
      .from("materiais_links")
      .select("id, empreendimento_id, categoria, titulo, url, storage_path, mime_type, resumo_ia, tags, origem, materiais_empreendimentos!inner(id,nome,logo_url)")
      .in("id", ids);

    const matMap = new Map((mats ?? []).map((m: any) => [m.id, m]));
    const results = ranked
      .map(([id, s]) => {
        const m = matMap.get(id);
        if (!m) return null;
        return {
          ...m,
          similarity: s.similarity,
          snippet: s.snippet,
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("materiais-search error:", e);
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
