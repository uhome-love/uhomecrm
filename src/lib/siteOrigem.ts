// Leitura do rastreamento de leads do site (página, clique, interesse, fonte do tráfego).
// Pura: recebe dados_site + observacoes e devolve um resumo legível.

export type FonteTrafego = "Google Ads" | "Meta" | "Google orgânico" | "Outro buscador" | "Indicação/outro site" | "Direto" | "Não informada";

/** Código numérico de campanha/anúncio do Meta (nunca mostrar ao corretor). */
export const ehIdMeta = (v: string | null | undefined) => !!v && /^\d{6,}$/.test(v.trim());

export interface SiteOrigem {
  /** Códigos do Meta (campanha/anúncio) a trocar pelo nome. */
  idsMeta: { campanha: string | null; anuncio: string | null };
  ondeClicou: string | null;
  pagina: string | null;
  paginaRotulo: string | null;
  imovel: string | null;
  interesse: string | null;
  bairros: string[];
  filtros: string[];
  aparelho: string | null;
  fonte: FonteTrafego;
  campanha: string | null;
  formulario: string | null;
  /** Fonte pronta enviada pelo site (ex.: "Google Ads — Natal"); senão a calculada. */
  fonteTexto: string;
  palavraPesquisada: string | null;
  entrouPor: string | null;
  visitas: string | null;
  imoveisVistos: string[];
  favoritos: string[];
  buscas: string[];
  conversouLia: boolean;
  clienteVoltou: boolean;
}

function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => {
    if (typeof x === "string") return x.trim();
    if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      return str(o.titulo) ?? str(o.nome) ?? str(o.termo) ?? str(o.resumo) ?? str(o.label) ?? str(o.codigo) ?? "";
    }
    return "";
  }).filter(Boolean);
}

const sim = (v: unknown) => v === true || v === "true" || v === 1 || v === "sim";

function dataBR(v: unknown): string | null {
  const t = str(v);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

function tempo(v: unknown, emSegundos: boolean): string | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const min = Math.round(emSegundos ? n / 60 : n);
  return min < 1 ? "menos de 1 min" : `${min} min`;
}

function rotuloPagina(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? `${u.host} (página inicial)` : `${u.host}${u.pathname}`;
  } catch { return url; }
}

function lerExtras(d: Record<string, unknown>) {
  const ctx = (d.contexto && typeof d.contexto === "object" ? (d.contexto as Record<string, unknown>).rastreamento : null) as Record<string, unknown> | null;
  const r = { ...(ctx ?? {}), ...d } as Record<string, unknown>;
  const n = Number(r.numero_visitas ?? r.visitas);
  const partes: string[] = [];
  if (Number.isFinite(n) && n > 0) partes.push(`${n} visita${n === 1 ? "" : "s"}`);
  const prim = dataBR(r.primeira_visita ?? r.primeira_visita_em ?? r.first_visit);
  if (prim) partes.push(`1ª em ${prim}`);
  const t = tempo(r.tempo_site_segundos ?? r.tempo_no_site_segundos, true) ?? tempo(r.tempo_site_min ?? r.tempo_site_minutos, false);
  if (t) partes.push(`${t} no site`);
  const landing = str(r.landing_url) ?? str(r.primeira_pagina);
  return {
    fonteSite: str(d.fonte) ?? str(ctx?.fonte),
    palavraPesquisada: [str(r.utm_term), str(r.palavra_chave), str(r.termo_busca_google)].find((v) => v && !ehIdMeta(v)) ?? null,
    entrouPor: landing ? rotuloPagina(landing) : null,
    visitas: partes.length ? partes.join(" · ") : null,
    imoveisVistos: lista(r.imoveis_vistos ?? r.ultimos_imoveis),
    favoritos: lista(r.favoritos),
    buscas: lista(r.buscas ?? r.buscas_feitas),
    conversouLia: sim(r.conversou_lia) || sim(r.lia),
    clienteVoltou: sim(r.retorno) || sim(r.cliente_retorno) || sim(r.cliente_voltou) || (Number.isFinite(n) && n > 1),
  };
}

