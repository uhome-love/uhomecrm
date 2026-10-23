export interface VendaConfirmacaoDados {
  empreendimentoCanonicoId?: string | null;
  construtora?: string | null;
  unidade?: string | null;
  vgvFinal?: number | null;
  dataAssinatura?: string | null;
  intermediacaoId?: string | null;
  comprovanteAtoPath?: string | null;
}

/** Vendas assinadas antes desta data valem só pelo VGV (decisão do Lucas): sem pendência de documentos. */
export const CORTE_DOCUMENTOS_VENDA = "2026-10-22";
export function exigeDocumentosVenda(dataAssinatura?: string | null): boolean {
  return !dataAssinatura || dataAssinatura >= CORTE_DOCUMENTOS_VENDA;
}

export function pendenciasVenda(dados: VendaConfirmacaoDados, hojeBRT: string): string[] {
  const pendencias: string[] = [];
  if (!dados.empreendimentoCanonicoId || !dados.construtora?.trim()) pendencias.push("Empreendimento e construtora");
  if (!dados.unidade?.trim()) pendencias.push("Unidade");
  if (!Number.isFinite(dados.vgvFinal) || Number(dados.vgvFinal) <= 0) pendencias.push("VGV final");
  const data = dados.dataAssinatura ?? "";
  const parsed = new Date(`${data}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== data || data > hojeBRT) pendencias.push("Data da assinatura");
  if (!dados.intermediacaoId) pendencias.push("Intermediação");
  if (!dados.comprovanteAtoPath) pendencias.push("Comprovante do ato");
  return pendencias;
}

export function comprovantePermitido(file: Pick<File, "type" | "size">): boolean {
  return ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size > 0 && file.size <= 20 * 1024 * 1024;
}