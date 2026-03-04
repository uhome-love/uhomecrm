import type { Lead, LeadPriority, ScoreClassification } from "@/types/lead";

export function getDaysSinceContact(dateStr: string): number | null {
  if (!dateStr) return null;
  // Handle dd/mm/yyyy format
  let date: Date;
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      date = new Date(dateStr);
    }
  } else {
    date = new Date(dateStr);
  }
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function getTimeSinceContactLabel(days: number | null): string {
  if (days === null) return "Sem data";
  if (days <= 3) return "3 dias";
  if (days <= 7) return "7 dias";
  if (days <= 15) return "15 dias";
  if (days <= 30) return "30 dias";
  if (days <= 60) return "60 dias";
  if (days <= 90) return "90 dias";
  return "90+ dias";
}

export function getTimeSinceContactColor(days: number | null): string {
  if (days === null) return "text-muted-foreground bg-muted";
  if (days <= 3) return "text-success bg-success/10";
  if (days <= 7) return "text-accent bg-accent/10";
  if (days <= 15) return "text-info bg-info/10";
  if (days <= 30) return "text-warning bg-warning/10";
  if (days <= 60) return "text-primary bg-primary/10";
  return "text-destructive bg-destructive/10";
}

export const PRIORITY_CONFIG: Record<LeadPriority, { label: string; emoji: string; className: string }> = {
  muito_quente: { label: "Muito Quente", emoji: "🔥", className: "bg-destructive/15 text-destructive border-destructive/30 font-semibold" },
  quente: { label: "Quente", emoji: "🟠", className: "bg-primary/15 text-primary border-primary/30" },
  morno: { label: "Morno", emoji: "🟡", className: "bg-warning/15 text-warning border-warning/30" },
  frio: { label: "Frio", emoji: "🔵", className: "bg-info/15 text-info border-info/30" },
  perdido: { label: "Perdido", emoji: "⚫", className: "bg-muted text-muted-foreground border-border" },
};

export type QuickFilter = "todos" | "muito_quentes" | "followup_hoje" | "7dias" | "15dias" | "30dias" | "90dias" | "top50" | "esquecidos" | "com_interesse" | "com_telefone";

export const QUICK_FILTERS: { key: QuickFilter; label: string; emoji?: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "top50", label: "Top 50", emoji: "🏆" },
  { key: "muito_quentes", label: "Muito Quentes", emoji: "🔥" },
  { key: "followup_hoje", label: "Follow-up Hoje", emoji: "📞" },
  { key: "com_interesse", label: "Com Interesse", emoji: "🏠" },
  { key: "com_telefone", label: "Com Telefone", emoji: "📱" },
  { key: "esquecidos", label: "Esquecidos", emoji: "💤" },
  { key: "7dias", label: "7 dias", emoji: "⏰" },
  { key: "15dias", label: "15 dias" },
  { key: "30dias", label: "30 dias" },
  { key: "90dias", label: "90+ dias" },
];

// Recovery Score calculation (deterministic, 0-100)
export function calculateRecoveryScore(lead: Lead): number {
  let score = 0;
  
  // +20 telefone válido
  if (lead.telefone && lead.telefone.replace(/\D/g, "").length >= 8) score += 20;
  
  // +10 email válido
  if (lead.email && lead.email.includes("@")) score += 10;
  
  // +20 interesse em empreendimento definido / -10 sem interesse
  if (lead.interesse && lead.interesse.trim().length > 2) score += 20;
  else score -= 10;
  
  // Time-based
  const days = getDaysSinceContact(lead.ultimoContato);
  if (days !== null) {
    if (days <= 30) score += 15;
    else if (days > 90) score -= 15;
  } else {
    score -= 15;
  }
  
  // Origem
  const origem = (lead.origem || "").toLowerCase();
  if (origem.includes("meta") || origem.includes("facebook") || origem.includes("instagram")) score += 10;
  else if (origem.includes("formul") || origem.includes("site") || origem.includes("portal")) score += 10;
  
  return Math.max(0, Math.min(100, score));
}

export function getScoreClassification(score: number): ScoreClassification {
  if (score >= 80) return "alta";
  if (score >= 60) return "boa";
  if (score >= 40) return "media";
  return "baixa";
}

export const SCORE_CONFIG: Record<ScoreClassification, { label: string; emoji: string; className: string }> = {
  alta: { label: "Oportunidade Alta", emoji: "🟢", className: "bg-success/15 text-success border-success/30 font-semibold" },
  boa: { label: "Oportunidade Boa", emoji: "🔵", className: "bg-accent/15 text-accent border-accent/30" },
  media: { label: "Oportunidade Média", emoji: "🟡", className: "bg-warning/15 text-warning border-warning/30" },
  baixa: { label: "Oportunidade Baixa", emoji: "⚪", className: "bg-muted text-muted-foreground border-border" },
};
