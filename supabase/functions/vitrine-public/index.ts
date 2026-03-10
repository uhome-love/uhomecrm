import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchImovelFromJetimob(apiKey: string, imovelId: number) {
  const url = `https://api.jetimob.com/webservice/${apiKey}/imoveis/codigo/${imovelId}?v=6`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = await res.json();
  const item = data?.result || data;
  if (!item || !item.id) return null;

  return {
    id: item.id || imovelId,
    titulo: item.titulo || item.descricao_curta || `Imóvel ${imovelId}`,
    endereco: item.endereco?.logradouro
      ? `${item.endereco.logradouro}${item.endereco.bairro ? `, ${item.endereco.bairro}` : ""}${item.endereco.cidade ? ` — ${item.endereco.cidade}` : ""}`
      : null,
    area: item.area_util || item.area_total || null,
    quartos: item.quartos || item.dormitorios || null,
    vagas: item.vagas || item.garagens || null,
    valor: item.valor_venda || item.valor || null,
    fotos: (item.fotos || []).slice(0, 10).map((f: any) => f.link || f.link_thumb || f.url),
    empreendimento: item.empreendimento?.nome || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action, vitrine_id, imovel_ids } = body;

    const JETIMOB_API_KEY = Deno.env.get("JETIMOB_API_KEY");

    // GET vitrine data + fetch properties from Jetimob
    if (action === "get_vitrine") {
      if (!vitrine_id) {
        return jsonResponse({ error: "vitrine_id required" }, 400);
      }

      const { data: vitrine, error } = await supabase
        .from("vitrines")
        .select("*")
        .eq("id", vitrine_id)
        .maybeSingle();

      if (error || !vitrine) {
        return jsonResponse({ error: "Vitrine não encontrada" }, 404);
      }

      if (new Date(vitrine.expires_at) < new Date()) {
        return jsonResponse({ error: "Vitrine expirada" }, 410);
      }

      // Increment views
      await supabase.from("vitrines")
        .update({ visualizacoes: (vitrine.visualizacoes || 0) + 1 })
        .eq("id", vitrine_id);

      // Get corretor info
      const { data: corretor } = await supabase
        .from("profiles")
        .select("nome, telefone, avatar_url")
        .eq("user_id", vitrine.created_by)
        .maybeSingle();

      // Fetch properties from Jetimob
      let imoveis: any[] = [];
      const ids = (vitrine.imovel_ids as number[]) || [];

      if (JETIMOB_API_KEY && ids.length > 0) {
        const results = await Promise.allSettled(
          ids.map(id => fetchImovelFromJetimob(JETIMOB_API_KEY, id))
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            imoveis.push(r.value);
          }
        }
      } else {
        console.warn("JETIMOB_API_KEY not configured or no imovel_ids");
      }

      return jsonResponse({
        vitrine: {
          id: vitrine.id,
          titulo: vitrine.titulo,
          mensagem: vitrine.mensagem_corretor,
          created_at: vitrine.created_at,
        },
        corretor: corretor ? {
          nome: corretor.nome,
          telefone: corretor.telefone,
          avatar_url: corretor.avatar_url,
        } : null,
        imoveis,
      });
    }

    // Fetch imovel details for preview (authenticated)
    if (action === "fetch_imoveis") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

      if (!JETIMOB_API_KEY || !imovel_ids?.length) {
        return jsonResponse({ imoveis: [] });
      }

      const imoveis: any[] = [];
      for (const id of imovel_ids.slice(0, 20)) {
        try {
          const item = await fetchImovelFromJetimob(JETIMOB_API_KEY, id);
          if (item) {
            imoveis.push({
              id: item.id,
              titulo: item.titulo,
              foto_thumb: (item.fotos || [])[0] || null,
              area: item.area,
              valor: item.valor,
            });
          }
        } catch (e) {
          console.warn(`Failed to fetch imovel ${id}:`, e);
        }
      }

      return jsonResponse({ imoveis });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("vitrine-public error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