const COMPONENTES: Record<string, string> = {
  exit_intent: "Pop-up de saída",
  retargeting_popup: "Pop-up de retorno",
  floating_whatsapp: "Botão WhatsApp",
  header_cta: "Botão do topo",
  footer_cta: "Botão do rodapé",
  imovel_cta: "Formulário do imóvel",
  detalhe_sidebar: "Formulário do imóvel",
  detalhe_mobile_sticky: "Botão fixo do imóvel (celular)",
  hero_form: "Formulário da página inicial",
  contact_form: "Formulário de contato",
  captacao_imovel: "Quer anunciar imóvel (proprietário)",
};

const TIPOS: Record<string, string> = {
  apartamento: "Apartamento", garden: "Garden", cobertura: "Cobertura", casa: "Casa",
  casa_condominio: "Casa em condomínio", sobrado: "Sobrado", terreno: "Terreno", comercial: "Comercial", studio: "Studio",
};

type Dados = Record<string, unknown> | null | undefined;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function obsCampo(obs: string | null | undefined, chave: string): string | null {
  if (!obs) return null;
  const m = obs.match(new RegExp(`${chave}:\\s*([^\\n|]+)`, "i"));
  return m ? m[1].trim() : null;
}

function moeda(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return v;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1000) return `R$ ${Math.round(n / 1000)} mil`;
  return `R$ ${n}`;
}

const BAIRROS_MULTI = ["três figueiras", "bela vista", "mont serrat", "rio branco", "boa vista", "jardim europa", "praia de belas", "cidade baixa", "menino deus", "santa cecília", "vila assunção", "jardim botânico", "chácara das pedras", "jardim lindóia", "passo d'areia", "alto petrópolis"];

function quebrarBairros(q: string): string[] {
  let resto = ` ${q.toLowerCase()} `;
  const achados: string[] = [];
  for (const b of BAIRROS_MULTI) if (resto.includes(` ${b} `)) { achados.push(b); resto = resto.replace(` ${b} `, " "); }
  const ordem = (b: string) => q.toLowerCase().indexOf(b);
  const todos = [...achados, ...resto.split(/[\s,]+/).filter((p) => p.length > 2)];
  return todos.sort((a, b) => ordem(a) - ordem(b)).map((b) => b.replace(/(^|\s)\S/g, (c) => c.toUpperCase()));
}

export function lerBusca(url: string | null): { filtros: string[]; bairros: string[]; resumo: string | null } {
  if (!url) return { filtros: [], bairros: [], resumo: null };
  let u: URL;
  try { u = new URL(url); } catch { return { filtros: [], bairros: [], resumo: null }; }
  const p = u.searchParams;
  const filtros: string[] = [];
  const tipos = (p.get("tipo") ?? "").split(",").filter(Boolean).map((t) => TIPOS[t] ?? t);
  if (tipos.length) filtros.push(tipos.length > 2 ? `${tipos.slice(0, 2).join(", ")} +${tipos.length - 2}` : tipos.join(", "));
  if (p.get("quartos")) filtros.push(`${p.get("quartos")}+ quartos`);
  if (p.get("vagas")) filtros.push(`${p.get("vagas")}+ vaga${p.get("vagas") === "1" ? "" : "s"}`);
  if (p.get("preco_min")) filtros.push(`a partir de ${moeda(p.get("preco_min")!)}`);
  if (p.get("preco_max")) filtros.push(`até ${moeda(p.get("preco_max")!)}`);
  const bairros = [...(p.get("bairro") ?? p.get("bairros") ?? "").split(",").filter(Boolean), ...(p.get("q") ? quebrarBairros(p.get("q")!) : [])];
  const resumo = filtros.length || bairros.length ? [filtros.join(", "), bairros.length ? `em ${bairros.join(", ")}` : ""].filter(Boolean).join(" ") : null;
  return { filtros, bairros, resumo };
}

