import { Users, Sparkles, TrendingUp, MessageSquare, Flame, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import type { Lead } from "@/types/lead";

interface StatsCardsProps {
  leads: Lead[];
}

export default function StatsCards({ leads }: StatsCardsProps) {
  const total = leads.length;
  const withMessage = leads.filter((l) => l.mensagemGerada).length;
  const muitoQuente = leads.filter((l) => l.prioridade === "muito_quente").length;
  const quente = leads.filter((l) => l.prioridade === "quente").length;
  const classified = leads.filter((l) => l.prioridade).length;
  const reactivated = leads.filter((l) => l.status === "reativado" || l.status === "respondido").length;

  const stats = [
    { label: "Total de Leads", value: total, icon: Users, accent: "bg-primary/10 text-primary", glowColor: "group-hover:shadow-[0_0_20px_hsl(231_100%_65%/0.12)]" },
    { label: "🔥 Muito Quentes", value: muitoQuente, icon: Flame, accent: "bg-destructive/10 text-destructive", glowColor: "group-hover:shadow-[0_0_20px_hsl(0_72%_51%/0.12)]" },
    { label: "🟠 Quentes", value: quente, icon: TrendingUp, accent: "bg-warning/10 text-warning", glowColor: "group-hover:shadow-[0_0_20px_hsl(40_96%_50%/0.12)]" },
    { label: "Classificados", value: classified, icon: Sparkles, accent: "bg-accent text-accent-foreground", glowColor: "group-hover:shadow-[0_0_20px_hsl(231_100%_65%/0.08)]" },
    { label: "Reativados", value: reactivated, icon: RotateCcw, accent: "bg-success/10 text-success", glowColor: "group-hover:shadow-[0_0_20px_hsl(160_60%_42%/0.12)]" },
    { label: "Mensagens Geradas", value: withMessage, icon: MessageSquare, accent: "bg-warning/10 text-warning", glowColor: "group-hover:shadow-[0_0_20px_hsl(40_96%_50%/0.12)]" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={`group card-interactive p-4 cursor-default ${s.glowColor}`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.accent} transition-transform duration-300 group-hover:scale-110`}>
              <s.icon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="text-2xl font-display font-extrabold text-foreground tracking-tight">{s.value}</p>
              <p className="text-[11px] text-muted-foreground font-medium">{s.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
