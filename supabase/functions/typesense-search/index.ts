import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COLLECTION_NAME = "imoveis";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TYPESENSE_HOST = Deno.env.get("TYPESENSE_HOST");
    const TYPESENSE_SEARCH_API_KEY = Deno.env.get("TYPESENSE_SEARCH_API_KEY");
    if (!TYPESENSE_HOST || !TYPESENSE_SEARCH_API_KEY) {
      throw new Error("Typesense search credentials not configured");
    }

    const body = await req.json();
    const {
      q = "*",
      query_by = "titulo,empreendimento,bairro,endereco,codigo,construtora,descricao_resumida",
      filter_by = "",
      sort_by = "",
      page = 1,
      per_page = 24,
      facet_by = "",
      typo_tokens_threshold = 1,
      num_typos = 2,
      prefix = true,
      // Autocomplete mode
      autocomplete = false,
    } = body;

    let searchPath: string;

    if (autocomplete) {
      // Autocomplete: lightweight search returning grouped facet suggestions
      const params = new URLSearchParams({
        q: String(q),
        query_by: "bairro,empreendimento,codigo,titulo",
        facet_by: "bairro,empreendimento",
        max_facet_values: "8",
        per_page: "5",
        num_typos: "1",
        prefix: "true",
        typo_tokens_threshold: "1",
      });
      searchPath = `/collections/${COLLECTION_NAME}/documents/search?${params.toString()}`;
    } else {
      // Full search
      const params = new URLSearchParams({
        q: String(q),
        query_by,
        per_page: String(per_page),
        page: String(page),
        num_typos: String(num_typos),
        prefix: String(prefix),
        typo_tokens_threshold: String(typo_tokens_threshold),
        highlight_full_fields: "titulo,empreendimento,bairro",
      });

      if (filter_by) params.set("filter_by", filter_by);
      if (sort_by) params.set("sort_by", sort_by);
      if (facet_by) params.set("facet_by", facet_by);

      searchPath = `/collections/${COLLECTION_NAME}/documents/search?${params.toString()}`;
    }

    const url = `https://${TYPESENSE_HOST}${searchPath}`;
    const resp = await fetch(url, {
      headers: {
        "X-TYPESENSE-API-KEY": TYPESENSE_SEARCH_API_KEY,
      },
    });

    const data = await resp.json();

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "Typesense search failed", details: data }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (autocomplete) {
      // Transform facet results into suggestions
      const suggestions: { type: string; value: string }[] = [];
      if (data.facet_counts) {
        for (const fc of data.facet_counts) {
          for (const fv of (fc.counts || [])) {
            suggestions.push({ type: fc.field_name, value: fv.value });
          }
        }
      }
      // Also add top hit codes/titles
      if (data.hits) {
        for (const hit of data.hits.slice(0, 5)) {
          const doc = hit.document;
          if (doc.codigo) suggestions.push({ type: "codigo", value: doc.codigo });
        }
      }
      return new Response(JSON.stringify({ suggestions: suggestions.slice(0, 15) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normal search: return formatted results
    const hits = (data.hits || []).map((hit: any) => hit.document);
    return new Response(JSON.stringify({
      data: hits,
      total: data.found || 0,
      totalPages: Math.ceil((data.found || 0) / per_page),
      page: data.page || page,
      search_time_ms: data.search_time_ms,
      facet_counts: data.facet_counts || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("typesense-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
