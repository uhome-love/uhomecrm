// =============================================================================
// PresencaHeaderStats — KPIs do dia (Corretores / Na empresa / Pendentes / Saíram)
// Usado no topo da página /roleta/presenca. Responsivo (2 cols mobile → 4 cols sm+).
// =============================================================================
import { Users, CheckCircle2, LogOut as LogOutIcon, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePresencaCorretoresDia,
  type PresencaScope,
} from "@/hooks/usePresencaCorretoresDia";
import { useRoletaPresencas } from "@/hooks/useRoletaPresencas";
import { TURNO_LABEL } from "@/lib/roletaPresenca";

interface Props {
  scope: PresencaScope;
  gestorId?: string;
}

export function PresencaHeaderStats({ scope, gestorId }: Props) {
  const { data, isLoading } = usePresencaCorretoresDia(scope, gestorId);
  const { getPresenca } = useRoletaPresencas();

  const corretores = data?.corretores ?? [];
  const turnoAtivo = data?.turno_ativo_atual ?? "";
  const turnoLabel = TURNO_LABEL[turnoAtivo] ?? "Fora de janela";
  const foraDeJanela = !turnoAtivo || turnoAtivo === "madrugada";

  let naEmpresa = 0;
  let saiu = 0;
  let pendente = 0;
  if (!foraDeJanela) {
    for (const c of corretores) {
      const p = getPresenca(c.corretor_id, turnoAtivo);
      if (p?.status === "na_empresa") naEmpresa++;
      else if (p?.status === "saiu") saiu++;
      else if (c.credenciamentos.length > 0) pendente++;
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-sm">
      <div className="mb-2.5">
        <p className="text-[11px] text-muted-foreground">
          {foraDeJanela
            ? "Fora do turno ativo · dados do último turno"
            : `Turno ${turnoLabel} em andamento`}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 sm:h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MiniStat
            icon={<Users className="h-4 w-4" />}
            label="Corretores"
            value={corretores.length}
            tone="muted"
          />
          <MiniStat
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Na empresa"
            value={naEmpresa}
            tone="success"
            dim={foraDeJanela}
          />
          <MiniStat
            icon={<Circle className="h-4 w-4" />}
            label="Pendentes"
            value={pendente}
            tone="warning"
            dim={foraDeJanela}
          />
          <MiniStat
            icon={<LogOutIcon className="h-4 w-4" />}
            label="Saíram"
            value={saiu}
            tone="danger"
            dim={foraDeJanela}
          />
        </div>
      )}
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
  dim,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "muted" | "success" | "warning" | "danger";
  dim?: boolean;
}) {
  const toneClass = {
    muted: "bg-muted/40 text-muted-foreground",
    success: "bg-success-500/10 text-success-700",
    warning: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    danger: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div
      className={cn(
        "rounded-lg px-2.5 py-2 flex flex-col gap-0.5",
        toneClass,
        dim && "opacity-50",
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-lg sm:text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
