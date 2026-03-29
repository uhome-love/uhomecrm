import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const TYPESENSE_HOST = Deno.env.get('TYPESENSE_HOST')!;
const TYPESENSE_SEARCH_API_KEY = Deno.env.get('TYPESENSE_SEARCH_API_KEY')!;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
const UHOMESITE_URL = Deno.env.get('UHOMESITE_URL') || 'https://uhome.com.br';

const SITE_SUPABASE_URL = "https://huigglwvvzuwwyqvpmec.supabase.co";
const SITE_SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1aWdnbHd2dnp1d3d5cXZwbWVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTMzNzcsImV4cCI6MjA4OTYyOTM3N30.mi8RveT9gYhxP-sfq0GIN1jog-vU3Sxq511LCq5hhw4";
const supabaseSite = createClient(SITE_SUPABASE_URL, SITE_SUPABASE_ANON);

Deno.serve(async () => {
  try {
    // ── 1. Dados do lead de teste ──
    const leadNome = "Lucas";
    const leadTelefone = "5551992597097";
    const bairros = ["Petrópolis", "Moinhos de Vento", "Bela Vista"];
    const tipos = ["apartamento"];
    const valorMin = 400000;
    const valorMax = 700000;
    const dormitoriosMin = 2;

    // ── 2. Busca no Typesense ──
    const q = bairros.join(" ") + " " + tipos.join(" ");
    const params = new URLSearchParams({
      q,
      query_by: "bairro,tipo,titulo",
      filter_by: `valor_venda:>=${valorMin} && valor_venda:<=${valorMax} && dormitorios:>=${dormitoriosMin}`,
      sort_by: "destaque:desc",
      per_page: "3",
    });

    const r = await fetch(
      `https://${TYPESENSE_HOST}/collections/imoveis/documents/search?${params}`,
      { headers: { "X-TYPESENSE-API-KEY": TYPESENSE_SEARCH_API_KEY } }
    );
    const resultado = await r.json();
    const imoveis = (resultado.hits || []).map((h: any) => h.document);

    if (imoveis.length === 0) {
      return new Response(JSON.stringify({ erro: "Nenhum imóvel encontrado" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── 3. Criar vitrine no Supabase externo ──
    const imovelCodigos = imoveis.map((im: any) => String(im.codigo || im.id));
    const titulo = `Seleção para ${leadNome}`;
    const mensagem = `Olá ${leadNome}! Selecionei ${imoveis.length} imóveis especialmente para você.`;

    const { data: vitrine, error: vitrineError } = await supabaseSite
      .from("vitrines")
      .insert({
        titulo,
        mensagem,
        imovel_codigos: imovelCodigos,
        lead_nome: leadNome,
        lead_telefone: leadTelefone,
      })
      .select("id")
      .single();

    if (vitrineError) {
      return new Response(
        JSON.stringify({ erro: "Falha ao criar vitrine", detalhe: vitrineError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const vitrineUrl = `${UHOMESITE_URL}/vitrine/${vitrine.id}`;

    // ── 4. Enviar WhatsApp com link da vitrine ──
    const bairrosTexto = bairros.slice(0, 3).join(", ");
    const tipoTexto = tipos[0].charAt(0).toUpperCase() + tipos[0].slice(1);
    const faixaPreco = `R$ ${(valorMin / 1000).toFixed(0)} mil a R$ ${(valorMax / 1000).toFixed(0)} mil`;

    const payload = {
      messaging_product: "whatsapp",
      to: leadTelefone,
      type: "template",
      template: {
        name: "vitrine_imoveis_personalizada",
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: leadNome },
              { type: "text", text: `${imoveis.length} imóveis selecionados para você` },
              { type: "text", text: bairrosTexto },
              { type: "text", text: tipoTexto },
              { type: "text", text: faixaPreco },
              { type: "text", text: vitrineUrl },
            ],
          },
        ],
      },
    };

    const wr = await fetch(
      `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + WHATSAPP_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    const wres = await wr.json();

    return new Response(
      JSON.stringify({
        sucesso: wr.ok,
        vitrine_id: vitrine.id,
        vitrine_url: vitrineUrl,
        imoveis_encontrados: imoveis.length,
        imovel_codigos: imovelCodigos,
        resposta_meta: wres,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
