/**
 * FilterPill — Dropdown filter chip adapted from Site Uhome for CRM dark theme.
 * Renders as a pill button that opens a dropdown with options.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FilterPillProps {
  label: string;
  value?: string;
  active?: boolean;
  children: React.ReactNode;
  onClear?: () => void;
}

export function FilterPill({ label, value, active, children, onClear }: FilterPillProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        ref.current && !ref.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const adjustPosition = useCallback(() => {
    if (!dropdownRef.current || !ref.current) return;
    const dropdown = dropdownRef.current;
    const pill = ref.current.getBoundingClientRect();
    dropdown.style.position = "fixed";
    dropdown.style.bottom = "auto";
    dropdown.style.left = `${pill.left}px`;
    dropdown.style.right = "auto";
    dropdown.style.top = `${pill.bottom + 8}px`;
    dropdown.style.width = "";

    const rect = dropdown.getBoundingClientRect();
    const vw = window.innerWidth;
    if (rect.right > vw - 8) {
      dropdown.style.left = `${pill.left - (rect.right - vw + 8)}px`;
    }
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(adjustPosition);
  }, [open, adjustPosition]);

  const dropdownContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed z-50 min-w-[200px] rounded-xl border border-border bg-card p-2 shadow-xl"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all active:scale-[0.97] ${
          active
            ? "border-primary bg-primary/15 text-primary"
            : "border-border bg-card text-foreground hover:border-primary/40"
        }`}
      >
        <span className="whitespace-nowrap">{value || label}</span>
        {active && onClear ? (
          <X
            className="h-3.5 w-3.5 opacity-70 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
          />
        ) : (
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {createPortal(dropdownContent, document.body)}
    </div>
  );
}

export function PillOption({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
        selected
          ? "bg-primary/10 font-medium text-primary"
          : "text-foreground hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}
