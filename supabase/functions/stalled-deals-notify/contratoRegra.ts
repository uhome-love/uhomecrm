export interface ContratoAcompanhado {
  status: string; desde: string; etapa_id: string;
}
export function contratoAtrasado(contrato: ContratoAcompanhado | null, etapaId: string, now: number): boolean {
  if (!contrato || contrato.etapa_id !== etapaId || !["gerado", "em_leitura"].includes(contrato.status)) return false;
  const desde = Date.parse(contrato.desde);
  return Number.isFinite(desde) && now - desde > 7 * 24 * 60 * 60 * 1000;
}
export function contratoChave(leadId: string, gerenteId: string, contrato: ContratoAcompanhado): string {
  return `contrato_7d:${leadId}:${gerenteId}:${contrato.status}:${contrato.desde}`;
}