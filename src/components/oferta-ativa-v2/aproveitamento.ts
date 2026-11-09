/** Mensagens únicas para o resultado de `oa_aproveitar` (Listas, Estagnados e Descartados). */
export type StatusAproveitar =
  | "aproveitado" | "com_outro" | "comigo" | "bloqueado" | "em_ligacao_com_outro" | "em_ligacao"
  | "mexido" | "fora_prazo" | "sem_ligacao" | "nao_elegivel" | "nao_encontrado" | "duplicado" | "sem_login" | "invalido";

export interface RespostaAproveitar { ok: boolean; status: StatusAproveitar | string; corretor_nome?: string; pipeline_lead_id?: string; idempotent?: boolean }

/** Janela em que o corretor pode aproveitar pelo Histórico (o servidor confere a mesma regra). */
export const HISTORICO_HORAS = 24;

export function mensagemAproveitar(r: Pick<RespostaAproveitar, "status" | "corretor_nome">): string {
  switch (r.status) {
    case "com_outro": return `Este cliente já está com ${r.corretor_nome || "outro corretor"} no Pipeline.`;
    case "comigo": return "Este cliente já está no seu Pipeline.";
    case "bloqueado": return "Este cliente pediu para não receber contato (ou já comprou).";
    case "em_ligacao_com_outro": return "Outro corretor está falando com esse cliente agora.";
    case "em_ligacao": return "Você está com esse cliente aberto na tela de ligação.";
    case "mexido": return "Outro corretor já ligou para esse cliente depois de você.";
    case "fora_prazo": return `Passou de ${HISTORICO_HORAS}h da sua ligação. Agora só o gerente pode passar esse cliente.`;
    case "nao_elegivel": return "Esse cliente não está mais disponível.";
    case "duplicado": return "Já existe outro cadastro desse telefone. Peça ao gerente para conferir.";
    default: return "Não foi possível aproveitar este cliente.";
  }
}

/** Se a ligação ainda está dentro da janela do Histórico. */
export function dentroDoPrazo(quandoISO: string, agora = Date.now()): boolean {
  return agora - new Date(quandoISO).getTime() <= HISTORICO_HORAS * 3600_000;
}
