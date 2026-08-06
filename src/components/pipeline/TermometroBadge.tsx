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
      className={`shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold leading-none ${
        TONE_BY_KEY[level.key] ?? "bg-muted text-muted-foreground"
      } ${className}`}
    >
      {level.emoji} {level.label}
    </span>
  );
}
