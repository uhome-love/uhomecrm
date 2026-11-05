import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Tone, toneDot, toneText } from "./tones";

export interface Delta {
  value: string;
  direction: "up" | "down";
  /** Lado bom. Sem ele a pílula fica neutra. */
  good?: "up" | "down";
  /** Contra o que compara — obrigatório mostrar. */
  label?: string;
}

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  delta?: Delta;
  tone?: Tone;
  accent?: boolean;
  active?: boolean;
  size?: "md" | "sm";
  onClick?: () => void;
}

export function DeltaPill({ delta }: { delta: Delta }) {
  const Icon = delta.direction === "up" ? ArrowUpRight : ArrowDownRight;
  const estado = !delta.good ? "neutral" : delta.good === delta.direction ? "success" : "danger";
  const cls =
    estado === "success"
      ? "bg-success-50 text-success-700 dark:bg-success/15 dark:text-success-500"
      : estado === "danger"
        ? "bg-danger-50 text-danger-700 dark:bg-danger/15 dark:text-danger-500"
        : "bg-muted text-muted-foreground";
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums", cls)}>
        <Icon className="h-3 w-3" />
        {delta.value}
      </span>
      {delta.label && <span className="text-muted-foreground">{delta.label}</span>}
    </span>
  );
}

/** Número de destaque (DS v4): sem borda lateral colorida; tom só quando é status. */
export function StatCard({ label, value, sub, delta, tone, accent, active, size = "md", onClick }: StatCardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-card text-left shadow-sm transition-shadow",
        size === "sm" ? "p-4" : "p-5",
        onClick && "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active ? "border-primary ring-1 ring-primary/30" : "border-border",
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {tone && <span className={cn("h-1.5 w-1.5 rounded-full", toneDot[tone])} />}
        {label}
      </span>
      <span
        className={cn(
          "font-display font-bold tabular-nums tracking-tight",
          size === "sm" ? "text-xl" : "text-[26px] leading-7",
          accent ? "text-primary" : tone ? toneText[tone] : "text-foreground",
        )}
      >
        {value}
      </span>
      {(sub || delta) && (
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {delta && <DeltaPill delta={delta} />}
          {sub && <span>{sub}</span>}
        </span>
      )}
    </Comp>
  );
}
