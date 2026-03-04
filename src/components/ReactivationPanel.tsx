import { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, AlertTriangle, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/types/lead";

interface ReactivationPanelProps {
  leads: Lead[];
  onFilterByDays: (days: number) => void;
  activeFilter: number | null;
}

function getDaysSinceContact(ultimoContato: string): number | null {
  if (!ultimoContato) return null;
  const date = new Date(ultimoContato);
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

const BUCKETS = [
  { days: 7, label: "7 dias", color: "bg-accent/10 text-accent border-accent/20" },
  { days: 15, label: "15 dias", color: "bg-info/10 text-info border-info/20" },
  { days: 30, label: "30 dias", color: "bg-warning/10 text-warning border-warning/20" },
  { days: 60, label: "60 dias", color: "bg-primary/10 text-primary border-primary/20" },
  { days: 90, label: "90+ dias", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

export default function ReactivationPanel({ leads, onFilterByDays, activeFilter }: ReactivationPanelProps) {
  const bucketCounts = useMemo(() => {
    const counts: Record<number, number> = { 7: 0, 15: 0, 30: 0, 60: 0, 90: 0 };

    leads.forEach((lead) => {
      const days = getDaysSinceContact(lead.ultimoContato);
      if (days === null) {
        counts[90]++;
        return;
      }
      if (days >= 7 && days < 15) counts[7]++;
      else if (days >= 15 && days < 30) counts[15]++;
      else if (days >= 30 && days < 60) counts[30]++;
      else if (days >= 60 && days < 90) counts[60]++;
      else if (days >= 90) counts[90]++;
    });

    return counts;
  }, [leads]);

  const totalToReactivate = Object.values(bucketCounts).reduce((a, b) => a + b, 0);

  if (totalToReactivate === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5 shadow-card"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground text-sm">
            Leads para reativar hoje
          </h3>
          <p className="text-xs text-muted-foreground">
            {totalToReactivate} leads sem contato recente
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {BUCKETS.map((bucket, i) => {
          const count = bucketCounts[bucket.days];
          const isActive = activeFilter === bucket.days;

          return (
            <motion.button
              key={bucket.days}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onFilterByDays(isActive ? 0 : bucket.days)}
              className={`
                rounded-lg border p-3 text-center transition-all cursor-pointer
                ${isActive
                  ? "ring-2 ring-primary border-primary bg-primary/5"
                  : `${bucket.color} hover:shadow-sm`
                }
              `}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="h-3 w-3" />
                <span className="text-xs font-medium">{bucket.label}</span>
              </div>
              <p className="text-xl font-display font-bold">{count}</p>
              <p className="text-[10px] opacity-70">leads</p>
            </motion.button>
          );
        })}
      </div>

      {activeFilter && activeFilter > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>
            Mostrando leads sem contato há{" "}
            {activeFilter === 90 ? "90+ dias" : `${activeFilter}-${activeFilter === 7 ? 14 : activeFilter === 15 ? 29 : activeFilter === 30 ? 59 : 89} dias`}
          </span>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-muted"
            onClick={() => onFilterByDays(0)}
          >
            Limpar filtro
          </Badge>
        </div>
      )}
    </motion.div>
  );
}

export { getDaysSinceContact };
