// Regras da linha do tempo "Atendimento" da ficha do lead.
// Funções puras: não leem nem gravam nada no banco.

import {
  ArrowRightLeft, Briefcase, CalendarDays, Circle, TrendingDown, Trophy, XCircle, Mail, MapPin, MessageCircle, Phone, Repeat, StickyNote, Target, Undo2,
  type LucideIcon,
} from "lucide-react";

export type DirecaoEtapa = "avancou" | "voltou" | "mesma";

interface EtapaComOrdem {
  id: string;
  ordem?: number | null;
}

/** Compara a ordem das etapas. Sem ordem, usa a posição na lista (as etapas já vêm ordenadas). */
export function direcaoEtapa(stages: EtapaComOrdem[], deId?: string | null, paraId?: string | null): DirecaoEtapa {
  if (!deId || !paraId || deId === paraId) return "mesma";
  const ordem = (id: string) => {
    const i = stages.findIndex((s) => s.id === id);
    return i === -1 ? null : stages[i].ordem ?? i;
  };
  const de = ordem(deId);
  const para = ordem(paraId);
  if (de == null || para == null) return "avancou";
  return para < de ? "voltou" : "avancou";
}

/** Título do item de mudança de etapa. */
export function tituloMudancaEtapa(direcao: DirecaoEtapa, etapaNova?: string | null): string {
  if (!etapaNova) return "Etapa atualizada";
  return direcao === "voltou" ? `Voltou para ${etapaNova}` : `Avançou para ${etapaNova}`;
}

/**
 * A caixa "Resultado da visita" só aparece para visita que aconteceu (ou não).
 * "Visita agendada" e mudança de data não são resultado.
 */
export function ehResultadoDeVisita(titulo?: string | null): boolean {
  const t = (titulo ?? "").toLowerCase();
  if (/agendad|marcad|data alterada|status alterado|reagend/.test(t)) return false;
  return /realizad|resultado|no.?show|n[ãa]o compareceu|compareceu/.test(t);
}

/** Dias inteiros entre duas datas ISO (a mais nova primeiro). */
export function diasEntre(maisNova: string, maisAntiga: string): number {
  const a = new Date(maisNova).getTime();
  const b = new Date(maisAntiga).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor(Math.abs(a - b) / 86_400_000);
}

/**
 * Buracos sem registro entre itens consecutivos da lista (ordem: mais recente primeiro).
 * Devolve um mapa: índice do item mais novo → dias até o item seguinte (mais antigo).
 * Ex.: { 0 => 9 } desenha "9 dias sem registro" logo abaixo do primeiro item.
 */
export function buracosSemRegistro<T extends { date: string }>(itensMaisRecentesPrimeiro: T[], minDias = 7): Map<number, number> {
  const buracos = new Map<number, number>();
  for (let i = 0; i < itensMaisRecentesPrimeiro.length - 1; i++) {
    const dias = diasEntre(itensMaisRecentesPrimeiro[i].date, itensMaisRecentesPrimeiro[i + 1].date);
    if (dias >= minDias) buracos.set(i, dias);
  }
  return buracos;
}

export type TomMarco = "azul" | "verde" | "laranja" | "vermelho" | "cinza";
export interface EstiloMarco { icone: LucideIcon; emoji?: string; tom: TomMarco; marco: boolean; ganho?: boolean }

