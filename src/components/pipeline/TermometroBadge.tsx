// ─────────────────────────────────────────────────────────────────
// TermometroBadge — pílula compacta de temperatura do lead.
// Lê `oportunidade_score` (preferencial) ou `temperatura` (fallback textual)
// e traduz via @/lib/scoreTemperatureLabels. Sem dado → não renderiza.
// Puro visual: nenhuma escrita, nenhuma query.
// ─────────────────────────────────────────────────────────────────
import {
  getScoreTemperature,
  getScoreTooltip,
  SCORE_TEMPERATURE_LEVELS,
  type ScoreTemperatureLevel,
} from "@/lib/scoreTemperatureLabels";

const TONE_BY_KEY: Record<string, string> = {
  frio: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  morno: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  quente: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  em_chamas: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

/** Rótulo curto exibido na pílula (o nível completo fica no title). */
const SHORT_LABEL: Record<string, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
  em_chamas: "Em chamas",
};

interface Props {
  temperatura?: string | null;
  score?: number | null;
  className?: string;
}

export default function TermometroBadge({ temperatura, score, className = "" }: Props) {
  let level: ScoreTemperatureLevel | null = null;
  let tooltip = "";

  if (typeof score === "number" && score > 0) {
    level = getScoreTemperature(score);
    tooltip = getScoreTooltip(score);
  } else if (temperatura) {
    const key = String(temperatura).trim().toLowerCase();
    level = SCORE_TEMPERATURE_LEVELS.find((l) => l.key === key) ?? null;
    if (level) tooltip = `${level.emoji} ${level.label} — ${level.description}`;
  }

  if (!level) return null;

  return (
    <span
      title={tooltip}
      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${
        TONE_BY_KEY[level.key] ?? "bg-muted text-muted-foreground"
      } ${className}`}
    >
      <span aria-hidden>{level.emoji}</span>
      {SHORT_LABEL[level.key] ?? level.label}
    </span>
  );
}
