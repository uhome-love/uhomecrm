import { type ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-[16px] bg-primary/10 flex items-center justify-center mb-4 text-primary">
        {icon}
      </div>
      <h3 className="text-[15px] font-bold text-foreground tracking-[-0.3px] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-[13px] text-muted-foreground max-w-[280px] leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground text-[13px] font-medium px-4 py-2 rounded-[9px] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
