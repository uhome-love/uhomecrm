import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchImovelFromJetimob(apiKey: string, codigo: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://api.jetimob.com/webservice/${apiKey}/imoveis/codigo/${codigo}?v=6`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.result || data?.data || data;
    if (!item || (!item.id && !item.codigo && !item.id_imovel)) return null;

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
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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

      if (vitrine.expires_at && new Date(vitrine.expires_at) < new Date()) {
        return jsonResponse({ error: "Vitrine expirada" }, 410);
      }

      // Increment views (non-blocking)
      supabase.from("vitrines")
        .update({ visualizacoes: (vitrine.visualizacoes || 0) + 1 })
        .eq("id", vitrine_id)
        .then(() => {});

      // Get corretor info in parallel with override lookup
      const ids = (vitrine.imovel_ids as string[]) || [];

      const [corretorResult, overrideResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("nome, telefone, avatar_url")
          .eq("user_id", vitrine.created_by)
          .maybeSingle(),
        ids.length > 0
          ? supabase
              .from("empreendimento_overrides")
              .select("nome, diferenciais, plantas, video_url, mapa_url, cor_primaria, landing_titulo, landing_subtitulo, descricao, fotos, bairro, valor_min, valor_max, tipologias, status_obra, previsao_entrega, vagas, area_privativa, dormitorios, suites")
              .in("codigo", ids)
          : Promise.resolve({ data: null }),
      ]);

      const corretor = corretorResult.data;
      const overrideRows = overrideResult.data;

      // Handle Melnick Day vitrines
      if (vitrine.tipo === "melnick_day" && vitrine.dados_custom) {
        const customData = vitrine.dados_custom as any[];
        const imoveis = customData.map((item: any, idx: number) => ({
          id: idx + 1,
          titulo: item.nome,
          endereco: item.bairro ? `${item.bairro} — Porto Alegre` : null,
          bairro: item.bairro || null,
          cidade: "Porto Alegre",
          area: null, quartos: null, suites: null, vagas: null, banheiros: null,
          valor: item.precoPor ? parseFloat(item.precoPor.replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".")) : null,
          fotos: item.imagens?.length > 0 ? item.imagens : (item.imagem ? [item.imagem] : []),
          empreendimento: item.nome,
          descricao: `${item.metragens} · ${item.dorms} · ${item.status}`,
          precoDe: item.precoDe || null, precoPor: item.precoPor || null,
          descontoMax: item.descontoMax || null, status: item.status || null,
          metragens: item.metragens || null, dorms: item.dorms || null,
          condicoes: item.condicoes || null, segmento: item.segmento || null,
        }));

        return jsonResponse({
          vitrine: { id: vitrine.id, titulo: vitrine.titulo, subtitulo: vitrine.subtitulo || null, mensagem: vitrine.mensagem_corretor, created_at: vitrine.created_at, tipo: "melnick_day" },
          corretor: corretor ? { nome: corretor.nome, telefone: corretor.telefone, avatar_url: corretor.avatar_url } : null,
          imoveis,
        });
      }

      // Build landing data from overrides
      let landingData: any = null;
      let overrideFotos: string[] = [];

      if (overrideRows && overrideRows.length > 0) {
        const ov = overrideRows[0];
        overrideFotos = ov.fotos || [];
        landingData = {
          diferenciais: ov.diferenciais || [],
          plantas: ov.plantas || [],
          video_url: ov.video_url || null,
          mapa_url: ov.mapa_url || null,
          cor_primaria: ov.cor_primaria || "#1e3a5f",
          landing_titulo: ov.landing_titulo || null,
          landing_subtitulo: ov.landing_subtitulo || null,
          descricao: ov.descricao || null,
          fotos: overrideFotos,
          bairro: ov.bairro || null,
          valor_min: ov.valor_min || null,
          valor_max: ov.valor_max || null,
          tipologias: ov.tipologias || [],
          status_obra: ov.status_obra || null,
          previsao_entrega: ov.previsao_entrega || null,
          vagas: ov.vagas || null,
        };
      }

      // For "anuncio" type vitrines with complete override data, skip Jetimob entirely
      const hasCompleteOverride = landingData && overrideFotos.length >= 3 && landingData.descricao;
      
      let imoveis: any[] = [];

      if (hasCompleteOverride) {
        // Build a synthetic imovel from override data — NO Jetimob call needed
        const ov = overrideRows![0];
        imoveis = [{
          id: ids[0] || 1,
          codigo: ids[0] || "",
          titulo: ov.landing_titulo || ov.nome || vitrine.titulo,
          endereco: ov.bairro ? `${ov.bairro} — Porto Alegre` : null,
          bairro: ov.bairro || null,
          cidade: "Porto Alegre",
          area: ov.area_privativa || null,
          quartos: ov.dormitorios || null,
          suites: ov.suites || null,
          vagas: ov.vagas || null,
          banheiros: null,
          valor: ov.valor_min || null,
          fotos: overrideFotos,
          empreendimento: ov.nome || vitrine.titulo,
          descricao: ov.descricao || null,
        }];
      } else if (JETIMOB_API_KEY && ids.length > 0) {
        // Only call Jetimob if we don't have complete override data
        const results = await Promise.allSettled(
          ids.map(id => fetchImovelFromJetimob(JETIMOB_API_KEY, String(id)))
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            imoveis.push(r.value);
          }
        }

        // Merge override photos with imovel photos
        if (overrideFotos.length > 0 && imoveis.length > 0) {
          imoveis[0].fotos = [...overrideFotos, ...imoveis[0].fotos.filter((f: string) => !overrideFotos.includes(f))];
        }
      }

      return jsonResponse({
        vitrine: { id: vitrine.id, titulo: vitrine.titulo, subtitulo: vitrine.subtitulo || null, mensagem: vitrine.mensagem_corretor, created_at: vitrine.created_at, tipo: vitrine.tipo },
        corretor: corretor ? { nome: corretor.nome, telefone: corretor.telefone, avatar_url: corretor.avatar_url } : null,
        imoveis,
        landing: landingData,
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
