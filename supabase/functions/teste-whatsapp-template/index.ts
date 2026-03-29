// =============================================================================
// Edge Function TEMPORÁRIA: teste-whatsapp-template
// Dispara o template vitrine_imoveis_personalizada com dados reais do 52101-UH
// REMOVER após confirmação do teste.
// =============================================================================

const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const UHOMESITE_URL = Deno.env.get("UHOMESITE_URL") || "https://uhome.com.br";

Deno.serve(async (_req) => {
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
            { type: "text", text: "Casa em Condomínio no Alto Petrópolis" },
            { type: "text", text: "Petrópolis" },
            { type: "text", text: "Casa de Condomínio" },
            { type: "text", text: "R$ 545.000" },
            { type: "text", text: `${UHOMESITE_URL}/imoveis/52101-UH` },
          ],
        },
      ],
    },
  };

  console.log("[teste-wpp] Disparando template...");

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
      resposta_meta: resultado,
    }),
    {
      status: response.ok ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    }
  );
});
