import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COLLECTION_NAME = "imoveis";

// Whitelist of fields any caller may reference in query_by / filter_by / sort_by / facet_by.
// Prevents filter-expression injection and schema enumeration by anonymous callers.
const ALLOWED_FIELDS = new Set<string>([
  // search fields
  "titulo", "empreendimento", "bairro", "endereco", "codigo", "construtora",
  "descricao_resumida", "tipo",
  // filter / sort fields
  "valor_locacao", "valor_venda", "dormitorios", "suites", "vagas",
  "area_privativa", "em_obras", "status", "is_uhome", "cidade",
  "data_atualizacao", "_text_match",
]);

const MAX_PER_PAGE = 50;

/** Extract every field referenced before a ":" (filter_by / sort_by syntax). */
function fieldsFromExpr(expr: string): string[] {
  const matches = expr.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g);
  return [...matches].map((m) => m[1]);
}

/** Extract comma-separated field names (query_by / facet_by syntax). */
function fieldsFromList(list: string): string[] {
  return list.split(",").map((f) => f.trim()).filter(Boolean);
}

function validateFields(fields: string[]): string | null {
  for (const f of fields) {
    if (!ALLOWED_FIELDS.has(f)) return f;
  }
  return null;
}

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
      query_by = "titulo,empreendimento,bairro,endereco,codigo,construtora,descricao_resumida,tipo",
      filter_by = "",
      sort_by = "",
      page = 1,
      per_page = 24,
      facet_by = "",
      max_facet_values = "",
      typo_tokens_threshold = 1,
      num_typos = 2,
      prefix = true,
      // Autocomplete mode
      autocomplete = false,
    } = body;

    // ── Field whitelist validation (reject injection / schema probing) ──
    const referenced: string[] = [
      ...fieldsFromList(String(query_by)),
      ...fieldsFromList(String(facet_by)),
      ...fieldsFromExpr(String(filter_by)),
      ...fieldsFromExpr(String(sort_by)),
    ];
    const bad = validateFields(referenced);
    if (bad) {
      return new Response(
        JSON.stringify({ error: `Campo de busca não permitido: ${bad}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cap per_page server-side to prevent bulk extraction
    const safePerPage = Math.min(Math.max(parseInt(String(per_page), 10) || 24, 1), MAX_PER_PAGE);

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
        per_page: String(safePerPage),
        page: String(page),
        num_typos: String(num_typos),
        prefix: String(prefix),
        typo_tokens_threshold: String(typo_tokens_threshold),
        highlight_full_fields: "titulo,empreendimento,bairro",
      });

      if (filter_by) params.set("filter_by", filter_by);
      if (sort_by) params.set("sort_by", sort_by);
      if (facet_by) {
        params.set("facet_by", facet_by);
        if (max_facet_values) params.set("max_facet_values", String(max_facet_values));
      }

      searchPath = `/collections/${COLLECTION_NAME}/documents/search?${params.toString()}`;
    }

    const url = `https://${TYPESENSE_HOST}${searchPath}`;
    console.log("[typesense-search] Request:", { host: TYPESENSE_HOST, collection: COLLECTION_NAME, filter_by, q, page, per_page: safePerPage });
    const resp = await fetch(url, {
      headers: {
        "X-TYPESENSE-API-KEY": TYPESENSE_SEARCH_API_KEY,
      },
    });

    const data = await resp.json();
    console.log("[typesense-search] Response:", { ok: resp.ok, status: resp.status, found: data.found, hits: data.hits?.length ?? 0 });

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
      totalPages: Math.ceil((data.found || 0) / safePerPage),
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
