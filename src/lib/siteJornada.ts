// Leitura pura da jornada enviada pelo site (dados_site.jornada, contrato v1).
// Usa uma só lista de eventos, deduplica por event_id, ignora robôs, normaliza aliases e corta 90 dias.
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export interface EventoJornada { id: string; sessao: string; tipo: string; pagina: string | null; imovel: string | null; dados: Obj; quando: Date }
export interface OrigemJornada { fonte: string; campanha: string | null; data: Date | null; anuncio: "Google" | "Meta" | null }
export interface SessaoJornada { id: string; inicio: Date; fim: Date; eventos: EventoJornada[] }
export interface PedidoJornada { tipo: "visita" | "informacoes"; texto: string; quando: Date }
export interface Jornada {
  primeira: OrigemJornada | null; ultima: OrigemJornada | null;
  visitas: number; primeiraVisita: Date | null;
  imoveis: { titulo: string; vezes: number }[];
  procurou: string[]; favoritos: string[]; pedidos: PedidoJornada[];
  sessoes: SessaoJornada[];
}

export const ALIASES: Record<string, string> = {
  imovel_visualizado: "imovel_visto", busca_realizada: "busca_feita", whatsapp_click: "whatsapp_tocado",
  galeria_aberta: "foto_aberta", formulario_enviado: "informacoes_pedidas",
};
// Eventos que não ajudam o corretor e ficam fora da linha do tempo.
const OCULTOS = new Set(["rolagem_50", "foto_aberta", "pagina_anuncio_vista", "formulario_iniciado"]);

export const ROTULO: Record<string, string> = {
  pagina_vista: "Viu página", busca_feita: "Buscou", categoria_tocada: "Tocou categoria", filtro_aplicado: "Aplicou filtro",
  imovel_visto: "Viu imóvel", favorito_salvo: "Salvou favorito", dia_escolhido: "Escolheu dia", visita_pedida: "Pediu visita",
  informacoes_pedidas: "Pediu informações", lia_aberta: "Abriu a LIA", lia_lead: "Deixou contato na LIA",
  whatsapp_tocado: "Tocou no WhatsApp", simulacao_feita: "Fez simulação", pedido_corretor: "Pediu corretor",
};

function fonteNome(o: Obj): OrigemJornada | null {
  const src = str(o.utm_source); const ref = str(o.referrer);
  const g = str(o.gclid) || str(o.gbraid) || str(o.wbraid); const m = str(o.fbclid);
  let fonte = src ?? (g ? "google" : m ? "meta" : ref ? ref.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : null);
  if (!fonte && !str(o.landing_page)) return null;
  fonte = fonte ? (/google/i.test(fonte) ? "Google" : /facebook|instagram|meta|fb|ig/i.test(fonte) ? "Meta" : fonte[0].toUpperCase() + fonte.slice(1)) : "Direto";
  const at = str(o.at);
  return { fonte, campanha: str(o.utm_campaign), data: at ? new Date(at) : null, anuncio: g ? "Google" : m ? "Meta" : null };
}

const fmtDia = (d: string) => { const [, mm, dd] = d.split("-"); return dd && mm ? `${dd}/${mm}` : d; };

export function lerEventos(dadosSite: unknown, agora = new Date()): EventoJornada[] {
  const ds = obj(dadosSite); const j = obj(ds.jornada);
  const lista = arr(j.site_events).length ? arr(j.site_events) : arr(ds.site_events);
  const limite = agora.getTime() - 90 * 86400000;
  const vistos = new Set<string>(); const chaves = new Set<string>(); const out: EventoJornada[] = [];
  const brutos = lista.map(obj).filter((e) => str(e.event_id) && str(e.quando) && e.is_bot !== true);
  // Canônicos primeiro, para que um alias equivalente na mesma sessão/minuto seja descartado.
  brutos.sort((a, b) => Number(String(a.tipo) in ALIASES) - Number(String(b.tipo) in ALIASES));
  for (const e of brutos) {
    const id = String(e.event_id); if (vistos.has(id)) continue; vistos.add(id);
    const quando = new Date(String(e.quando)); if (isNaN(+quando) || +quando < limite) continue;
    const bruto = String(e.tipo ?? ""); const tipo = ALIASES[bruto] ?? bruto;
    const sessao = str(e.session_id) ?? "sem-sessao";
    const chave = `${sessao}|${tipo}|${quando.toISOString().slice(0, 16)}`;
    if (bruto in ALIASES && chaves.has(chave)) continue; chaves.add(chave);
    out.push({ id, sessao, tipo, pagina: str(e.pagina), imovel: str(obj(e.imovel).titulo), dados: obj(e.dados), quando });
  }
  return out.sort((a, b) => +a.quando - +b.quando);
}

