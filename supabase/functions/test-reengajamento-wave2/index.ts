// Teste manual: envia template wave 2 para um número específico.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const to = String(body.to || "").replace(/\D/g, "");
  const nome = String(body.nome || "Você");
  const templateName = String(body.template || "casatua_maio");
  const lang = String(body.lang || "pt_BR");
  const headerImageUrl = String(body.header_image_url || "");

  if (!to) return new Response(JSON.stringify({ error: "missing 'to'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
  if (!phoneNumberId || !accessToken) {
    return new Response(JSON.stringify({ error: "Meta env vars missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const components: any[] = [];
  if (headerImageUrl) {
    components.push({ type: "header", parameters: [{ type: "image", image: { link: headerImageUrl } }] });
  }
  components.push({ type: "body", parameters: [{ type: "text", text: nome }] });

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name: templateName, language: { code: lang }, components },
  };

  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  return new Response(JSON.stringify({ status: r.status, ok: r.ok, response: data, sent_payload: payload }), {
    status: r.ok ? 200 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
