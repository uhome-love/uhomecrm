import { differenceInHours, differenceInMinutes } from "date-fns";

export interface LeadScoreResult {
  score: number; // 0-100
  label: string;
  color: string;
  bgColor: string;
  factors: string[];
}

// SLA config per stage type (in minutes)
export const STAGE_SLA: Record<string, { warning: number; danger: number; label: string }> = {
  novo_lead: { warning: 15, danger: 30, label: "Novo lead deve ser contatado em até 15min" },
  sem_contato: { warning: 60, danger: 120, label: "Sem contato: retornar em até 1h" },
  atendimento: { warning: 240, danger: 480, label: "Atendimento: follow-up em até 4h" },
  qualificacao: { warning: 1440, danger: 2880, label: "Qualificação: avançar em até 24h" },
  visita: { warning: 2880, danger: 4320, label: "Visita: agendar/confirmar em até 48h" },
  proposta: { warning: 1440, danger: 4320, label: "Proposta: fechar em até 24h" },
  venda: { warning: 99999, danger: 99999, label: "" },
  descarte: { warning: 99999, danger: 99999, label: "" },
};

export function getSlaStatus(stageType: string, stageChangedAt: string): {
  status: "ok" | "warning" | "breach";
  minutesRemaining: number;
  slaLabel: string;
} {
  const sla = STAGE_SLA[stageType] || STAGE_SLA.atendimento;
  const mins = differenceInMinutes(new Date(), new Date(stageChangedAt));

  if (mins >= sla.danger) {
    return { status: "breach", minutesRemaining: sla.danger - mins, slaLabel: sla.label };
  }
  if (mins >= sla.warning) {
    return { status: "warning", minutesRemaining: sla.danger - mins, slaLabel: sla.label };
  }
  return { status: "ok", minutesRemaining: sla.warning - mins, slaLabel: sla.label };
}

export function calculateLeadScore(lead: {
  telefone?: string | null;
  email?: string | null;
  empreendimento?: string | null;
  valor_estimado?: number | null;
  origem?: string | null;
  temperatura?: string | null;
  created_at: string;
  stage_changed_at: string;
}): LeadScoreResult {
  let score = 50; // base
  const factors: string[] = [];

  // Contato completo
  if (lead.telefone) { score += 10; factors.push("+Tel"); }
  if (lead.email) { score += 5; factors.push("+Email"); }

  // Temperatura
  if (lead.temperatura === "quente") { score += 20; factors.push("+Quente"); }
  else if (lead.temperatura === "morno") { score += 10; factors.push("+Morno"); }
  else if (lead.temperatura === "frio") { score -= 5; factors.push("-Frio"); }

  // VGV informado
  if (lead.valor_estimado && lead.valor_estimado > 0) {
    score += 10;
    factors.push("+VGV");
    if (lead.valor_estimado >= 500000) { score += 5; }
  }

  // Empreendimento definido
  if (lead.empreendimento) { score += 5; factors.push("+Empreend."); }

  // Origem qualificada
  const origem = (lead.origem || "").toLowerCase();
  if (origem.includes("meta") || origem.includes("facebook") || origem.includes("instagram")) {
    score += 5; factors.push("+Meta Ads");
  } else if (origem.includes("site") || origem.includes("portal")) {
    score += 5; factors.push("+Site/Portal");
  } else if (origem.includes("indicação") || origem.includes("indicacao")) {
    score += 10; factors.push("+Indicação");
  }

  // Penalizar leads velhos sem movimento
  const hoursInStage = differenceInHours(new Date(), new Date(lead.stage_changed_at));
  if (hoursInStage > 48) { score -= 15; factors.push("-Parado 48h+"); }
  else if (hoursInStage > 24) { score -= 10; factors.push("-Parado 24h+"); }
  else if (hoursInStage > 4) { score -= 5; factors.push("-Parado 4h+"); }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Classify
  if (score >= 80) return { score, label: "A", color: "text-emerald-600", bgColor: "bg-emerald-500/15", factors };
  if (score >= 60) return { score, label: "B", color: "text-blue-600", bgColor: "bg-blue-500/15", factors };
  if (score >= 40) return { score, label: "C", color: "text-amber-600", bgColor: "bg-amber-500/15", factors };
  return { score, label: "D", color: "text-red-600", bgColor: "bg-red-500/15", factors };
}