export function textoPedido(e: EventoJornada): string {
  const d = e.dados; const planta = str(d.planta);
  if (e.tipo === "visita_pedida") return ["Visita", str(d.dia) && `${fmtDia(String(d.dia))}${str(d.periodo) ? ` ${d.periodo}` : ""}`, str(d.horario), planta && `planta ${planta}`, e.imovel].filter(Boolean).join(" · ");
  const assunto = str(d.assunto)?.replace(/_/g, " ");
  return ["Informações", assunto, planta && `planta ${planta}`, e.imovel].filter(Boolean).join(" · ");
}

export function detalheEvento(e: EventoJornada): string | null {
  if (e.tipo === "visita_pedida" || e.tipo === "informacoes_pedidas") return textoPedido(e).replace(/^(Visita|Informações) · ?/, "") || null;
  if (e.imovel) return e.imovel;
  const f = str(e.dados.filtros) ?? str(e.dados.categoria);
  if (f) return f;
  return e.pagina === "/" ? "Início" : e.pagina;
}

/** Sessões com eventos úteis; páginas vistas seguidas viram "Viu N páginas". */
export function agruparSessoes(eventos: EventoJornada[]): SessaoJornada[] {
  const mapa = new Map<string, EventoJornada[]>();
  for (const e of eventos) { if (!mapa.has(e.sessao)) mapa.set(e.sessao, []); mapa.get(e.sessao)!.push(e); }
  const out: SessaoJornada[] = [];
  for (const [id, evs] of mapa) {
    const uteis: EventoJornada[] = [];
    for (const e of evs) {
      if (OCULTOS.has(e.tipo)) continue;
      const ant = uteis[uteis.length - 1];
      if (e.tipo === "pagina_vista" && ant?.tipo === "pagina_vista") { ant.dados = { ...ant.dados, _n: Number(ant.dados._n ?? 1) + 1 }; continue; }
      if (e.tipo === "pagina_vista" && ant?.tipo === "imovel_visto" && ant.pagina === e.pagina) continue;
      uteis.push({ ...e, dados: { ...e.dados } });
    }
    if (!uteis.length) continue;
    out.push({ id, inicio: evs[0].quando, fim: evs[evs.length - 1].quando, eventos: uteis });
  }
  return out.sort((a, b) => +b.inicio - +a.inicio);
}

export function lerJornada(dadosSite: unknown, agora = new Date()): Jornada | null {
  const ds = obj(dadosSite); const j = obj(ds.jornada);
  const eventos = lerEventos(dadosSite, agora);
  if (!Object.keys(j).length && !eventos.length) return null;
  const imoveis = arr(j.imoveis_vistos).map(obj)
    .map((i) => ({ titulo: str(i.titulo) ?? str(i.slug)?.replace(/^em-foco\//, "") ?? "", vezes: Number(i.vezes) || 1 }))
    .filter((i) => i.titulo).sort((a, b) => b.vezes - a.vezes).slice(0, 5);
  const procurou = new Set<string>();
  for (const b of [...arr(j.buscas), ...arr(j.filtros)].map(obj))
    for (const [k, v] of Object.entries(b)) if (k !== "quando" && (typeof v === "string" || typeof v === "number") && String(v).trim()) procurou.add(String(v));
  const favoritos = [...new Set(arr(j.favoritos).map((f) => str(obj(obj(f).imovel).titulo)).filter((t): t is string => !!t))];
  const pedidos = eventos.filter((e) => e.tipo === "visita_pedida" || e.tipo === "informacoes_pedidas")
    .map((e) => ({ tipo: e.tipo === "visita_pedida" ? "visita" as const : "informacoes" as const, texto: textoPedido(e), quando: e.quando }))
    .reverse();
  const pv = str(j.primeira_visita);
  const sessoes = agruparSessoes(eventos);
  return {
    primeira: fonteNome(obj(j.primeira_origem)), ultima: fonteNome(obj(j.ultima_origem)),
    visitas: Number(j.numero_visitas) || sessoes.length, primeiraVisita: pv ? new Date(pv) : eventos[0]?.quando ?? null,
    imoveis, procurou: [...procurou].slice(0, 8), favoritos, pedidos, sessoes,
  };
}
