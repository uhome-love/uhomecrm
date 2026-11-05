/** Tons do DS v4. Cor só quando significa algo; status sempre com palavra junto. */
export type Tone = "neutral" | "primary" | "info" | "success" | "warning" | "danger";

export const toneText: Record<Tone, string> = {
  neutral: "text-foreground",
  primary: "text-primary",
  info: "text-primary",
  success: "text-success-700 dark:text-success-500",
  warning: "text-warning-700 dark:text-warning-500",
  danger: "text-danger-700 dark:text-danger-500",
};

export const toneDot: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export const toneSoft: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-50 text-primary dark:bg-primary/20 dark:text-primary-100",
  info: "bg-primary-50 text-primary dark:bg-primary/20 dark:text-primary-100",
  success: "bg-success-50 text-success-700 dark:bg-success/15 dark:text-success-500",
  warning: "bg-warning-50 text-warning-700 dark:bg-warning/15 dark:text-warning-500",
  danger: "bg-danger-50 text-danger-700 dark:bg-danger/15 dark:text-danger-500",
};

/** Paleta variada para listas e funis (decisão do Lucas: cores ajudam a enxergar). */
export const paleta = [
  "bg-primary-500",
  "bg-pink-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-cyan-500",
  "bg-indigo-400",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-400",
  "bg-teal-500",
];

export const fmtNum = (n: number) => n.toLocaleString("pt-BR");
export const fmtPct = (n: number, casas = 1) =>
  `${n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
