/**
 * Shared labels for lead opportunity score temperature system.
 */

export interface ScoreTemperatureLevel {
  key: string;
  label: string;
  emoji: string;
  range: string;
  min: number;
  max: number;
  description: string;
  color: string; // tailwind text class
}

export const SCORE_TEMPERATURE_LEVELS: ScoreTemperatureLevel[] = [
  { key: "frio", label: "Frio", emoji: "🧊", range: "0–25", min: 0, max: 25, description: "Lead inativo, sem engajamento recente", color: "text-blue-500" },
  { key: "morno", label: "Morno", emoji: "🌤", range: "26–50", min: 26, max: 50, description: "Lead com algum histórico, mas sem avanço", color: "text-amber-500" },
  { key: "quente", label: "Quente", emoji: "🔥", range: "51–75", min: 51, max: 75, description: "Lead engajado, priorize o contato", color: "text-orange-500" },
  { key: "em_chamas", label: "Em chamas", emoji: "🔥🔥", range: "76–100", min: 76, max: 100, description: "Alta probabilidade de conversão, aja agora", color: "text-red-500" },
];

export function getScoreTemperature(score: number): ScoreTemperatureLevel {
  if (score >= 76) return SCORE_TEMPERATURE_LEVELS[3];
  if (score >= 51) return SCORE_TEMPERATURE_LEVELS[2];
  if (score >= 26) return SCORE_TEMPERATURE_LEVELS[1];
  return SCORE_TEMPERATURE_LEVELS[0];
}

export function getScoreTooltip(score: number): string {
  const level = getScoreTemperature(score);
  return `${level.emoji} ${level.label} (${level.range}) — ${level.description}`;
}
