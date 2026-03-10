import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchImovelFromJetimob(apiKey: string, codigo: string) {
  const url = `https://api.jetimob.com/webservice/${apiKey}/imoveis/codigo/${codigo}?v=6`;
  console.log(`Fetching imovel codigo=${codigo}`);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    console.warn(`Jetimob ${res.status} for codigo ${codigo}`);
    return null;
  }
  const data = await res.json();
  const item = data?.result || data?.data || data;
  if (!item || (!item.id && !item.codigo && !item.id_imovel)) {
    console.warn(`Empty result for codigo ${codigo}`);
    return null;
  }

  const imgArr = item.imagens || item.fotos || [];
  const fotos = imgArr.slice(0, 10).map((f: any) => f.link || f.link_thumb || f.url).filter(Boolean);

  return {
    id: item.id_imovel || item.id || codigo,
    codigo: item.codigo || codigo,
    titulo: item.titulo_anuncio || item.titulo || item.descricao_curta || `Imóvel ${codigo}`,
    endereco: item.endereco?.logradouro
      ? `${item.endereco.logradouro}${item.endereco.bairro ? `, ${item.endereco.bairro}` : ""}${item.endereco.cidade ? ` — ${item.endereco.cidade}` : ""}`
      : (item.bairro ? `${item.bairro}${item.cidade ? ` — ${item.cidade}` : ""}` : null),
    bairro: item.endereco?.bairro || item.bairro || null,
    cidade: item.endereco?.cidade || item.cidade || null,
    area: item.area_privativa || item.area_util || item.area_total || item.area || null,
    quartos: item.dormitorios || item.quartos || null,
    suites: item.suites || null,
    vagas: item.garagens || item.vagas || null,
    banheiros: item.banheiros || null,
    valor: item.valor_venda || item.valor || null,
    fotos,
    empreendimento: item.empreendimento?.nome || item.empreendimento || null,
    descricao: item.descricao_curta || item.titulo || null,
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
    console.log(`Action: ${action}, JETIMOB_API_KEY present: ${!!JETIMOB_API_KEY}`);

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
        console.error("Vitrine not found:", error);
        return jsonResponse({ error: "Vitrine não encontrada" }, 404);
      }

      if (vitrine.expires_at && new Date(vitrine.expires_at) < new Date()) {
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

      // Fetch properties from Jetimob using codigos
      let imoveis: any[] = [];
      const ids = (vitrine.imovel_ids as string[]) || [];
      console.log(`Vitrine ${vitrine_id} has ${ids.length} imovel_ids:`, ids);

      if (JETIMOB_API_KEY && ids.length > 0) {
        const results = await Promise.allSettled(
          ids.map(id => fetchImovelFromJetimob(JETIMOB_API_KEY, String(id)))
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            imoveis.push(r.value);
          } else if (r.status === "rejected") {
            console.error("Fetch failed:", r.reason);
          }
        }
        console.log(`Fetched ${imoveis.length} imoveis successfully`);
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
        const item = await fetchImovelFromJetimob(JETIMOB_API_KEY, String(id));
        if (item) {
          imoveis.push({
            id: item.id,
            titulo: item.titulo,
            foto_thumb: (item.fotos || [])[0] || null,
            area: item.area,
            valor: item.valor,
          });
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
