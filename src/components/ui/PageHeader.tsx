import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[11px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex flex-col">
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-foreground">{title}</h1>
          {subtitle && <p className="text-[13px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap justify-end">{actions}</div>
      )}
    </div>
  );
}

export default PageHeader;
