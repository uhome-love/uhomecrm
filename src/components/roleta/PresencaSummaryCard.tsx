// =============================================================================
// PresencaSummaryCard — Card compacto de presença para dashboards.
// Substitui o painel completo dentro do CEO/Gestor. Redireciona pra página
// dedicada /roleta/presenca para gestão ampla.
// =============================================================================
import { Link } from "react-router-dom";
import { ArrowRight, Users, CheckCircle2, LogOut as LogOutIcon, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { usePresencaCorretoresDia, type PresencaScope } from "@/hooks/usePresencaCorretoresDia";
import { useRoletaPresencas } from "@/hooks/useRoletaPresencas";
import { TURNO_LABEL } from "@/lib/roletaPresenca";

interface Props {
  scope: PresencaScope;
  gestorId?: string;
}

export function PresencaSummaryCard({ scope, gestorId }: Props) {
  const { data, isLoading } = usePresencaCorretoresDia(scope, gestorId);
  const { getPresenca } = useRoletaPresencas();

  const corretores = data?.corretores ?? [];
  const turnoAtivo = data?.turno_ativo_atual ?? "";
  const turnoLabel = TURNO_LABEL[turnoAtivo] ?? "Fora de janela";
  const foraDeJanela = !turnoAtivo || turnoAtivo === "madrugada";

  // Contagens no turno ativo
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

  const titulo = scope === "ceo" ? "Presença da Roleta" : "Presença do Time";
  const linkLabel = scope === "ceo" ? "Ver central de presença" : "Gerenciar presença do time";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          <p className="text-[11px] text-muted-foreground">
            {foraDeJanela ? "Fora do turno ativo" : `Turno ${turnoLabel} em andamento`}
          </p>
        </div>
        <Link
          to="/roleta/presenca"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium shrink-0"
        >
          {linkLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
        "rounded-lg px-3 py-2 flex flex-col gap-0.5",
        toneClass,
        dim && "opacity-50",
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
