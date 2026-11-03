import { EMPREENDIMENTOS, PDFS, SECOES_ARQUIVOS } from "./conteudo";

export type Secao = "cards" | "disparos" | "instagram" | "molduras" | "fotos" | "pdfs";
export interface ArquivoLido { chave: string; secao: Secao; ordem: number; titulo: string; caminho: string }

const PADRAO = /^(CARD|DISP|INSTA|MOLD|FOTO|PDF)-(\d+)-(.+)\.(jpe?g|png|webp|pdf)$/i;

/** Lê o nome do arquivo e diz onde ele entra. null = fora do padrão. */
export function lerNomeArquivo(nome: string): ArquivoLido | null {
  const m = nome.match(PADRAO);
  if (!m) return null;
  const prefixo = m[1].toUpperCase() as keyof typeof SECOES_ARQUIVOS;
  const secao = SECOES_ARQUIVOS[prefixo].secao as Secao;
  const chave = nome.replace(/\.[^.]+$/, "");
  const chaveNorm = `${prefixo}-${m[2]}-${m[3]}`;
  const emp = EMPREENDIMENTOS.find((e) => Object.values(e.arquivos).some((a) => a.toLowerCase() === chaveNorm.toLowerCase()));
  const pdf = PDFS.find((p) => p.arquivo.toLowerCase() === chaveNorm.toLowerCase());
  const titulo = emp?.nome ?? pdf?.titulo ?? m[3].replace(/_/g, " ");
  return { chave, secao, ordem: Number(m[2]), titulo, caminho: `${secao}/${nome}` };
}

/** Separa o texto em partes normais e [colchetes] para destacar. */
export function partesColchetes(texto: string): { t: string; marca: boolean }[] {
  return texto.split(/(\[[^\]]+\])/g).filter(Boolean).map((t) => ({ t, marca: /^\[.*\]$/.test(t) }));
}

export const podeGerenciar = (roles: string[]) => roles.includes("admin") || roles.includes("diretor");
