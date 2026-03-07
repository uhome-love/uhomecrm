import { type PdnEntry } from "@/hooks/usePdn";
import { differenceInDays } from "date-fns";

// ─── Probabilidade de Fechamento (%) ───
export function calcProbabilidade(entry: PdnEntry): number {
  if (entry.situacao === "assinado") return 100;
  if (entry.situacao === "caiu") return 0;

  let score = 0;

  // Visitou empreendimento → +20
  if (entry.situacao === "visita" || entry.situacao === "gerado") score += 20;

  // Cliente escolheu unidade → +20
  if (entry.und && entry.und.trim()) score += 20;

  // Documentação enviada → +20
  if (entry.docs_status === "em_andamento") score += 10;
  if (entry.docs_status === "doc_completa") score += 20;

  // Proposta/Gerado → +10
  if (entry.situacao === "gerado") score += 10;

  // Temperatura bonus
  if (entry.temperatura === "quente") score += 15;
  else if (entry.temperatura === "morno") score += 5;

  // Próxima ação definida → +5
  if (entry.proxima_acao && entry.proxima_acao.trim()) score += 5;

  // VGV definido → +5
  if (entry.vgv && entry.vgv > 0) score += 5;

  // Quando assina definido → +10 (indica confiança)
  if (entry.quando_assina && entry.quando_assina.trim()) score += 10;

  // Penalidade: sem contato recente
  if (entry.updated_at) {
    const days = differenceInDays(new Date(), new Date(entry.updated_at));
    if (days > 7) score -= 15;
    else if (days > 5) score -= 10;
    else if (days > 3) score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

// ─── Indicador de Risco ───
export type RiscoNivel = "seguro" | "atencao" | "risco";

export function calcRisco(entry: PdnEntry): { nivel: RiscoNivel; motivos: string[] } {
  if (entry.situacao === "assinado") return { nivel: "seguro", motivos: [] };
  if (entry.situacao === "caiu") return { nivel: "risco", motivos: ["Negócio perdido"] };

  const motivos: string[] = [];
  const now = new Date();
  const updatedDays = differenceInDays(now, new Date(entry.updated_at));

  // Risco: 7+ dias parado
  if (updatedDays >= 7) motivos.push(`${updatedDays} dias sem atualização`);

  // Sem próxima ação
  if (!entry.proxima_acao || !entry.proxima_acao.trim()) motivos.push("Sem próxima ação");

  // Sem docs
  if (entry.docs_status === "sem_docs" && entry.situacao === "gerado") motivos.push("Falta documentação");

  // Temperatura fria em gerado
  if (entry.temperatura === "frio") motivos.push("Temperatura fria");

  if (motivos.length >= 2 || updatedDays >= 7) return { nivel: "risco", motivos };
  if (motivos.length >= 1 || updatedDays >= 3) return { nivel: "atencao", motivos };
  return { nivel: "seguro", motivos };
}

// ─── VGV Provável ───
export function calcVgvProvavel(entries: PdnEntry[]): number {
  return entries
    .filter(e => e.situacao !== "caiu")
    .reduce((sum, e) => {
      const prob = calcProbabilidade(e) / 100;
      return sum + (e.vgv || 0) * prob;
    }, 0);
}

// ─── Alertas Inteligentes ───
export interface PdnAlerts {
  semProximaAcao: number;
  negociosParados: number;
  semDocs: number;
  proximosDeFecahr: number;
  emRisco: number;
}

export function calcAlerts(entries: PdnEntry[]): PdnAlerts {
  const ativos = entries.filter(e => e.situacao !== "caiu" && e.situacao !== "assinado");

  return {
    semProximaAcao: ativos.filter(e => !e.proxima_acao || !e.proxima_acao.trim()).length,
    negociosParados: ativos.filter(e => differenceInDays(new Date(), new Date(e.updated_at)) >= 3).length,
    semDocs: ativos.filter(e => e.docs_status === "sem_docs").length,
    proximosDeFecahr: ativos.filter(e => calcProbabilidade(e) >= 70).length,
    emRisco: ativos.filter(e => calcRisco(e).nivel === "risco").length,
  };
}

// ─── Objeções Options ───
export const OBJECAO_OPTIONS = [
  { value: "preco", label: "Preço" },
  { value: "localizacao", label: "Localização" },
  { value: "entrada", label: "Entrada" },
  { value: "financiamento", label: "Financiamento" },
  { value: "prazo_obra", label: "Prazo de obra" },
  { value: "comparacao", label: "Comparação com outro produto" },
  { value: "outro", label: "Outro" },
] as const;

export const PROXIMA_ACAO_OPTIONS = [
  "Pedir documentos",
  "Agendar visita",
  "Enviar proposta",
  "Confirmar assinatura",
  "Aprovação de crédito",
  "Negociação",
  "Retorno de contato",
  "Enviar simulação",
] as const;
