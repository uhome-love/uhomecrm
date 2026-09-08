import { Button } from "@/components/ui/button";
import { Flame, Filter } from "lucide-react";
import { QUICK_FILTERS, type QuickFilter } from "@/lib/leadUtils";

interface QuickFiltersProps {
  active: QuickFilter;
  onChange: (filter: QuickFilter) => void;
  counts: Record<QuickFilter, number>;
}

export default function QuickFilters({ active, onChange, counts }: QuickFiltersProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter className="h-4 w-4 text-muted-foreground" />
      {QUICK_FILTERS.map((f) => (
        <Button
          key={f.key}
          size="sm"
          variant={active === f.key ? "default" : "outline"}
          onClick={() => onChange(f.key)}
          className="gap-1 text-xs h-8"
        >
          {f.emoji && <span>{f.emoji}</span>}
          {f.label}
          <span className="ml-1 text-[10px] opacity-70">({counts[f.key] || 0})</span>
        </Button>
      ))}
    </div>
  );
}
