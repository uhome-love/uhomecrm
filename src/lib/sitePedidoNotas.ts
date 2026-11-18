export interface NotaPedidoSite { id: string; titulo: string; descricao: string | null }

/** Notas geradas pelo servidor para cadastros que ainda não possuem cartão. */
export function lerNotasPedidoSite(dados: unknown): NotaPedidoSite[] {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return [];
  const mapa = (dados as Record<string, unknown>)._pedidos_notas;
  if (!mapa || typeof mapa !== "object" || Array.isArray(mapa)) return [];
  return Object.entries(mapa).flatMap(([id, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const nota = value as Record<string, unknown>;
    if (typeof nota.titulo !== "string" || !nota.titulo.trim()) return [];
    return [{ id, titulo: nota.titulo, descricao: typeof nota.descricao === "string" ? nota.descricao : null }];
  });
}