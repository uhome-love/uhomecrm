import { Users, Sparkles, TrendingUp, MessageSquare, Snowflake, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import type { Lead } from "@/types/lead";

interface StatsCardsProps {
  leads: Lead[];
}

export default function StatsCards({ leads }: StatsCardsProps) {
  const total = leads.length;
  const withMessage = leads.filter((l) => l.mensagemGerada).length;
  const highPriority = leads.filter((l) => l.prioridade === "alta").length;
  const classified = leads.filter((l) => l.prioridade).length;
  const cold = leads.filter((l) => l.prioridade === "frio").length;
  const lost = leads.filter((l) => l.prioridade === "perdido").length;

  const stats = [
    {
      label: "Total de Leads",
      value: total,
      icon: Users,
      accent: "bg-primary/10 text-primary",
    },
    {
      label: "Alta Prioridade",
      value: highPriority,
      icon: TrendingUp,
      accent: "bg-destructive/10 text-destructive",
    },
    {
      label: "Classificados",
      value: classified,
      icon: Sparkles,
      accent: "bg-accent/10 text-accent",
    },
    {
      label: "Frios",
      value: cold,
      icon: Snowflake,
      accent: "bg-info/10 text-info",
    },
    {
      label: "Perdidos",
      value: lost,
      icon: XCircle,
      accent: "bg-muted text-muted-foreground",
    },
    {
      label: "Mensagens Geradas",
      value: withMessage,
      icon: MessageSquare,
      accent: "bg-warning/10 text-warning",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-xl border border-border bg-card p-4 shadow-card"
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.accent}`}>
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-display font-bold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
