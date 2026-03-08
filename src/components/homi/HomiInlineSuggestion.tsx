import { Button } from "@/components/ui/button";
import { useHomi } from "@/contexts/HomiContext";

const homiMascot = "/images/homi-mascot-official.png";

interface Props {
  suggestion: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Inline contextual HOMI suggestion — use inside any page/component.
 * Shows a small card with a suggestion from HOMI.
 */
export default function HomiInlineSuggestion({ suggestion, actionLabel = "OK", onAction }: Props) {
  const { openHomi } = useHomi();

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 mt-0.5">
        <img src={homiMascot} alt="Homi" className="h-5 w-5 object-contain" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground/80 leading-relaxed">
          <span className="font-semibold text-primary">HOMI sugere:</span>{" "}
          {suggestion}
        </p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2 text-primary"
          onClick={() => openHomi(suggestion)}
        >
          Falar mais
        </Button>
      </div>
    </div>
  );
}
