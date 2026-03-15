import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|twitterbot|linkedinbot|discord|slack|preview|fetch|curl|wget|python|go-http|insomnia|postman|googlebot|bingbot|yandex/i;

const DEFAULT_OG_IMAGE = "https://uhomesales.com/og-image.png";
const PUBLIC_DOMAIN = "https://uhomesales.com";
const SPA_ORIGIN = "https://uhomeia.lovable.app";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function buildHtml(
  url: string,
  title: string,
  description: string,
  image: string,
): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="UhomeSales" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(image)}" />
  <link rel="canonical" href="${esc(url)}" />
</head>
<body>
  <p><a href="${esc(url)}">${esc(title)}</a></p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const codigo = url.searchParams.get("codigo");

  if (!codigo) {
    return new Response("Missing codigo", { status: 400 });
  }

  const canonicalUrl = `${PUBLIC_DOMAIN}/imovel/${codigo}`;
  const spaUrl = `${SPA_ORIGIN}/imovel/${codigo}`;
  const userAgent = req.headers.get("user-agent") || "";
  const isBot = BOT_UA.test(userAgent);

  // Regular browsers → redirect to SPA
  if (!isBot) {
    return Response.redirect(spaUrl, 302);
  }

  // ── Bot / crawler path: fetch property data and build OG HTML ──
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Call jetimob-proxy internally to get property data
    const proxyUrl = `${supabaseUrl}/functions/v1/jetimob-proxy`;
    const proxyRes = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ action: "get_imovel", codigo }),
      signal: AbortSignal.timeout(8000),
    });

    if (!proxyRes.ok) {
      console.error("jetimob-proxy error:", proxyRes.status);
      return Response.redirect(spaUrl, 302);
    }

    const result = await proxyRes.json();
    const imovel = result?.imovel;

    if (!imovel || result?.not_found) {
      // Also check empreendimento_overrides as fallback
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: override } = await supabase
        .from("empreendimento_overrides")
        .select("nome, descricao, bairro, fotos, valor_venda, dormitorios, area_privativa, landing_titulo")
        .eq("codigo", codigo)
        .maybeSingle();

      if (override) {
        const title = override.landing_titulo || override.nome || `Imóvel ${codigo}`;
        const desc = override.descricao?.substring(0, 160) || (override.bairro ? `${override.bairro} | UhomeSales` : "Confira este imóvel");
        const image = override.fotos?.[0] || DEFAULT_OG_IMAGE;
        const html = buildHtml(canonicalUrl, `🏡 ${title}`, desc, image);
        return new Response(html, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      }

      return Response.redirect(spaUrl, 302);
    }

    // ── Build OG data from property ──
    const tipo = imovel.subtipo || imovel.tipo_imovel || imovel.tipo || "Imóvel";
    const dorms = Number(imovel.dormitorios || imovel.quartos || 0);
    const bairro = imovel.endereco_bairro || imovel.bairro || imovel.endereco?.bairro || "";
    const cidade = imovel.endereco_cidade || imovel.cidade || imovel.endereco?.cidade || "";
    const area = Number(imovel.area_privativa || imovel.area_util || imovel.area || 0);
    const vagas = Number(imovel.vagas || imovel.garagem || 0);
    const valor = Number(imovel.valor_venda || imovel.preco_venda || imovel.valor || 0);
    const empreendimento = imovel.empreendimento_nome || imovel.empreendimento || "";

    // Title: "🏡 Apartamento 3 dormitórios em Moinhos de Vento"
    let ogTitle = imovel.titulo_anuncio || empreendimento || "";
    if (!ogTitle) {
      const tipoCapitalized = tipo.charAt(0).toUpperCase() + tipo.slice(1);
      const dormLabel = dorms > 0 ? ` ${dorms} dormitório${dorms > 1 ? "s" : ""}` : "";
      const localLabel = bairro ? ` em ${bairro}` : "";
      ogTitle = `${tipoCapitalized}${dormLabel}${localLabel}`;
    }
    ogTitle = `🏡 ${ogTitle}`;

    // Description: "120m² • 2 vagas\nValor: R$ 1.250.000"
    const descParts: string[] = [];
    if (area > 0) descParts.push(`${area}m²`);
    if (dorms > 0) descParts.push(`${dorms} dorm${dorms > 1 ? "s" : ""}`);
    if (vagas > 0) descParts.push(`${vagas} vaga${vagas > 1 ? "s" : ""}`);

    let ogDescription = descParts.join(" • ");
    if (valor > 0) {
      ogDescription += ogDescription ? ` — ${fmtBRL(valor)}` : fmtBRL(valor);
    }
    if (bairro) {
      const locStr = cidade ? `${bairro}, ${cidade}` : bairro;
      ogDescription += ogDescription ? ` | ${locStr}` : locStr;
    }
    if (!ogDescription) ogDescription = "Confira este imóvel no UhomeSales";

    // Image: prioritize link_large → link → fallback
    let ogImage = DEFAULT_OG_IMAGE;
    const fullPhotos = imovel._fotos_full;
    const imgArr = imovel.imagens || imovel.fotos || [];

    if (Array.isArray(fullPhotos) && fullPhotos.length > 0) {
      ogImage = fullPhotos[0];
    } else if (Array.isArray(imgArr) && imgArr.length > 0) {
      const first = imgArr[0];
      if (typeof first === "string") {
        ogImage = first;
      } else if (first && typeof first === "object") {
        ogImage = first.link_large || first.link || first.link_thumb || first.url || ogImage;
      }
    } else if (imovel._fotos_normalized?.length > 0) {
      ogImage = imovel._fotos_normalized[0];
    }

    // Ensure absolute URL
    if (ogImage && !ogImage.startsWith("http")) {
      ogImage = `${SPA_ORIGIN}${ogImage.startsWith("/") ? "" : "/"}${ogImage}`;
    }

    const html = buildHtml(canonicalUrl, ogTitle, ogDescription, ogImage);

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("imovel-og error:", err);
    return Response.redirect(spaUrl, 302);
  }
});
