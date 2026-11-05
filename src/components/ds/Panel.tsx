import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PanelProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** Cartão com título para gráfico, tabela ou lista. */
export function Panel({ title, subtitle, icon: Icon, actions, footer, className, children }: PanelProps) {
  return (
    <section className={cn("flex flex-col rounded-xl border border-border bg-card shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && (
              <h3 className="flex items-center gap-2 font-sans text-[15px] font-semibold text-foreground">
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
                {title}
              </h3>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="flex-1 p-5">{children}</div>
      {footer && <footer className="border-t border-border px-5 py-3 text-xs text-muted-foreground">{footer}</footer>}
    </section>
  );
}

export interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  note?: string;
  children?: React.ReactNode;
}

/** Título de seção numa tela longa. */
export function SectionHeader({ title, icon: Icon, note, children }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
          {Icon && <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />}
          {title}
        </h2>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </div>
  );
}
