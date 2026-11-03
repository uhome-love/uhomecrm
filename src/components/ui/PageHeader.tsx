import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import HomiPageButton from "@/components/homi/HomiPageButton";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  tabs?: {
    label: string;
    value: string;
    badge?: string | number;
  }[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  size?: "default" | "sm";
  className?: string;
  /** Botão contextual do HOMI (padrão: visível) */
  homi?: boolean;
  /** Sugestões específicas desta tela para o HOMI */
  homiSugestoes?: string[];
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  tabs,
  activeTab,
  onTabChange,
  size = "default",
  className,
  homi = true,
  homiSugestoes,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 mb-6", className)}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/15 flex items-center justify-center flex-shrink-0 text-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1
              className={cn(
                "font-bold tracking-[-0.4px] text-foreground leading-tight",
                size === "sm" ? "text-[18px]" : "text-[24px]"
              )}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-[13px] text-muted-foreground mt-1 font-normal">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {(actions || homi) && (
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {actions}
            {homi && <HomiPageButton sugestoes={homiSugestoes} />}
          </div>
        )}
      </div>
      {tabs && tabs.length > 0 && (
        <div className="inline-flex self-start items-center gap-0.5 p-1 rounded-xl bg-muted/70 border border-border flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onTabChange?.(tab.value)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium transition-all",
                activeTab === tab.value
                  ? "bg-card text-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "text-[10px] font-semibold rounded-full px-1.5 py-px",
                    activeTab === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
