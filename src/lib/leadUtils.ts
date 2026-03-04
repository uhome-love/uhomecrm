import type { LeadPriority } from "@/types/lead";

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

export type QuickFilter = "todos" | "muito_quentes" | "followup_hoje" | "7dias" | "15dias" | "30dias" | "90dias";

export const QUICK_FILTERS: { key: QuickFilter; label: string; emoji?: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "muito_quentes", label: "Muito Quentes", emoji: "🔥" },
  { key: "followup_hoje", label: "Follow-up Hoje", emoji: "📞" },
  { key: "7dias", label: "7 dias", emoji: "⏰" },
  { key: "15dias", label: "15 dias" },
  { key: "30dias", label: "30 dias" },
  { key: "90dias", label: "90+ dias" },
];
