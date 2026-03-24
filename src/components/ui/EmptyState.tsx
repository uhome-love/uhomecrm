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
      <div className="w-14 h-14 rounded-[16px] bg-[#4F46E5]/10 dark:bg-[#4F46E5]/20 flex items-center justify-center mb-4 text-[#4F46E5] dark:text-[#818cf8]">
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
          className="mt-4 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13px] font-medium px-4 py-2 rounded-[9px] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
