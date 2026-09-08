import { Badge } from "@/components/ui/badge";
import { PRIORITY_CONFIG } from "@/lib/leadUtils";
import type { LeadPriority } from "@/types/lead";

export default function PriorityBadge({ priority }: { priority?: LeadPriority }) {
  if (!priority) return <Badge variant="outline" className="text-xs">Pendente</Badge>;
  const c = PRIORITY_CONFIG[priority];
  return (
    <Badge variant="outline" className={`${c.className} text-xs`}>
      {c.emoji} {c.label}
    </Badge>
  );
}
