// =============================================================================
// Edge Function TEMPORÁRIA: teste-whatsapp-template
// Dispara o template vitrine_imoveis_personalizada com dados reais do 52101-UH
// Link gerado com o formato real do site: /imovel/[slug]-[CODIGO]
// REMOVER após confirmação do teste.
// =============================================================================

const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const UHOMESITE_URL = Deno.env.get("UHOMESITE_URL") || "https://uhome.com.br";

// Dados reais do imóvel 52101-UH
const TITULO    = "Casa em Condomínio no Alto Petrópolis";
const BAIRRO    = "Petrópolis";
const TIPO      = "Casa de Condomínio";
const PRECO     = "R$ 545.000";
const CODIGO    = "52101-UH";

// Gera slug no formato real do site: tipo-dorms-bairro-CODIGO
// Exemplo: casa-3-quartos-petropolis-52101-UH
function slugify(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s-]/g,"").trim().replace(/\s+/g,"-").replace(/-+/g,"-");
}

function gerarSlug(tipo: string, dormitorios: number, bairro: string, codigo: string): string {
  const tipoPrincipal = slugify(tipo.split(" ")[0]);
  const dorms = dormitorios > 0 ? `${dormitorios}-quartos` : "";
  const partes = [tipoPrincipal, dorms, slugify(bairro), codigo].filter(Boolean);
  return partes.join("-");
}

Deno.serve(async (_req) => {
  const linkImovel = `${UHOMESITE_URL}/imovel/${gerarSlug(TIPO, 3, BAIRRO, CODIGO)}`;
  // Deve gerar: https://uhome.com.br/imovel/casa-3-quartos-petropolis-52101-UH

  console.log("[teste-wpp] Link gerado:", linkImovel);

  const payload = {
    messaging_product: "whatsapp",
    to: "5551992597097",
    type: "template",
    template: {
      name: "vitrine_imoveis_personalizada",
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Lucas" },
            { type: "text", text: TITULO },
            { type: "text", text: BAIRRO },
            { type: "text", text: TIPO },
            { type: "text", text: PRECO },
            { type: "text", text: linkImovel },
          ],
        },
      ],
    },
  };

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const resultado = await response.json();
  console.log("[teste-wpp] Resposta Meta:", JSON.stringify(resultado));

  return new Response(
    JSON.stringify({
      sucesso: response.ok,
      status_http: response.status,
      link_gerado: linkImovel,
      resposta_meta: resultado,
    }),
    {
      status: response.ok ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    }
  );
});
