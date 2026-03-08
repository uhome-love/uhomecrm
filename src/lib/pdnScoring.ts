import { type PdnEntry } from "@/hooks/usePdn";
import { differenceInDays } from "date-fns";

// ─── Factor-based Smart Probability ───

export interface ProbFactor {
  label: string;
  value: number;
  icon: "check" | "warning" | "info";
}

export interface SmartProbResult {
  total: number;
  factors: ProbFactor[];
  trend: "up" | "down" | "stable";
}

const STAGE_BASE: Record<string, number> = {
  visita: 25,
  gerado: 45,
  assinado: 100,
  caiu: 0,
};

const STAGE_CAP: Record<string, number> = {
  visita: 50,
  gerado: 85,
  assinado: 100,
  caiu: 0,
};

export function calcSmartProbabilidade(entry: PdnEntry, corretorTaxaFechamento?: number): SmartProbResult {
  if (entry.situacao === "assinado") return { total: 100, factors: [{ label: "Assinado", value: 100, icon: "check" }], trend: "stable" };
  if (entry.situacao === "caiu") return { total: 0, factors: [{ label: "Negócio perdido", value: 0, icon: "warning" }], trend: "down" };

  const factors: ProbFactor[] = [];
  let raw = 0;

  // 1. Stage base
  const stageBase = STAGE_BASE[entry.situacao] ?? 25;
  const stageLabel = entry.situacao === "gerado" ? "Proposta enviada" : "Visita realizada";
  factors.push({ label: stageLabel, value: stageBase, icon: "check" });
  raw += stageBase;

  // 2. Temperature
  const tempMap: Record<string, { v: number; l: string }> = {
    quente: { v: 15, l: "Cliente quente" },
    morno: { v: 5, l: "Cliente morno" },
    frio: { v: -5, l: "Cliente frio" },
  };
  const tempData = tempMap[entry.temperatura] || { v: 0, l: `Temperatura: ${entry.temperatura}` };
  if (tempData.v !== 0) {
    factors.push({ label: tempData.l, value: tempData.v, icon: tempData.v > 0 ? "check" : "warning" });
    raw += tempData.v;
  }

  // 3. Time since last contact (use updated_at as proxy)
  if (entry.updated_at) {
    const days = differenceInDays(new Date(), new Date(entry.updated_at));
    if (days < 1) {
      factors.push({ label: "Contato < 24h", value: 10, icon: "check" });
      raw += 10;
    } else if (days <= 3) {
      // 0 modifier, no factor shown
    } else if (days <= 7) {
      factors.push({ label: `Sem contato há ${days} dias`, value: -10, icon: "warning" });
      raw -= 10;
    } else {
      factors.push({ label: `Sem contato há ${days} dias`, value: -20, icon: "warning" });
      raw -= 20;
    }
  }

  // 4. Unit selected (proxy for commitment)
  if (entry.und && entry.und.trim()) {
    factors.push({ label: "Unidade escolhida", value: 10, icon: "check" });
    raw += 10;
  }

  // 5. Documentation status
  if (entry.docs_status === "doc_completa") {
    factors.push({ label: "Documentação completa", value: 10, icon: "check" });
    raw += 10;
  } else if (entry.docs_status === "em_andamento") {
    factors.push({ label: "Docs em andamento", value: 5, icon: "info" });
    raw += 5;
  } else if (entry.situacao === "gerado") {
    factors.push({ label: "Sem documentação", value: -5, icon: "warning" });
    raw -= 5;
  }

  // 6. Próxima ação defined
  if (entry.proxima_acao && entry.proxima_acao.trim()) {
    factors.push({ label: "Próxima ação definida", value: 5, icon: "check" });
    raw += 5;
  }

  // 7. VGV defined (indicates serious negotiation)
  if (entry.vgv && entry.vgv > 0) {
    factors.push({ label: "VGV definido", value: 5, icon: "check" });
    raw += 5;
  }

  // 8. Quando assina (signing date projected)
  if (entry.quando_assina && entry.quando_assina.trim()) {
    factors.push({ label: "Data de assinatura projetada", value: 5, icon: "check" });
    raw += 5;
  }

  // 9. Corretor closing rate (if available)
  if (corretorTaxaFechamento !== undefined) {
    if (corretorTaxaFechamento > 15) {
      factors.push({ label: "Corretor com alta taxa de fechamento", value: 5, icon: "check" });
      raw += 5;
    } else if (corretorTaxaFechamento < 5) {
      factors.push({ label: "Corretor com baixa taxa de fechamento", value: -5, icon: "warning" });
      raw -= 5;
    }
  }

  // Apply cap by stage
  const cap = STAGE_CAP[entry.situacao] ?? 50;
  const total = Math.max(0, Math.min(cap, raw));

  // Trend: compare with a simple heuristic based on recency
  const days = entry.updated_at ? differenceInDays(new Date(), new Date(entry.updated_at)) : 0;
  const trend: "up" | "down" | "stable" = days > 5 ? "down" : days < 2 ? "up" : "stable";

  return { total, factors, trend };
}

// Legacy wrapper for backward compatibility
export function calcProbabilidade(entry: PdnEntry): number {
  return calcSmartProbabilidade(entry).total;
}

// ─── Indicador de Risco ───
export type RiscoNivel = "seguro" | "atencao" | "risco";

export function calcRisco(entry: PdnEntry): { nivel: RiscoNivel; motivos: string[] } {
  if (entry.situacao === "assinado") return { nivel: "seguro", motivos: [] };
  if (entry.situacao === "caiu") return { nivel: "risco", motivos: ["Negócio perdido"] };

  const motivos: string[] = [];
  const now = new Date();
  const updatedDays = differenceInDays(now, new Date(entry.updated_at));

  if (updatedDays >= 7) motivos.push(`${updatedDays} dias sem atualização`);
  if (!entry.proxima_acao || !entry.proxima_acao.trim()) motivos.push("Sem próxima ação");
  if (entry.docs_status === "sem_docs" && entry.situacao === "gerado") motivos.push("Falta documentação");
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
