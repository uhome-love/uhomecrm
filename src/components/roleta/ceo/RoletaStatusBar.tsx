import { useRoletaStatus } from "@/hooks/useRoletaStatus";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Users,
  AlertTriangle,
  Timer,
  TrendingUp,
  CheckCircle2,
  UserCheck,
} from "lucide-react";

interface Props {
  /** Credenciados ativos na fila agora (vem do useRoleta). */
  credenciadosAtivos: number;
  /** Credenciamentos aguardando aprovação do CEO. */
  pendentes: number;
  /** Navega para uma sub-aba ao clicar num KPI. */
  onNavigate?: (group: string, sub: string) => void;
}

interface StatItem {
  key: string;
  label: string;
  value: number | string;
  icon: typeof Users;
  tone: "default" | "warn" | "info" | "success";
  target?: { group: string; sub: string };
}

const TONE_CLASSES: Record<StatItem["tone"], string> = {
  default: "text-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
  success: "text-emerald-600 dark:text-emerald-400",
};

export function RoletaStatusBar({ credenciadosAtivos, pendentes, onNavigate }: Props) {
  const { data, isLoading } = useRoletaStatus();

  const stats: StatItem[] = [
    {
      key: "credenciados",
      label: "Credenciados",
      value: credenciadosAtivos,
      icon: Users,
      tone: "default",
      target: { group: "operacao", sub: "board" },
    },
    {
      key: "pendentes",
      label: "Aprovações",
      value: pendentes,
      icon: UserCheck,
      tone: pendentes > 0 ? "warn" : "default",
      target: { group: "operacao", sub: "board" },
    },
    {
      key: "fila_ceo",
      label: "Fila CEO",
      value: data?.fila_ceo ?? 0,
      icon: AlertTriangle,
      tone: (data?.fila_ceo ?? 0) > 0 ? "warn" : "default",
      target: { group: "operacao", sub: "pendentes" },
    },
    {
      key: "aguardando",
      label: "Aguard. aceite",
      value: data?.aguardando_aceite ?? 0,
      icon: Timer,
      tone: "info",
      target: { group: "operacao", sub: "pendentes" },
    },
    {
      key: "distribuidos",
      label: "Distribuídos hoje",
      value: data?.distribuidos_hoje ?? 0,
      icon: TrendingUp,
      tone: "default",
      target: { group: "inteligencia", sub: "metricas" },
    },
    {
      key: "taxa",
      label: "Taxa aceite",
      value: `${data?.taxa_aceite ?? 0}%`,
      icon: CheckCircle2,
      tone: "success",
      target: { group: "inteligencia", sub: "metricas" },
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {stats.map((s) => {
        const Icon = s.icon;
        const clickable = !!s.target && !!onNavigate;
        return (
          <button
            key={s.key}
            type="button"
            disabled={!clickable}
            onClick={() => s.target && onNavigate?.(s.target.group, s.target.sub)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors",
              clickable && "hover:border-primary/40 hover:bg-muted/40"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
              <Icon className={cn("h-4 w-4", TONE_CLASSES[s.tone])} />
            </div>
            <div className="min-w-0">
              {isLoading && s.key !== "credenciados" && s.key !== "pendentes" ? (
                <Skeleton className="h-5 w-10" />
              ) : (
                <p className={cn("text-lg font-bold leading-none tabular-nums", TONE_CLASSES[s.tone])}>
                  {s.value}
                </p>
              )}
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
