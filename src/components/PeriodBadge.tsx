import { useDateFilter } from "@/contexts/DateFilterContext";
import { Badge } from "@/components/ui/badge";

/**
 * Small badge showing the current active period label.
 * Use next to section titles: "Gestão de Leads (Hoje)"
 */
export default function PeriodBadge({ className }: { className?: string }) {
  const { label } = useDateFilter();
  return (
    <Badge variant="secondary" className={className}>
      {label}
    </Badge>
  );
}
