import { Users, Sparkles, TrendingUp, MessageSquare } from "lucide-react";
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
      label: "Mensagens Geradas",
      value: withMessage,
      icon: MessageSquare,
      accent: "bg-info/10 text-info",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="rounded-xl border border-border bg-card p-5 shadow-card"
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.accent}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
