/**
 * metaTracking — Captura contexto de navegador (fbclid, cookie _fbp, user_agent, URL)
 * para elevar a Match Quality dos eventos CAPI enviados ao Meta.
 *
 * Fluxo:
 * 1) Ao carregar qualquer página, `captureFbclid()` guarda `?fbclid=...` em localStorage
 *    (com timestamp). Assim, se o usuário clicar num anúncio, navegar e só depois
 *    preencher um formulário, o fbclid ainda está disponível.
 * 2) Ao submeter um formulário de lead, `getMetaContext()` retorna { fbc, fbp, fbclid,
 *    user_agent, event_source_url } para incluir no body do webhook.
 *
 * Ganho principal: leads de site/landing (~2% do volume). Leads Meta Lead Ads (form
 * interno) já mandam `lead_id` e não precisam disso.
 */

const FBCLID_KEY = "uhome_fbclid";
const FBCLID_TS_KEY = "uhome_fbclid_ts";
// fbclid vale por 7 dias (janela padrão do Meta antes de "envelhecer")
const FBCLID_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Lê um cookie por nome. Retorna null se ausente. */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

/** Chamar em `useEffect(() => { captureFbclid(); }, [])` na landing (ou no App root). */
export function captureFbclid(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid");
    if (fbclid) {
      localStorage.setItem(FBCLID_KEY, fbclid);
      localStorage.setItem(FBCLID_TS_KEY, Date.now().toString());
    }
  } catch {
    // localStorage bloqueado (modo anônimo) — ignora silenciosamente
  }
}

function getStoredFbclid(): { fbclid: string | null; timestamp: number | null } {
  try {
    const fbclid = localStorage.getItem(FBCLID_KEY);
    const tsRaw = localStorage.getItem(FBCLID_TS_KEY);
    const timestamp = tsRaw ? parseInt(tsRaw, 10) : null;
    if (!fbclid || !timestamp) return { fbclid: null, timestamp: null };
    if (Date.now() - timestamp > FBCLID_MAX_AGE_MS) {
      return { fbclid: null, timestamp: null };
    }
    return { fbclid, timestamp };
  } catch {
    return { fbclid: null, timestamp: null };
  }
}

export interface MetaContext {
  fbc: string | null;
  fbp: string | null;
  fbclid: string | null;
  user_agent: string | null;
  event_source_url: string | null;
}

/**
 * Retorna o contexto de navegador pronto para ser enviado ao webhook.
 * Todos os campos são opcionais — o backend faz o merge/fallback (ex.: constrói
 * `fbc` a partir de `fbclid` se `fbc` não vier).
 */
export function getMetaContext(): MetaContext {
  if (typeof window === "undefined") {
    return { fbc: null, fbp: null, fbclid: null, user_agent: null, event_source_url: null };
  }

  const { fbclid, timestamp } = getStoredFbclid();
  // Constrói fbc no formato oficial Meta: fb.1.{timestamp_ms}.{fbclid}
  const fbc = fbclid && timestamp ? `fb.1.${timestamp}.${fbclid}` : null;
  // Cookie _fbp é gravado pelo Pixel do site. Se o Pixel não está carregado, vem null.
  const fbp = readCookie("_fbp");
  const user_agent = navigator?.userAgent || null;
  const event_source_url = window.location.href || null;

  return { fbc, fbp, fbclid, user_agent, event_source_url };
}
