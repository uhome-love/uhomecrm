import { UserCheck, Users, CalendarCheck2, Briefcase, TrendingUp, Banknote, ArrowUp, ArrowDown, Minus, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/fmtMoney";
import { delta } from "@/lib/perfPeriodo";
import { presencaPct, type FunilTotais } from "@/hooks/useFunilPerformance";

interface Props {
  atual: FunilTotais;
  anterior: FunilTotais;
  loading: boolean;
}

interface Kpi {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  /** valor do comparativo, já na unidade certa (relativo % / pp / diferença absoluta) */
  delta: number | null;
  unidade?: "pp" | "pct" | "abs";
  sub?: string;
  strong?: boolean;
}

function DeltaTag({ v, unidade = "pct" }: { v: number | null; unidade?: Kpi["unidade"] }) {
  if (v === null || !Number.isFinite(v)) return <span className="text-muted-foreground/70 text-[11px] font-medium">sem base</span>;
  const zero = Math.round(v) === 0;
  const Icon = zero ? Minus : v > 0 ? ArrowUp : ArrowDown;
  const suf = unidade === "pp" ? "pp" : unidade === "abs" ? "" : "%";
  const txt = `${Math.abs(Math.round(v))}${suf}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11.5px] font-bold",
        zero ? "text-muted-foreground" : v > 0 ? "text-success-700 dark:text-success-500" : "text-danger-500"
      )}
      title="vs. período anterior"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      {txt}
    </span>
  );
}

export function PerfKpis({ atual: t, anterior: p, loading }: Props) {
  const diasBase = t.dias_uteis_decorridos || t.dias_uteis;
  const presAtual = Math.round(presencaPct(t));
  const kpis: Kpi[] = [
    { key: "pres", icon: UserCheck, label: "Presença", value: `${presAtual}%`, delta: presAtual - Math.round(presencaPct(p)), unidade: "pp", sub: `${t.presenca_dias} de ${diasBase * (t.corretores_ativos || 1)} dias` },
    { key: "leads", icon: Users, label: "Leads", value: t.leads_recebidos.toLocaleString("pt-BR"), delta: delta(t.leads_recebidos, p.leads_recebidos), unidade: "pct" },
    { key: "vis", icon: CalendarCheck2, label: "Visitas realiz.", value: t.visitas_realizadas.toLocaleString("pt-BR"), delta: delta(t.visitas_realizadas, p.visitas_realizadas), unidade: "pct", sub: `${t.visitas_total} criadas` },
    { key: "neg", icon: Briefcase, label: "Negócios", value: t.negocios_abertos.toLocaleString("pt-BR"), delta: t.negocios_abertos - p.negocios_abertos, unidade: "abs" },
    { key: "sale", icon: TrendingUp, label: "Vendas", value: t.vendas.toLocaleString("pt-BR"), delta: t.vendas - p.vendas, unidade: "abs" },
    { key: "vgv", icon: Banknote, label: "VGV assinado", value: fmtMoney(t.vgv_assinado, "short"), delta: delta(t.vgv_assinado, p.vgv_assinado), unidade: "pct", strong: true },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[96px] rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <div
            key={k.key}
            className={cn(
              "rounded-2xl border p-3.5 transition-shadow hover:shadow-[0_8px_24px_-14px_rgba(15,23,42,0.35)]",
              k.strong ? "border-primary/25 bg-gradient-to-br from-primary/[0.07] to-card" : "border-border bg-card"
            )}
          >
            <div className={cn("flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide", k.strong ? "text-primary" : "text-muted-foreground")}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {k.label}
            </div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums text-foreground">{k.value}</div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <DeltaTag v={k.delta} unidade={k.unidade} />
              {k.sub && <span className="truncate text-[11px] text-muted-foreground/70">· {k.sub}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
