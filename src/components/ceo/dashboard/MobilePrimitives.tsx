import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MobileKpiData = {
  label: string;
  value: number | string;
  sub?: string;
  delta?: number | null;
  invertDelta?: boolean;
  tone?: "primary" | "success" | "warning" | "danger";
  onClick?: () => void;
};

export function MobileKpi({ label, value, sub, delta, invertDelta, tone, onClick }: MobileKpiData) {
  const hasDelta = delta != null && Number.isFinite(delta);
  const rounded = Math.round(delta ?? 0);
  const positive = invertDelta ? rounded < 0 : rounded > 0;
  const content = <>
    <span className="text-[13px] font-medium leading-snug text-muted-foreground">{label}</span>
    <strong className={cn("text-[30px] font-bold leading-tight tabular-nums", tone === "primary" && "text-primary", tone === "success" && "text-success", tone === "warning" && "text-warning", tone === "danger" && "text-danger")}>{value}</strong>
    <span className="min-h-4 text-[11px] font-normal leading-relaxed text-muted-foreground">
      {hasDelta && <span className={cn("mr-1 font-semibold", rounded !== 0 && (positive ? "text-success" : "text-danger"))}>{rounded === 0 ? "→" : rounded > 0 ? "▲" : "▼"} {Math.abs(rounded)}% vs. anterior{ sub ? " · " : ""}</span>}
      {sub}
    </span>
  </>;
  const className = cn("flex min-h-[142px] w-full snap-start flex-col items-start justify-start gap-2.5 rounded-xl border border-border bg-card p-4 text-left text-foreground [overflow-wrap:anywhere]", tone === "success" && "border-success/25");
  return onClick ? <Button variant="ghost" onClick={onClick} className={cn(className, "h-auto whitespace-normal hover:bg-accent/40")}>{content}</Button> : <div className={className}>{content}</div>;
}

export function MobileKpiRail({ label, items }: { label: string; items: MobileKpiData[] }) {
  return <div role="group" aria-label={label} className="grid auto-cols-[72%] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden motion-reduce:scroll-auto">
    {items.map((item) => <MobileKpi key={item.label} {...item} />)}
  </div>;
}

export function MobileSection({ title, children, suffix }: { title: string; children: ReactNode; suffix?: ReactNode }) {
  return <section aria-label={title} className="min-w-0 space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="text-[19px] font-bold leading-snug text-foreground">{title}</h2>{suffix}</div>
    {children}
  </section>;
}

export function MobileDisclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details open={defaultOpen || undefined} className="group/disclosure border-y border-border">
    <summary className="flex min-h-[58px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
      <span className="min-w-0 break-words">{title}</span><ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/disclosure:rotate-180 motion-reduce:transition-none" />
    </summary>
    <div className="pb-4">{children}</div>
  </details>;
}

export function MobileDataRow({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className="flex min-h-11 items-start justify-between gap-3 border-t border-border/60 py-3">
    <div className="min-w-0"><p className="break-words text-[13px] text-muted-foreground">{label}</p>{sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}</div>
    <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{value}</div>
  </div>;
}