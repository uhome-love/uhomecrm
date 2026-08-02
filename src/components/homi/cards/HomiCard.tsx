/**
 * Wrapper único dos cartões do HOMI (Fase D — linguagem visual comum).
 * Todos os cartões de resultado usam a mesma moldura: superfície de card,
 * faixa de acento por tom, cabeçalho com ícone + título + selo, rodapé de fonte.
 */
import type { LucideIcon } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type HomiCardTone = "neutro" | "primario" | "info" | "sucesso" | "alerta" | "critico";

const TONES: Record<HomiCardTone, { accent: string; icon: string; ring: string }> = {
  neutro: { accent: "bg-muted-foreground/40", icon: "text-muted-foreground", ring: "border-border" },
  primario: { accent: "bg-primary", icon: "text-primary", ring: "border-primary/25" },
  info: { accent: "bg-sky-500", icon: "text-sky-500", ring: "border-sky-500/25" },
  sucesso: { accent: "bg-emerald-500", icon: "text-emerald-500", ring: "border-emerald-500/25" },
  alerta: { accent: "bg-amber-500", icon: "text-amber-600", ring: "border-amber-500/30" },
  critico: { accent: "bg-destructive", icon: "text-destructive", ring: "border-destructive/30" },
};

interface Props {
  icon?: LucideIcon;
  titulo: string;
  selo?: string;
  tone?: HomiCardTone;
  fonte?: string;
  onFonteClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export default function HomiCard({
  icon: Icon, titulo, selo, tone = "neutro", fonte, onFonteClick, className, children,
}: Props) {
  const t = TONES[tone];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card/80 p-3 shadow-sm backdrop-blur-sm animate-fade-in",
        t.ring,
        className,
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-0.5", t.accent)} aria-hidden />

      <div className="mb-2 flex items-center gap-1.5">
        {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0", t.icon)} />}
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{titulo}</p>
        {selo && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {selo}
          </span>
        )}
      </div>

      <div className="space-y-2">{children}</div>

      {fonte && (
        <button
          type="button"
          onClick={onFonteClick}
          disabled={!onFonteClick}
          className="mt-2 flex w-full items-center justify-center gap-1 text-[10px] text-muted-foreground underline-offset-2 transition-colors enabled:hover:text-foreground enabled:hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {fonte}
        </button>
      )}
    </div>
  );
}

/** KPI compacto padrão dos cartões do HOMI. */
export function HomiKpi({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/60 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums text-foreground">{valor}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
