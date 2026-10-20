import {
  AlertTriangle, ClockAlert, Flame, HandCoins, History, Home, Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { MotivoFila } from "@/hooks/useFilaDoDia";

export const MOTIVO_META: Record<MotivoFila, { label: string; icon: LucideIcon; chip: string }> = {
  negocio: { label: "Negócio", icon: HandCoins, chip: "bg-success/10 text-success-700 dark:text-success" },
  pos_visita: { label: "Pós-visita", icon: Home, chip: "bg-warning/10 text-warning-700 dark:text-warning" },
  novo_lead: { label: "Novo lead", icon: Sparkles, chip: "bg-primary/10 text-primary" },
  no_show: { label: "No-show", icon: AlertTriangle, chip: "bg-destructive/10 text-destructive" },
  retorno_hoje: { label: "Retorno", icon: ClockAlert, chip: "bg-warning/10 text-warning-700 dark:text-warning" },
  quente_esfriando: { label: "Esfriando", icon: Flame, chip: "bg-destructive/10 text-destructive" },
  sem_proximo_passo: { label: "Sem próximo passo", icon: History, chip: "bg-muted text-muted-foreground" },
};

export const MOTIVO_ORDEM: MotivoFila[] = [
  "negocio", "pos_visita", "novo_lead", "no_show", "retorno_hoje", "quente_esfriando", "sem_proximo_passo",
];

export const MOTIVO_PORQUE: Record<MotivoFila, string> = {
  negocio: "proposta ou negociação em aberto — é o que fecha o mês",
  pos_visita: "visitou e falta o retorno — esfria em horas",
  novo_lead: "chegou hoje e nunca foi contatado — regra dos 5 minutos",
  no_show: "marcou visita e o cliente não veio — resgatar",
  retorno_hoje: "você marcou uma tarefa que venceu — é promessa",
  quente_esfriando: "marcado quente e sem você falar há dias",
  sem_proximo_passo: "piorando, sem tarefa marcada — retome antes de perder",
};

export const TEMP_LABEL: Record<string, { t: string; c: string }> = {
  quente: { t: "Quente", c: "text-destructive" },
  morno: { t: "Morno", c: "text-warning-700 dark:text-warning" },
  frio: { t: "Frio", c: "text-primary" },
};

export const SAUDE_BORDER: Record<string, string> = {
  verde: "before:bg-success", ambar: "before:bg-warning",
  vermelho: "before:bg-destructive", estagnado: "before:bg-purple", terminal: "before:bg-muted-foreground/40",
};

export type FocoAgenda = "pendentes" | MotivoFila | "feitos";

export function diasLabel(d: number | null, temAtividade: boolean): string {
  if (!temAtividade) return "sem atividade ainda";
  if (d === null || d <= 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d}d`;
}