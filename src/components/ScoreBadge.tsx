import { getScoreClassification, SCORE_CONFIG } from "@/lib/leadUtils";

interface ScoreBadgeProps {
  score?: number;
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  if (score === undefined || score === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const classification = getScoreClassification(score);
  const config = SCORE_CONFIG[classification];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${config.className}`}>
      <span>{config.emoji}</span>
      <span className="font-bold">{score}</span>
    </span>
  );
}