/** Ícone, cor e peso de cada item. Só os marcos da história ganham cor; emoji só em 🎯 📅 📍 🏆 ❌. */
export function iconeDoMarco(
  item: { title?: string | null; sourceType?: string | null },
  direcao?: DirecaoEtapa,
  tipoEtapaNova?: string | null,
): EstiloMarco {
  const t = (item.title ?? "").toLowerCase();
  if (item.sourceType === "historico" && direcao) {
    if (tipoEtapaNova === "venda") return { icone: Trophy, emoji: "🏆", tom: "verde", marco: true, ganho: true };
    if (tipoEtapaNova === "descarte") return { icone: XCircle, emoji: "❌", tom: "vermelho", marco: true };
    if (tipoEtapaNova === "caiu") return { icone: TrendingDown, tom: "vermelho", marco: true };
    if (direcao === "voltou") return { icone: Undo2, tom: "laranja", marco: true };
    if (direcao === "avancou") return { icone: ArrowRightLeft, tom: "azul", marco: true };
  }
  const rotina = (icone: LucideIcon): EstiloMarco => ({ icone, tom: "cinza", marco: false });
  if (item.sourceType === "anotacao" || /\bnota\b|anota/.test(t)) return rotina(StickyNote);
  if (item.sourceType === "historico") return rotina(Repeat);
  if (/lead entrou|^entrou|entrada/.test(t)) return { icone: Target, emoji: "🎯", tom: "azul", marco: true };
  if (/no.?show|n[ãa]o compareceu/.test(t)) return { icone: MapPin, tom: "laranja", marco: true };
  if (/^visita (agendada|marcada)/.test(t.replace(/^[^\p{L}]+/u, ""))) return { icone: CalendarDays, emoji: "📅", tom: "azul", marco: true };
  if (/visita/.test(t) && /realizad|resultado/.test(t)) return { icone: MapPin, emoji: "📍", tom: "verde", marco: true };
  if (/ligaç|liga[rç]|telefon|atendeu/.test(t)) return rotina(Phone);
  if (/whats|mensagem/.test(t)) return rotina(MessageCircle);
  if (/e-mail|email/.test(t)) return rotina(Mail);
  if (/visita|tour|comparec/.test(t)) return rotina(MapPin);
  if (/proposta|neg[óo]cio|contrato|venda|ganho|documenta/.test(t)) return rotina(Briefcase);
  if (/follow|cad[êe]ncia/.test(t)) return rotina(Repeat);
  return rotina(Circle);
}

/** Classes do círculo por tom (tokens do tema). */
export const CLASSE_TOM: Record<TomMarco, string> = {
  azul: "bg-primary/10 text-primary",
  verde: "bg-success-500/15 text-success-700 dark:text-success-500",
  laranja: "bg-warning-500/15 text-warning-700 dark:text-warning-500",
  vermelho: "bg-danger-500/10 text-danger-700 dark:text-danger-500",
  cinza: "bg-muted text-muted-foreground",
};

/** 1100000 → "R$ 1,1 mi"; 735000 → "R$ 735 mil". */
export function valorCurto(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "";
  if (v >= 1_000_000) return `R$ ${(Math.round(v / 100_000) / 10).toLocaleString("pt-BR")} mi`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000).toLocaleString("pt-BR")} mil`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

const ACENTOS: Record<string, string> = { confeccao: "confecção", negociacao: "negociação", aprovacao: "aprovação", analise: "análise", assinatura: "assinatura", documentacao: "documentação", nao: "não", sim: "sim", bancario: "bancário" };
const maiuscula = (x: string) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);

/** "em_confeccao" → "Em confecção"; "EM vistoria" → "Em vistoria"; "gerado" → "Gerado". */
export function codigoLegivel(c: string): string {
  const palavras = c.trim().replace(/_/g, " ").replace(/\s+/g, " ").toLowerCase().split(" ").map((w) => ACENTOS[w] ?? w);
  return maiuscula(palavras.join(" "));
}

/** "casa_3_dorms_-_130m2" → "Casa 3 dorms · 130 m²". */
export function respostaFormLegivel(r: string): string {
  const partes = r.split(/_-_|\s-\s/).map((p) => codigoLegivel(p).replace(/(\d+)\s?m2\b/gi, "$1 m²"));
  return maiuscula(partes.map((p) => p.charAt(0).toLowerCase() + p.slice(1)).join(" · "));
}

/** Texto de exibição: valores em R$, códigos legíveis e sem "Avulso · Unidade: avulso" repetido. */
export function descricaoLegivel(d: string): string {
  let s = d.replace(/r\$_/gi, "R$ ").replace(/(\d)_a_/g, "$1 a ").replace(/Valor:\s*(\d{4,})(?:[.,]\d+)?/g, (_, n) => `Valor: ${valorCurto(Number(n))}`);
  s = s.replace(/([^·•\n]+?)\s*·\s*Unidade:\s*([^·•\n]+)/g, (m, prod, uni) => (prod.trim().toLowerCase() === uni.trim().toLowerCase() ? `${prod.replace(/\s+$/, "")} ` : m));
  s = s.replace(/(Situação|Status):\s*([a-zà-ú_]+)/gi, (_, k, v) => `${k}: ${codigoLegivel(v)}`);
  s = s.replace(/\b([A-Za-zÀ-ú0-9]+(?:_-?_?[A-Za-zÀ-ú0-9]+)+)\b/g, (m) => respostaFormLegivel(m));
  s = s.replace(/\b([A-Z]{2,})\s+([a-zà-ú]+)/g, (m, a, b) => (a.length <= 3 ? `${maiuscula(a.toLowerCase())} ${b}` : m));
  return s;
}
