import { useRef, useEffect } from "react";
import { useTabContext } from "@/contexts/TabContext";
import { icons, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function TabIcon({ name }: { name: string }) {
  const Icon = (icons as Record<string, LucideIcon>)[name];
  if (!Icon) return null;
  return <Icon size={14} strokeWidth={1.75} />;
}

export default function TabBar({ unknownRoute = false }: { unknownRoute?: boolean }) {
  const { tabs, activeTabId, activateTab, closeTab, closeOtherTabs } = useTabContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeEl = scrollRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    activeEl?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  if (tabs.length <= 1 && !unknownRoute) return null;

  return (
    <div className="shell-tabs flex items-center h-11 min-h-11 px-3 gap-2 select-none">
      <div
        ref={scrollRef}
        className="flex items-center gap-1 overflow-x-auto flex-1"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const label = isActive && unknownRoute ? "Página não encontrada" : tab.label;
          const canClose = index > 0;
          return (
            <Button
              key={tab.id}
              variant="ghost"
              data-active={isActive}
              onClick={() => activateTab(tab.id)}
              title={isActive && unknownRoute ? `Página não encontrada · voltar para ${tab.label}` : tab.label}
              className={cn(
                "group relative flex items-center gap-2 pl-3 pr-2 h-8 rounded-lg text-[12.5px] tracking-[-0.1px] transition-all duration-150",
                "max-w-[190px] min-w-[96px] shrink-0 border border-transparent",
                isActive
                  ? "shell-tab-active font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--shell-nav-hover))]"
              )}
            >
              <span className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground/70")}>
                <TabIcon name={isActive && unknownRoute ? "Compass" : tab.icon} />
              </span>
              <span className="truncate flex-1 text-left">{label}</span>
              {canClose ? (
                <span
                  role="button"
                  aria-label={`Fechar ${tab.label}`}
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className={cn(
                    "shrink-0 w-[18px] h-[18px] flex items-center justify-center rounded-md transition-all",
                    isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-100",
                    "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <X size={11} strokeWidth={2.25} />
                </span>
              ) : <span className="w-[18px]" />}
            </Button>
          );
        })}
      </div>
      {tabs.length > 2 && (
        <button
          onClick={closeOtherTabs}
          className="shrink-0 h-7 px-2.5 rounded-md text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--shell-nav-hover))] transition-colors"
        >
          Fechar as outras
        </button>
      )}
    </div>
  );
}
