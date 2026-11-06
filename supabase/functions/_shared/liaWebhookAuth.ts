import { hmacSha256Hex, timingSafeEqual } from "./webhook-signature.ts";

/** 360dialog recebe header configurado no provedor; nunca confundir chave de saída com assinatura. */
export async function webhookLiaAutorizado(req: Request, raw: string): Promise<boolean> {
  const secret = Deno.env.get("LIA_CRON_SECRET");
  const header = req.headers.get("x-lia-secret");
  if (secret && header && timingSafeEqual(header,secret)) return true;
  const meta = Deno.env.get("META_WEBHOOK_SECRET");
  const sig = req.headers.get("x-hub-signature-256");
  return !!meta && !!sig && timingSafeEqual(sig,`sha256=${await hmacSha256Hex(meta,raw)}`);
}