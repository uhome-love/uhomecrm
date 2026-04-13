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
      <div className="w-14 h-14 rounded-[16px] bg-[#4969FF]/10 dark:bg-[#4969FF]/20 flex items-center justify-center mb-4 text-[#4969FF] dark:text-[#6B84FF]">
        {icon}
      </div>
      <h3 className="text-[15px] font-bold text-[#0a0a0a] dark:text-[#fafafa] tracking-[-0.3px] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-[13px] text-[#a1a1aa] dark:text-[#52525b] max-w-[280px] leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 bg-[#4969FF] hover:bg-[#3350E6] text-white text-[13px] font-medium px-4 py-2 rounded-[9px] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
