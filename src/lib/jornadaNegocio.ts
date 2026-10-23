export interface DocumentosNegocio { identidade: boolean; renda: boolean; residencia: boolean }
export const DOCUMENTOS_NEGOCIO = [
  { key: "identidade", label: "RG / CPF" },
  { key: "renda", label: "Comprovante de renda" },
  { key: "residencia", label: "Comprovante de residência" },
] as const;

export function lerDocumentos(value: unknown): DocumentosNegocio {
  const object = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { identidade: object.identidade === true, renda: object.renda === true, residencia: object.residencia === true };
}

export function valorSugerido(negocio: { vgv_final?: number | null; proposta_valor?: number | null; vgv_estimado?: number | null } | null, fallback = 0): number {
  return negocio?.vgv_final ?? negocio?.proposta_valor ?? negocio?.vgv_estimado ?? fallback;
}

export function jornadaPodeSalvar(tipo: string, empreendimentoId: string, unidade: string, valor: number): boolean {
  if (!empreendimentoId || !["proposta", "documentacao", "contrato_gerado"].includes(tipo)) return false;
  return tipo === "documentacao" || (unidade.trim().length > 0 && Number.isFinite(valor) && valor > 0 && valor <= 999999999);
}

export function situacaoAtualNegocio(passo: string, negociacao: string, contrato: string): string {
  return passo === "contrato" ? contrato : passo === "ganho" ? "" : negociacao;
}

export function situacaoAutoritativa(contrato: boolean, negocio: { contrato_situacao?: string | null; proposta_situacao?: string | null } | null, flag: unknown): string {
  const atual = contrato ? negocio?.contrato_situacao : negocio?.proposta_situacao;
  return atual ?? (typeof flag === "string" ? flag : "");
}