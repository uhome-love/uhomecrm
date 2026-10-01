/**
 * Marco do reengajamento: momento do registro mais recente
 * "📩 Mensagem do disparo ... — cliente respondeu SIM" (gravado pelo whatsapp-webhook).
 * Para o corretor, a História do lead começa aqui (itens anteriores ficam ocultos, não apagados).
 */
export function corteReengajamento(
  atividades: Array<{ titulo?: string | null; created_at?: string | null }> | null | undefined,
): string | null {
  let corte: string | null = null;
  for (const a of atividades || []) {
    if (!a.created_at || !a.titulo) continue;
    if (!a.titulo.includes("Mensagem do disparo") || !a.titulo.includes("respondeu SIM")) continue;
    if (!corte || a.created_at > corte) corte = a.created_at;
  }
  if (!corte) return null;
  // margem de 2 min: o registro de reativação/movimentação nasce no mesmo instante
  return new Date(new Date(corte).getTime() - 2 * 60 * 1000).toISOString();
}
