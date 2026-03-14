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
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
          active
            ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
            : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
        )}>
          {label}
          <ChevronDown className="h-3 w-3" />
          {active && onClear && (
            <span onClick={(e) => { e.stopPropagation(); onClear(); }} className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5 -mr-1">
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
