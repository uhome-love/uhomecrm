import { PRODUTOS_NATAL } from "@/lia/catalogoNatal";

export type FichaLia = {
  id: string; slug: string; nome: string; nome_publico: string | null; ficha: string;
  ativo: boolean; updated_at: string; midias: unknown;
};

export const SLUGS_NATAL = PRODUTOS_NATAL.map((p) => p.slug);
export function nomeFicha(p: FichaLia) { return p.nome_publico || p.nome; }
export function materiaisFicha(p: FichaLia): [string, string][] {
  if (!p.midias || typeof p.midias !== "object" || Array.isArray(p.midias)) return [];
  return Object.entries(p.midias).filter((e): e is [string, string] => typeof e[1] === "string" && /^https:\/\//.test(e[1]));
}
export function grupoFicha(p: FichaLia): "natal" | "outros" | "anteriores" {
  if (p.slug.includes("__backup")) return "anteriores";
  return SLUGS_NATAL.includes(p.slug) ? "natal" : "outros";
}