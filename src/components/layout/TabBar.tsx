import { useRef, useEffect } from "react";
import { useTabContext } from "@/contexts/TabContext";
import { icons, X } from "lucide-react";
import { cn } from "@/lib/utils";

function TabIcon({ name }: { name: string }) {
  const Icon = (icons as any)[name];
  if (!Icon) return null;
  return <Icon size={13} strokeWidth={1.5} />;
}

export default function TabBar() {
  const { tabs, activeTabId, activateTab, closeTab } = useTabContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active tab into view
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeEl = container.querySelector('[data-active="true"]') as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [activeTabId]);

  if (tabs.length <= 1) return null; // Don't show bar with only one tab

  return (
    <div
      className={cn(
        "flex items-end h-[36px] min-h-[36px] overflow-hidden select-none",
        "bg-muted/50 border-b border-border",
        "dark:bg-card dark:border-white/[0.05]"
      )}
    >
      <div
        ref={scrollRef}
        className="flex items-end gap-0 overflow-x-auto flex-1 px-1"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <button
              key={tab.id}
              data-active={isActive}
              onClick={() => activateTab(tab.id)}
              className={cn(
                "group relative flex items-center gap-1.5 px-3 h-[32px] rounded-t-lg text-[12px] tracking-[-0.1px] transition-all",
                "max-w-[160px] min-w-[80px] shrink-0",
                isActive
                  ? "bg-background text-foreground font-medium shadow-sm dark:shadow-none"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[hsl(var(--primary))]" />
              )}

              <span
                className={cn(
                  "shrink-0",
                  isActive ? "text-[hsl(var(--primary))]" : "text-muted-foreground/60"
                )}
              >
                <TabIcon name={tab.icon} />
              </span>
              <span className="truncate flex-1 text-left">{tab.label}</span>

              {tab.closable && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    "shrink-0 w-[16px] h-[16px] flex items-center justify-center rounded-sm transition-colors",
                    "opacity-0 group-hover:opacity-100",
                    "hover:bg-accent text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  <X size={10} strokeWidth={2} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
