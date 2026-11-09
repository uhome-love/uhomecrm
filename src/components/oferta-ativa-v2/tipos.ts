/** Tipos e utilitários puros da Oferta Ativa (módulo único de ligações). */

export type OrigemOA = "listas" | "estagnados" | "descartados";
export type ResultadoOA = "nao_atendeu" | "sem_interesse" | "numero_errado" | "aproveitar" | "visita";

export interface ClienteOA {
  id: string;
  nome: string;
  telefone: string | null;
  empreendimento: string | null;
  origemLead: string | null;
  entrouEm: string | null;
  observacoes: string | null;
  tentativas: number;
  /** id da lista de origem (somente Listas). */
  listaId: string | null;
}

export interface ExtrasResultado {
  nota?: string;
  dataVisita?: string; // yyyy-MM-dd
  horaVisita?: string; // HH:mm
}

export const ORIGEM_INFO: Record<OrigemOA, { titulo: string; desc: string; emoji: string; contexto: string }> = {
  listas: { titulo: "Listas de leads", desc: "Campanhas liberadas para você", emoji: "📋", contexto: "Lead de campanha. Apresente-se e confirme o interesse." },
  estagnados: { titulo: "Estagnados", desc: "Clientes que pararam de andar", emoji: "⏳", contexto: "Cliente sem sequência. Se você aproveitar, ele é seu." },
  descartados: { titulo: "Descartados", desc: "Segunda chance, últimos 6 meses", emoji: "🔄", contexto: "Descartado há um tempo. Pode ter mudado de ideia: se aproveitar, ele é seu." },
};

/** Rótulo do resultado gravado como observação quando o corretor não escreve nada. */
export const ROTULO_RESULTADO: Record<ResultadoOA, string> = {
  nao_atendeu: "Não atendeu",
  sem_interesse: "Sem interesse",
  numero_errado: "Número errado",
  aproveitar: "Aproveitado",
  visita: "Visita marcada",
};

/** Resultados disponíveis por origem: o Bolsão não registra "número errado". */
export function resultadosDaOrigem(origem: OrigemOA): ResultadoOA[] {
  return origem === "listas"
    ? ["nao_atendeu", "sem_interesse", "numero_errado", "aproveitar", "visita"]
    : ["nao_atendeu", "sem_interesse", "aproveitar", "visita"];
}

export function soDigitos(t: string | null | undefined) {
  return (t ?? "").replace(/\D/g, "");
}

/** Telefone com DDI 55 para tel:/wa.me. Vazio se não houver número utilizável. */
export function foneInternacional(t: string | null | undefined) {
  const d = soDigitos(t);
  if (d.length < 10) return "";
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

export function formatarFone(t: string | null | undefined) {
  const d = soDigitos(t);
  const l = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  if (l.length === 11) return `(${l.slice(0, 2)}) ${l.slice(2, 7)}-${l.slice(7)}`;
  if (l.length === 10) return `(${l.slice(0, 2)}) ${l.slice(2, 6)}-${l.slice(6)}`;
  return t ?? "Sem telefone";
}

/** "hoje", "há 3 dias", "há 4 meses". */
export function haQuanto(iso: string | null, agora = Date.now()) {
  if (!iso) return null;
  const dias = Math.floor((agora - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 60) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses < 24 ? `há ${meses} meses` : `há ${Math.floor(meses / 12)} anos`;
}

export function primeiroNome(nome: string | null | undefined) {
  const n = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "";
}

/** Meta de ligações nunca abaixo do mínimo da direção. */
export const META_MIN_LIGACOES = 30;
export function metaValida(v: number) {
  return Number.isFinite(v) ? Math.min(500, Math.max(META_MIN_LIGACOES, Math.round(v))) : META_MIN_LIGACOES;
}

/** "1min42s" / "38s" — duração da ligação para a observação da tentativa. */
export function formatarDuracao(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}min${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}
