/**
 * Lia Recupera — regras únicas de escolha de modelo e montagem das informações ({{n}}).
 * Usado pelo envio e pela simulação (mesmo código), e pelos testes do site.
 * Sem dependências: roda em Deno e no Vitest.
 */

export const RECUPERA_FIM_BRT = "2026-12-18"; // fim do Natal Chave de Ouro: todos os 6 modelos param depois
export const RECUPERA_LANG = "pt_BR";

export type ModeloKey =
  | "lia_recupera_a" | "lia_recupera_b" | "lia_recupera_c" | "lia_recupera_d"
  | "lia_recupera_lembrete" | "lia_recupera_final";

export const MODELOS_KEYS: ModeloKey[] = [
  "lia_recupera_a", "lia_recupera_b", "lia_recupera_c", "lia_recupera_d", "lia_recupera_lembrete", "lia_recupera_final",
];

/** Quantidade de informações no corpo de cada modelo aprovado na Meta. */
export const MODELO_VARS: Record<ModeloKey, number> = {
  lia_recupera_a: 2, lia_recupera_b: 2, lia_recupera_c: 2, lia_recupera_d: 1, lia_recupera_lembrete: 3, lia_recupera_final: 1,
};

/** Textos aprovados na Meta em 05/11/2026 (iguais aos de src/lia/recupera.ts — conferido em teste). */
export const MODELO_TEXTO: Record<ModeloKey, string> = {
  lia_recupera_a: "Olá {{1}}, tudo bem? Aqui é a Lia, do Relacionamento da Uhome 😊\n\nVocê pediu informações sobre o {{2}} e eu trouxe uma novidade: começou o *Natal Chave de Ouro*, com a melhor condição do ano em 8 imóveis de Porto Alegre e Canoas, a partir de R$ 240 mil. E quem fecha na campanha ainda ganha um presente de Natal 🎁\n\nQuer ver as opções? Se hoje você busca outro perfil, também te ajudo 👇",
  lia_recupera_b: "Olá {{1}}, tudo bem? Aqui é a Lia, do Relacionamento da Uhome 😊\n\nVocê conversou com o nosso time sobre o {{2}}, e agora no fim do ano surgiu algo novo: no *Natal Chave de Ouro*, as construtoras liberaram a melhor condição do ano em 8 imóveis. Se na época o que pesou foi entrada ou parcela, vale olhar de novo.\n\nE quem fecha na campanha ainda ganha um presente de Natal 🎁\n\nAinda faz sentido para você? Posso te mostrar nesse perfil ou em outro 👇",
  lia_recupera_c: "Olá {{1}}, tudo bem? Aqui é a Lia, do Relacionamento da Uhome 😊\n\nVi que o seu atendimento sobre o {{2}} ficou parado, e te peço desculpas por isso. Quero retomar do jeito certo, com um especialista acompanhando você.\n\nE chegou numa boa hora: no *Natal Chave de Ouro* temos 8 imóveis com a melhor condição do ano, e quem fecha ainda ganha um presente de Natal 🎁\n\nPosso te mostrar as opções? 👇",
  lia_recupera_d: "Olá {{1}}, tudo bem? Aqui é a Lia, do Relacionamento da Uhome 😊\n\nVocê falou com o nosso time sobre imóveis, e eu trouxe uma novidade: começou o *Natal Chave de Ouro*. São 8 imóveis entre apartamentos, casas e alto padrão em Porto Alegre e Canoas, a partir de R$ 240 mil, com a melhor condição do ano.\n\nE quem fecha na campanha ainda ganha um presente de Natal 🎁\n\nQuer ver as opções? Se preferir, me conta o que você busca que eu separo o que combina 👇",
  lia_recupera_lembrete: "Oi {{1}}, separei uma oportunidade do Natal que pode combinar com você: o {{2}}, com {{3}} 🏡\n\nA condição é só de fim de ano. Quer que eu te conte como funciona?",
  lia_recupera_final: "Oi {{1}}, não quero te incomodar 🙂\n\nVou encerrar seu atendimento por aqui. Só não queria que você perdesse o *Natal Chave de Ouro* sem nem dar uma olhada: as condições valem só até o fim do ano.\n\nQuer ver as opções antes de eu encerrar? 👇",
};

