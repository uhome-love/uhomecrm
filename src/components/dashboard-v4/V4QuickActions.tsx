/**
 * Quick actions do Dashboard Gerente v4.
 * O botão "Performance" só aparece quando VITE_PERFORMANCE_ENABLED === 'true'.
 * Ative criando a página /performance e setando a env flag no build.
 */
import { useNavigate } from "react-router-dom";
import { Briefcase, Users, Megaphone, BarChart3, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionDef {
  label: string;
  to: string;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "purple";
}

const toneMap = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  purple: "bg-purple-50 text-purple-700",
} as const;

const baseActions: ActionDef[] = [
  { label: "Pipeline Negócios", to: "/negocios", icon: Briefcase, tone: "success" },
  { label: "Pipeline Leads", to: "/pipeline", icon: Users, tone: "primary" },
  { label: "Oferta Ativa", to: "/oferta-ativa", icon: Megaphone, tone: "warning" },
];

const performanceAction: ActionDef = {
  label: "Performance",
  to: "/performance",
  icon: BarChart3,
  tone: "purple",
};

export function V4QuickActions() {
  const navigate = useNavigate();
  const performanceEnabled = import.meta.env.VITE_PERFORMANCE_ENABLED === "true";
  const actions = performanceEnabled ? [...baseActions, performanceAction] : baseActions;

  return (
    <div
      className={cn(
        "grid gap-3 grid-cols-1 sm:grid-cols-3",
        performanceEnabled && "sm:grid-cols-2 lg:grid-cols-4",
      )}
    >
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.to}
            onClick={() => navigate(a.to)}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/30"
          >
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneMap[a.tone])}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              {a.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
