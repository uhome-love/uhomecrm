// Primitivas de envio Meta WhatsApp Cloud API compartilhadas entre workers.
// Extraídas de reengajamento-descartados-enqueue para reuso pelo novo worker
// (reengajamento-worker-tick) sem duplicar lógica de upload de media e template.

export async function uploadMetaMediaFromUrl(
  phoneNumberId: string,
  accessToken: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) return null;
    const contentType = imgResp.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append(
      "file",
      new Blob([bytes], { type: contentType }),
      `header.${contentType.includes("png") ? "png" : "jpg"}`,
    );
    const up = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      },
    );
    const data = await up.json().catch(() => ({}));
    if (!up.ok) {
      console.error(
        "uploadMetaMediaFromUrl failed:",
        JSON.stringify(data).slice(0, 300),
      );
      return null;
    }
    return data?.id || null;
  } catch (e) {
    console.error(
      "uploadMetaMediaFromUrl error:",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

export type SendMetaTemplateParams = {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  lang: string;
  nome: string;
  headerImageUrl?: string;
  headerMediaId?: string;
};

export type SendMetaTemplateResult = {
  ok: boolean;
  wamid?: string;
  error?: string;
  statusCode?: number;
};

export async function sendMetaTemplate(
  params: SendMetaTemplateParams,
): Promise<SendMetaTemplateResult> {
  const url = `https://graph.facebook.com/v21.0/${params.phoneNumberId}/messages`;
  const buildBody = (withHeader: boolean) => {
    const components: any[] = [];
    if (withHeader && (params.headerMediaId || params.headerImageUrl)) {
      const image = params.headerMediaId
        ? { id: params.headerMediaId }
        : { link: params.headerImageUrl };
      components.push({
        type: "header",
        parameters: [{ type: "image", image }],
      });
    }
    components.push({
      type: "body",
      parameters: [{ type: "text", text: params.nome }],
    });
    return {
      messaging_product: "whatsapp",
      to: params.to,
      type: "template",
      template: {
        name: params.templateName,
        language: { code: params.lang },
        components,
      },
    };
  };
  const post = async (withHeader: boolean) => {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildBody(withHeader)),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, data, status: r.status };
  };
  try {
    let resp = await post(true);
    // Auto-retry sem header quando o template não tem header component (Meta #132018)
    if (!resp.ok && (params.headerImageUrl || params.headerMediaId)) {
      const errStr = JSON.stringify(resp.data);
      if (
        /132018|does not contain (title|header) component|no parameters allowed/i
          .test(errStr)
      ) {
        resp = await post(false);
      }
    }
    if (!resp.ok) {
      return {
        ok: false,
        error: JSON.stringify(resp.data).slice(0, 300),
        statusCode: resp.status,
      };
    }
    const wamid = resp.data?.messages?.[0]?.id;
    return { ok: true, wamid, statusCode: resp.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // BR: garante 55 na frente
  if (digits.length >= 12 && digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}
