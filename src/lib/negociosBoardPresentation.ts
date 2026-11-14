import type { NegocioCard, ProntoVirar } from "@/hooks/useNegociosBoard";
import type { LeadSaude } from "@/lib/leadSaude";

export type NegociosAtalho = "todos" | "parados" | "sem_vgv";
export interface NegociosResumoVisual { vgv: number; quantidade: number; parados: number; semVgv: number }
export interface NegociosRecorte { lens: "meus" | "equipe"; search: string; corretor: string; gestorIds?: string[] | null; saude?: LeadSaude | null }
function match(row: { meu: boolean; corretorUserId: string | null; corretor: string; empreendimento: string; saude: LeadSaude }, nome: string, recorte: NegociosRecorte): boolean {
  if (recorte.lens === "meus" && !row.meu) return false;
  if (recorte.gestorIds && (!row.corretorUserId || !recorte.gestorIds.includes(row.corretorUserId))) return false;
  if (recorte.corretor && recorte.corretor !== "all" && recorte.corretor !== "todos") {
    if (recorte.corretor === "sem_corretor" ? !!row.corretorUserId : row.corretorUserId !== recorte.corretor) return false;
  }
  if (recorte.saude && row.saude !== recorte.saude) return false;
  const q = recorte.search.trim().toLocaleLowerCase("pt-BR");
  return !q || [nome, row.empreendimento, row.corretor].some(v => v.toLocaleLowerCase("pt-BR").includes(q));
}
export function recortarNegocios(rows: NegocioCard[], recorte: NegociosRecorte): NegocioCard[] {
  return rows.filter(row => match(row, row.cliente, recorte));
}
export function recortarPosVisita(rows: ProntoVirar[], recorte: NegociosRecorte): ProntoVirar[] {
  return rows.filter(row => match(row, row.nome, recorte));
}
export function negocioParado(row: NegocioCard): boolean {
  return row.passo !== "ganho" && row.dias > 7 && row.saude !== "verde" && row.saude !== "terminal";
}
export function resumoNegocios(rows: NegocioCard[]): NegociosResumoVisual {
  const unicos = new Map(rows.filter(row => row.passo !== "ganho").map(row => [row.id, row]));
  const resumo: NegociosResumoVisual = { vgv: 0, quantidade: unicos.size, parados: 0, semVgv: 0 };
  for (const row of unicos.values()) {
    if (row.vgv == null) resumo.semVgv++;
    else resumo.vgv += row.vgv;
    if (negocioParado(row)) resumo.parados++;
  }
  return resumo;
}
export function filtrarNegociosAtalho(rows: NegocioCard[], atalho: NegociosAtalho): NegocioCard[] {
  if (atalho === "todos") return rows;
  return rows.filter(row => row.passo !== "ganho" && (atalho === "parados" ? negocioParado(row) : row.vgv == null));
}