export interface NatalProduto {
  slug: string; nome: string; bairro?: string | null; cidade?: string | null; capa_url?: string | null;
  preco_texto?: string | null; preco_a_partir?: number | null; entrega?: string | null; url: string; mensagem?: string | null;
}
export interface NatalLinksResposta {
  ok: boolean;
  corretor: { nome: string; slug: string; foto_url?: string | null; tem_foto: boolean };
  campanha: { slug: string; nome: string; fim: string };
  campanha_url: string;
  produtos: NatalProduto[];
}

export function formatarPreco(valor?: number | null, texto?: string | null): string {
  if (typeof valor === "number" && valor > 0) {
    return "a partir de " + valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  }
  return texto?.trim() || "Consulte valores";
}

export function linkWhatsApp(mensagem: string, url: string): string {
  const texto = mensagem.includes(url) ? mensagem : `${mensagem.trim()}\n\n${url}`.trim();
  return "https://wa.me/?text=" + encodeURIComponent(texto);
}

/** Campanha encerrada quando a data de fim (BRT, dia inteiro) já passou. */
export function campanhaEncerrada(fim: string, agora = new Date()): boolean {
  const limite = new Date(`${fim}T23:59:59-03:00`);
  return !isNaN(limite.getTime()) && agora > limite;
}

export function dataBR(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

const SITE = "https://uhome.com.br";
/** O site manda fotos com caminho relativo (/__l5e/...); completa com o domínio do site. */
export function urlSite(u?: string | null): string | null {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return SITE + (u.startsWith("/") ? u : `/${u}`);
}