export const isModeloRecupera = (k: string | null | undefined): k is ModeloKey =>
  !!k && (MODELOS_KEYS as string[]).includes(k);

/** Todos os 6 modelos citam o Natal: nada sai depois de 18/12 (data BRT aaaa-mm-dd). */
export function recuperaVigente(hojeBRT: string): boolean {
  return hojeBRT <= RECUPERA_FIM_BRT;
}

export function hojeBRT(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 3600000).toISOString().slice(0, 10);
}

// ---------- Limpeza das informações ----------
export function limparParam(v: string): string {
  return (v || "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const norm = (s: string) => semAcento(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// ---------- Nome ----------
const GENERICOS = new Set(["cliente", "lead", "wpp", "whatsapp", "teste", "test", "sem", "nome", "sem nome", "nao", "informado", "contato", "sr", "sra", "dr", "dra", "x", "xx"]);

/** Primeiro nome válido com inicial maiúscula, ou null (→ "sem_nome"). */
export function primeiroNomeValido(raw: string | null | undefined): string | null {
  const limpo = limparParam(raw || "");
  if (!limpo) return null;
  if (GENERICOS.has(norm(limpo))) return null;
  const primeiro = limpo.split(" ")[0];
  if (!/^[\p{L}][\p{L}'-]*$/u.test(primeiro)) return null; // sem números, emoji ou símbolos
  if ((primeiro.match(/\p{L}/gu) ?? []).length < 2) return null;
  if (GENERICOS.has(norm(primeiro))) return null;
  const low = primeiro.toLocaleLowerCase("pt-BR");
  return low.charAt(0).toLocaleUpperCase("pt-BR") + low.slice(1);
}

// ---------- Empreendimento ----------
export interface Canonico { id: string; nome: string }
export interface Alias { alias_norm: string; empreendimento_id: string }

/** Nomes que vão para o cliente em vez do nome canônico interno. */
const NOME_COMERCIAL: Record<string, string> = {
  "connect jw": "Connect João Wallig",
  "boa vista": "Boa Vista Country Club",
};
const IGNORAR = new Set(["avulso", "curadoria", "melnick day"]);
const APELIDOS_INICIO: Array<[string, string]> = [
  ["casa tua alto petropolis", "Casa Tua Porto Alegre"],
  ["casa tua poa", "Casa Tua Porto Alegre"],
  ["casa tua santos ferreira", "Casa Tua Canoas"],
];

export interface ResultadoEmpreendimento { nome: string | null; canonico: string | null; via: "alias" | "inicio" | "nenhum" }

/**
 * Converte o texto do lead ("Casa Tua Canoas v6 - Videos Novos - Tst") para o nome oficial.
 * 1) empreendimento_aliases; 2) nome canônico no começo do texto (o mais longo); "Casa Tua" sozinho = Porto Alegre.
 */
interface Indice { porAlias: Map<string, string>; canon: Array<{ nome: string; k: string }> }
const indices = new WeakMap<Canonico[], WeakMap<Alias[], Indice>>();
function indice(canonicos: Canonico[], aliases: Alias[]): Indice {
  let m = indices.get(canonicos); if (!m) { m = new WeakMap(); indices.set(canonicos, m); }
  let ix = m.get(aliases);
  if (!ix) {
    const porId = new Map(canonicos.map((c) => [c.id, c.nome]));
    const porAlias = new Map<string, string>();
    for (const a of aliases) { const nome = porId.get(a.empreendimento_id); const k = norm(a.alias_norm); if (nome && k && !porAlias.has(k)) porAlias.set(k, nome); }
    const canon = canonicos.map((c) => ({ nome: c.nome, k: norm(c.nome) })).filter((c) => c.k).sort((a, b) => b.k.length - a.k.length);
    ix = { porAlias, canon }; m.set(aliases, ix);
  }
  return ix;
}

/**
 * Converte o texto do lead ("Casa Tua Canoas v6 - Videos Novos - Tst") para o nome oficial.
 * 1) empreendimento_aliases; 2) nome canônico no começo do texto (o mais longo); "Casa Tua" sozinho = Porto Alegre.
 */
export function converterEmpreendimento(raw: string | null | undefined, canonicos: Canonico[], aliases: Alias[]): ResultadoEmpreendimento {
  const n = norm(raw || "");
  if (!n) return { nome: null, canonico: null, via: "nenhum" };
  const ix = indice(canonicos, aliases);
  let canon: string | null = ix.porAlias.get(n) ?? null;
  let via: ResultadoEmpreendimento["via"] = canon ? "alias" : "nenhum";
  if (!canon) {
    for (const [ap, nome] of APELIDOS_INICIO) if (n === ap || n.startsWith(ap + " ")) { canon = nome; via = "inicio"; break; }
  }
  if (!canon) {
    const c = ix.canon.find(({ k }) => n === k || n.startsWith(k + " "));
    if (c) { canon = c.nome; via = "inicio"; }
  }
  if (!canon && (n === "casa tua" || n.startsWith("casa tua "))) { canon = "Casa Tua Porto Alegre"; via = "inicio"; }
  if (!canon || IGNORAR.has(norm(canon))) return { nome: null, canonico: canon, via: canon ? via : "nenhum" };
  const nome = limparParam(NOME_COMERCIAL[norm(canon)] ?? canon).replace(/^(o|a|os|as)\s+/i, "");
  return { nome, canonico: canon, via };
}

// ---------- Escolha do modelo ----------
export type Motivo = string; // balde da base da Lia
const MOTIVOS_B = new Set(["sem_interesse_momento", "sem_condicao_financeira", "desistiu_compra"]);

export interface ClienteRecupera {
  nome: string | null;
  balde: Motivo;
  empreendimentoRaw: string | null;
  teveContatoHumano: boolean;
  corretorInativo: boolean;
}

export type Escolha =
  | { ok: true; modelo: ModeloKey; base: "A" | "B" | "C" | "D"; nome: string; empreendimento: string | null; motivo: string }
  | { ok: false; motivo: "sem_nome" };

/** Ordem aprovada: sem contato → C; sem interesse/financeiro/desistiu → B; corretor saiu → C; demais → A; sem empreendimento → D. */
export function escolherModelo(c: ClienteRecupera, canonicos: Canonico[], aliases: Alias[]): Escolha {
  const nome = primeiroNomeValido(c.nome);
  if (!nome) return { ok: false, motivo: "sem_nome" };
  let base: "A" | "B" | "C"; let motivo: string;
  if (!c.teveContatoHumano) { base = "C"; motivo = "Descartado sem tentativa de contato do corretor"; }
  else if (MOTIVOS_B.has(c.balde)) { base = "B"; motivo = `Motivo: ${c.balde}`; }
  else if (c.corretorInativo) { base = "C"; motivo = "Corretor desligado/inativo"; }
  else { base = "A"; motivo = `Motivo: ${c.balde}`; }
  const emp = converterEmpreendimento(c.empreendimentoRaw, canonicos, aliases);
  if (!emp.nome) {
    return { ok: true, modelo: "lia_recupera_d", base: "D", nome, empreendimento: null, motivo: `${motivo} · sem empreendimento válido (seria ${base})` };
  }
  return { ok: true, modelo: `lia_recupera_${base.toLowerCase()}` as ModeloKey, base, nome, empreendimento: emp.nome, motivo };
}

// ---------- Lembrete D+3 ----------
export const OFERTA_NATAL: Record<string, string> = {
  "Open Bosque": "apartamentos de 1 e 2 dormitórios a partir de R$ 240 mil",
  "Essence Canoas": "lotes a partir de R$ 289 mil",
  "Open Arvoredo": "2 dormitórios com suíte a partir de R$ 329 mil",
  "Skyglass": "studio e 1 dormitório prontos a partir de R$ 369 mil",
  "Casa Tua Porto Alegre": "casas de 2 dormitórios a partir de R$ 520 mil",
  "Casa Tua Canoas": "sobrados de 3 dormitórios a partir de R$ 735 mil",
  "Boa Vista Country Club": "apartamentos prontos de 2 dormitórios a partir de R$ 849 mil",
  "Golden Lake": "apartamentos de 127 m² a partir de R$ 2,48 milhões",
};

/** Canônico do CRM → imóvel de Natal (tabela do Lucas, 05/11/2026). */
export const LEMBRETE_TABELA: Record<string, string> = {
  "Connect JW": "Skyglass", "Shift": "Skyglass", "Átrio": "Skyglass", "Casa Bastian": "Skyglass",
  "Skyline Menino Deus": "Skyglass", "The Arch": "Skyglass", "AWA": "Skyglass",
  "Orygem": "Casa Tua Canoas",
  "Terrace": "Open Arvoredo", "Alto Lindóia": "Open Arvoredo", "Vivid": "Open Arvoredo",
  "Flow": "Open Bosque", "Isla": "Open Bosque",
  "Vértice Las Casas": "Essence Canoas",
  "High Garden Iguatemi": "Boa Vista Country Club", "Grand Park Moinhos": "Boa Vista Country Club",
  "Seen Três Figueiras": "Golden Lake",
};
const NATAL_PROPRIO: Record<string, string> = {
  "open bosque": "Open Bosque", "essence canoas": "Essence Canoas", "open arvoredo": "Open Arvoredo", "skyglass": "Skyglass",
  "casa tua porto alegre": "Casa Tua Porto Alegre", "casa tua canoas": "Casa Tua Canoas",
  "boa vista country club": "Boa Vista Country Club", "boa vista": "Boa Vista Country Club",
  "golden lake": "Golden Lake", "lake eyre": "Golden Lake", "lake baikal": "Golden Lake", "lake victoria": "Golden Lake",
};
const TABELA_NORM = new Map(Object.entries(LEMBRETE_TABELA).map(([k, v]) => [norm(k), v]));

export type CaminhoLembrete = "proprio" | "tabela" | "open_bosque";
export function imovelLembrete(canonico: string | null): { imovel: string; oferta: string; caminho: CaminhoLembrete } {
  const k = norm(canonico || "");
  const proprio = NATAL_PROPRIO[k];
  if (proprio) return { imovel: proprio, oferta: OFERTA_NATAL[proprio], caminho: "proprio" };
  const t = TABELA_NORM.get(k);
  if (t) return { imovel: t, oferta: OFERTA_NATAL[t], caminho: "tabela" };
  return { imovel: "Open Bosque", oferta: OFERTA_NATAL["Open Bosque"], caminho: "open_bosque" };
}

// ---------- Montagem ----------
export function paramsModelo(modelo: ModeloKey, d: { nome: string; empreendimento?: string | null; imovel?: string; oferta?: string }): string[] {
  const p = MODELO_VARS[modelo] === 1 ? [d.nome]
    : modelo === "lia_recupera_lembrete" ? [d.nome, d.imovel ?? "", d.oferta ?? ""]
    : [d.nome, d.empreendimento ?? ""];
  const out = p.map(limparParam);
  if (out.some((v) => !v)) throw new Error(`informação vazia em ${modelo}`);
  return out;
}

export function textoFinal(modelo: ModeloKey, params: string[]): string {
  return params.reduce((t, v, i) => t.split(`{{${i + 1}}}`).join(v), MODELO_TEXTO[modelo]);
}
