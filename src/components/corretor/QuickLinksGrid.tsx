import { CalendarCheck, Briefcase, BarChart3, Bot, FileText, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const links = [
  { label: "Agenda", icon: CalendarCheck, path: "/agenda-visitas", color: "text-amber-600", bg: "bg-amber-500/10" },
  { label: "Negócios", icon: Briefcase, path: "/pipeline-negocios", color: "text-purple-600", bg: "bg-purple-500/10" },
  { label: "Resumo", icon: BarChart3, path: "/corretor/resumo", color: "text-blue-600", bg: "bg-blue-500/10" },
  { label: "HOMI", icon: Bot, path: "/homi", color: "text-primary", bg: "bg-primary/10" },
  { label: "Scripts", icon: FileText, path: "/scripts", color: "text-emerald-600", bg: "bg-emerald-500/10" },
  { label: "Config", icon: Settings, path: "/configuracoes", color: "text-muted-foreground", bg: "bg-muted" },
];

export default function QuickLinksGrid() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {links.map((link, i) => (
        <motion.button
          key={link.path}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          onClick={() => navigate(link.path)}
          className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${link.bg} group-hover:scale-110 transition-transform`}>
            <link.icon className={`h-4.5 w-4.5 ${link.color}`} />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
            {link.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