export function classificarFonte(d: Dados, pagina: string | null): FonteTrafego {
  const g = (k: string) => str(d?.[k]);
  let params: URLSearchParams | null = null;
  try { params = pagina ? new URL(pagina).searchParams : null; } catch { params = null; }
  const pick = (k: string) => g(k) ?? params?.get(k) ?? null;
  const landing = g("landing_url") ?? "";
  const landingParams = new URLSearchParams(landing.includes("?") ? landing.slice(landing.indexOf("?") + 1) : "");
  const noLanding = (k: string) => landingParams.get(k);
  if (pick("gclid") || pick("gbraid") || pick("wbraid") || noLanding("gclid") || noLanding("gbraid") || noLanding("wbraid") || noLanding("gad_source")) return "Google Ads";
  const src = (pick("utm_source") ?? "").toLowerCase();
  const med = (pick("utm_medium") ?? "").toLowerCase();
  if (pick("fbclid") || /facebook|instagram|meta|^fb$|^ig$/.test(src)) return "Meta";
  if (src.includes("google") && /cpc|ppc|paid|ads/.test(med)) return "Google Ads";
  const ref = (g("referrer") ?? g("referer") ?? g("origem_referrer") ?? "").toLowerCase();
  if (ref.includes("google.")) return "Google orgânico";
  if (/bing\.|yahoo\.|duckduckgo\./.test(ref)) return "Outro buscador";
  if (/facebook\.|instagram\./.test(ref)) return "Meta";
  if (ref && !ref.includes("uhome.com.br")) return "Indicação/outro site";
  if (src) return "Indicação/outro site";
  const origemRef = (g("origem_ref") ?? "").toLowerCase();
  if (ref === "" && ((d != null && "referrer" in d) || origemRef === "direto")) return "Direto";
  return "Não informada";
}

export function lerSiteOrigem(dados: Dados, observacoes?: string | null, empreendimento?: string | null): SiteOrigem {
  const d = dados ?? {};
  const comp = str(d.origem_componente) ?? str(d.origem_detalhe);
  const ondeClicou = comp ? COMPONENTES[comp] ?? comp : obsCampo(observacoes, "Origem");
  const pagina = str(d.pagina_url) ?? str(d.origem_pagina) ?? obsCampo(observacoes, "Página");
  let paginaRotulo: string | null = null;
  if (pagina) {
    try {
      const path = new URL(pagina).pathname;
      paginaRotulo = path.startsWith("/busca") ? "Busca de imóveis" : path.startsWith("/imovel") ? "Página do imóvel" : path === "/" ? "Página inicial" : path;
    } catch { paginaRotulo = "Página do site"; }
  }
  const imovelTit = str(d.imovel_titulo) ?? str(d.imovel_interesse) ?? obsCampo(observacoes, "Imóvel");
  const cod = str(d.imovel_codigo) ?? obsCampo(observacoes, "Código");
  const imovel = imovelTit || cod ? `${imovelTit ?? ""}${cod ? ` (${cod})` : ""}`.trim() : null;
  const busca = lerBusca(pagina);
  const device = (str(d.device) ?? obsCampo(observacoes, "Device") ?? "").toLowerCase();
  const aparelho = device ? (device.includes("mob") ? "Celular" : device.includes("tab") ? "Tablet" : "Computador") : null;
  const ex = lerExtras(d);
  const fonte = classificarFonte(d, pagina);
  const campBruta = str(d.utm_campaign);
  const campanha = ehIdMeta(campBruta) ? null : campBruta;
  const anuncioBruto = [str(d.utm_content), str(d.utm_term)].find((v) => ehIdMeta(v)) ?? null;
  const fonteSite = ex.fonteSite ? ex.fonteSite.replace(/\s*[—·-]\s*\d{6,}/g, "").trim() || null : null;
  return {
    idsMeta: { campanha: ehIdMeta(campBruta) ? campBruta : null, anuncio: anuncioBruto },
    fonteTexto: fonteSite ?? (fonte === "Direto" ? "Acesso direto" : `${fonte}${campanha ? ` — ${campanha}` : ""}`),
    palavraPesquisada: ex.palavraPesquisada,
    entrouPor: ex.entrouPor,
    visitas: ex.visitas,
    imoveisVistos: ex.imoveisVistos,
    favoritos: ex.favoritos,
    buscas: ex.buscas,
    conversouLia: ex.conversouLia,
    clienteVoltou: ex.clienteVoltou,
    ondeClicou,
    pagina,
    paginaRotulo,
    imovel,
    interesse: busca.resumo ?? (empreendimento && !/lead geral/i.test(empreendimento) ? empreendimento : null),
    bairros: busca.bairros,
    filtros: busca.filtros,
    aparelho,
    fonte,
    campanha,
    formulario: str(d.formulario) ?? str(d.form_nome) ?? (comp ? COMPONENTES[comp] ?? null : null),
  };
}
