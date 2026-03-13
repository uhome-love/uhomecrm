import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|twitterbot|linkedinbot|preview|fetch|curl|wget|python|go-http|insomnia|postman/i;

const DEFAULT_OG_IMAGE = "https://uhomesales.com/og-image.png";
const SPA_ORIGIN = "https://uhomeia.lovable.app";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(
  spaUrl: string,
  ogTitle: string,
  ogDescription: string,
  ogImage: string,
): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(ogTitle)}</title>
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${esc(spaUrl)}" />
  <meta property="og:title" content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(ogDescription)}" />
  <meta property="og:image" content="${esc(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="UhomeSales" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDescription)}" />
  <meta name="twitter:image" content="${esc(ogImage)}" />
  <link rel="canonical" href="${esc(spaUrl)}" />
</head>
<body>
  <p><a href="${esc(spaUrl)}">${esc(ogTitle)}</a></p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const vitrineId = url.searchParams.get("id");

  if (!vitrineId) {
    return new Response("Missing vitrine id", { status: 400 });
  }

  const spaUrl = `${SPA_ORIGIN}/vitrine/${vitrineId}`;
  const userAgent = req.headers.get("user-agent") || "";
  const isBot = BOT_UA.test(userAgent);

  // For regular browsers, redirect to the SPA
  if (!isBot) {
    return Response.redirect(spaUrl, 302);
  }

  // ── Bot / crawler path: build OG HTML ──
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: vitrine } = await supabase
      .from("vitrines")
      .select(
        "titulo, subtitulo, mensagem_corretor, imovel_ids, tipo, dados_custom, hero_url, created_by",
      )
      .eq("id", vitrineId)
      .maybeSingle();

    if (!vitrine) {
      return Response.redirect(spaUrl, 302);
    }

    // Fetch corretor name
    const { data: corretor } = await supabase
      .from("profiles")
      .select("nome")
      .eq("user_id", vitrine.created_by)
      .maybeSingle();

    let ogTitle = vitrine.titulo || "Vitrine de Imóveis";
    let ogDescription =
      vitrine.mensagem_corretor || "Confira esta seleção exclusiva de imóveis";
    let ogImage = vitrine.hero_url || DEFAULT_OG_IMAGE;

    // ── product_page (e.g. ORYGEM campaign vitrines) ──
    if (vitrine.tipo === "product_page" && vitrine.dados_custom) {
      const custom = (vitrine.dados_custom as any[]) || [];
      if (custom.length > 0) {
        const first = custom[0];
        const nome = first.nome || first.empreendimento || "";
        if (nome) {
          ogTitle = `${nome} | UhomeSales`;
        }
        if (first.descricao) {
          ogDescription = first.descricao.substring(0, 160);
        } else if (first.bairro) {
          ogDescription = `${first.bairro} — ${ogDescription}`;
        }
        // Pick best image: first photo from dados_custom, then hero_url, then fallback
        const fotos = first.fotos || first.imagens || [];
        if (fotos.length > 0) {
          ogImage = fotos[0];
        } else if (first.imagem) {
          ogImage = first.imagem;
        }
      }
    }
    // ── melnick_day vitrines ──
    else if (vitrine.tipo === "melnick_day" && vitrine.dados_custom) {
      const custom = (vitrine.dados_custom as any[]) || [];
      if (custom.length > 0) {
        const first = custom[0];
        ogTitle = `${vitrine.titulo || "Melnick Day"} — ${custom.length} empreendimentos`;
        ogDescription = custom
          .map((c: any) => c.nome)
          .slice(0, 3)
          .join(", ");
        const imgs =
          first.imagens?.length > 0
            ? first.imagens
            : first.imagem
              ? [first.imagem]
              : [];
        if (imgs.length > 0) ogImage = imgs[0];
      }
    }
    // ── property_selection (generic imovel_ids) ──
    else {
      const ids = (vitrine.imovel_ids as string[]) || [];
      if (ids.length > 0) {
        // Try empreendimento_overrides first
        const { data: overrides } = await supabase
          .from("empreendimento_overrides")
          .select("nome, fotos, descricao, landing_titulo, bairro")
          .in("codigo", ids)
          .limit(1);

        if (overrides && overrides.length > 0) {
          const ov = overrides[0];
          if (ov.fotos && ov.fotos.length > 0) ogImage = ov.fotos[0];
          if (ov.landing_titulo) ogTitle = ov.landing_titulo;
          if (ov.descricao) ogDescription = ov.descricao.substring(0, 155);
          if (ov.bairro) ogDescription = `${ov.bairro} — ${ogDescription}`;
        } else {
          // Fallback to Jetimob API
          const JETIMOB_API_KEY = Deno.env.get("JETIMOB_API_KEY");
          if (JETIMOB_API_KEY) {
            try {
              const res = await fetch(
                `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/codigo/${ids[0]}?v=6`,
                {
                  headers: { Accept: "application/json" },
                  signal: AbortSignal.timeout(5000),
                },
              );
              if (res.ok) {
                const data = await res.json();
                const item = data?.result || data?.data || data;
                if (item) {
                  const imgArr = item.imagens || item.fotos || [];
                  if (imgArr.length > 0) {
                    ogImage =
                      imgArr[0].link ||
                      imgArr[0].link_thumb ||
                      imgArr[0].url ||
                      ogImage;
                  }
                  ogTitle =
                    item.titulo_anuncio || item.titulo || ogTitle;
                  const bairro =
                    item.endereco?.bairro || item.bairro || "";
                  if (bairro)
                    ogDescription = `${bairro} — ${ogDescription}`;
                }
              }
            } catch {
              /* skip */
            }
          }
        }
      }
    }

    // Append corretor name to description
    if (corretor?.nome) {
      ogDescription = `${corretor.nome} · ${ogDescription}`;
    }

    // Ensure absolute image URL
    if (ogImage && !ogImage.startsWith("http")) {
      ogImage = `${SPA_ORIGIN}${ogImage.startsWith("/") ? "" : "/"}${ogImage}`;
    }

    const html = buildHtml(spaUrl, ogTitle, ogDescription, ogImage);

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("vitrine-og error:", err);
    return Response.redirect(spaUrl, 302);
  }
});
