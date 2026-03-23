import { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 mb-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="w-9 h-9 rounded-[10px] bg-[#4F46E5]/10 flex items-center justify-center flex-shrink-0 text-[#4F46E5]">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1
              className={cn(
                "font-bold tracking-tight text-[#0a0a0a] dark:text-[#fafafa] leading-none truncate",
                size === "sm" ? "text-[18px]" : "text-[22px]"
              )}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-[13px] text-[#a1a1aa] mt-1.5 font-normal">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
      {tabs && tabs.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onTabChange?.(tab.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[13px] font-medium transition-all",
                activeTab === tab.value
                  ? "bg-[#4F46E5] text-white"
                  : "text-[#71717a] hover:text-[#0a0a0a] hover:bg-[#f5f5f5] dark:hover:text-[#fafafa] dark:hover:bg-white/[0.06]"
              )}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "text-[10px] font-semibold rounded-full px-1.5 py-px",
                    activeTab === tab.value
                      ? "bg-white/20 text-white"
                      : "bg-[#f0f0f0] text-[#a1a1aa] dark:bg-white/10 dark:text-[#71717a]"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="h-px bg-[#f0f0f0] dark:bg-white/[0.06]" />
    </div>
  );
}