import React, { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FilterChipProps {
  label: string;
  active: boolean;
  children: React.ReactNode;
  onClear?: () => void;
}

export default function FilterChip({ label, active, children, onClear }: FilterChipProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "inline-flex items-center gap-1 h-[36px] px-3 text-[12px] font-medium border transition-all whitespace-nowrap rounded-[9px]",
          active
            ? "bg-[#4969FF]/10 border-[#4969FF]/30 text-[#4969FF] hover:bg-[#4969FF]/15"
            : "text-[#52525b] bg-[#f7f7fb] dark:bg-white/5 border-[#e8e8f0] dark:border-white/10 hover:border-[#4969FF] hover:text-[#4969FF]"
        )}>
          {label}
          <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
          {active && onClear && (
            <span onClick={(e) => { e.stopPropagation(); onClear(); }} className="ml-0.5 hover:bg-[#4969FF]/20 rounded-full p-0.5 -mr-1">
              <X className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[200px] p-3" align="start" sideOffset={8}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
