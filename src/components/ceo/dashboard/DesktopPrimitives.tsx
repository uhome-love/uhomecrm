import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { fmtMoney } from "@/lib/fmtMoney";
export const formatBRLCompact = (v: number) => fmtMoney(v, "short");
export const ORIGIN_COLORS: Record<string, string> = {
  meta_ads: "var(--ceo-chart-primary)", "Meta Ads": "var(--ceo-chart-primary)",
  "TikTok Ads": "var(--ceo-chart-pink)",
  "Landing Page": "var(--ceo-chart-green)",
  imovelweb: "var(--ceo-chart-orange)", ImovelWeb: "var(--ceo-chart-orange)",
  site_uhome: "var(--ceo-chart-cyan)", "Site - uhome.com.br": "var(--ceo-chart-cyan)",
  jetimob: "var(--ceo-chart-indigo)", indicacao: "var(--ceo-chart-purple)",
  whatsapp: "var(--ceo-chart-won)", rd_station: "var(--ceo-chart-yellow)",
  "Oferta Ativa": "var(--ceo-chart-primary)",
};
export const FALLBACK_COLORS = ["var(--ceo-chart-primary)","var(--ceo-chart-pink)","var(--ceo-chart-green)","var(--ceo-chart-orange)","var(--ceo-chart-cyan)","var(--ceo-chart-indigo)","var(--ceo-chart-purple)","var(--ceo-chart-yellow)","var(--ceo-chart-red)","var(--ceo-chart-teal)"];

// ─── Section Label ───
export function SectionLabel({ children, icon: Icon }: { children: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-primary">{children}</span>
    </div>
  );
}

// ─── Mini KPI ─── (casca canônica StatCard; valores/lógica inalterados)
const VARIANT_TONE = {
  default: "neutral",
  highlight: "primary",
  success: "success",
  warning: "warning",
} as const;

export const MiniKpi = forwardRef<HTMLDivElement, {
  label: string; value: string | number; sub?: string;
  variant?: "default" | "highlight" | "success" | "warning";
  onClick?: () => void;
  /** Variação % vs. período anterior. null/undefined esconde o indicador. */
  delta?: number | null;
  /** Quando true, queda é boa (ex.: no-show). */
  invertDelta?: boolean;
}>(({ label, value, sub, variant = "default", onClick, delta, invertDelta }, ref) => {
  const showDelta = delta != null && Number.isFinite(delta);
  const positive = showDelta && (invertDelta ? (delta ?? 0) < 0 : (delta ?? 0) > 0);
  const neutral = showDelta && Math.round((delta ?? 0)) === 0;
  const deltaNode = showDelta ? (
    <span
      className={`text-[10px] font-semibold leading-none ${neutral ? "text-muted-foreground" : positive ? "text-success-500" : "text-danger-500"}`}
      title="vs. período anterior"
    >
      {neutral ? "→" : (delta ?? 0) > 0 ? "▲" : "▼"} {Math.abs(Math.round((delta ?? 0)))}%
    </span>
  ) : null;

  return (
    <div ref={ref}>
      <StatCard
        label={label}
        value={value}
        tone={VARIANT_TONE[variant]}
        onClick={onClick}
        sub={
          deltaNode || sub ? (
            <span className="inline-flex items-center gap-1.5">
              {deltaNode}
              {sub && <span className="text-muted-foreground/70 truncate">{sub}</span>}
            </span>
          ) : undefined
        }
        className="w-full p-3.5 rounded-xl [&>p:nth-child(1)]:normal-case [&>p:nth-child(1)]:truncate [&>p:nth-child(2)]:text-xl [&>p:nth-child(2)]:tracking-tight"
      />
    </div>
  );
});
MiniKpi.displayName = "MiniKpi";

// ─── Horizontal Bar ───
export function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="group/bar">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="truncate text-muted-foreground group-hover/bar:text-foreground transition-colors">{label}</span>
        <span className="font-semibold text-foreground ml-2 shrink-0">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--ceo-desktop-line)] dark:bg-muted/60 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

