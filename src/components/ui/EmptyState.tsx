import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, description, action, secondaryAction, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-6 text-center", className)}>
      <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </div>
      <h3 className="text-[16px] font-semibold text-foreground tracking-[-0.2px] mb-1.5">{title}</h3>
      {description && (
        <p className="text-[13px] text-muted-foreground max-w-[340px] leading-relaxed">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex items-center gap-2">
          {action && (
            <button
              onClick={action.onClick}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-[13px] font-semibold h-9 px-4 rounded-[10px] shadow-sm transition-colors"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-[13px] font-medium h-9 px-4 rounded-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
