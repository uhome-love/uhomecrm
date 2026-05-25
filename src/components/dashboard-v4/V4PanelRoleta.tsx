import { Link } from "react-router-dom";
import { ArrowRight, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useDashboardGerenteV4Dia,
  type RoletaCredenciado,
} from "@/hooks/useDashboardGerenteV4Dia";

interface Props {
  gestorId: string | undefined;
}

const TURNO_LABEL: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noturna: "Noite",
  dia_todo: "Dia todo",
};

const TURNO_ORDER: Record<string, number> = {
  manha: 0,
  tarde: 1,
  noturna: 2,
  dia_todo: 3,
};

interface CredAgrupado {
  corretor_id: string;
  nome: string | null;
  avatar_url: string | null;
  turno_ativo_agora: boolean;
  turnos: { janela: string; leads: number }[];
}

function groupByCorretor(list: RoletaCredenciado[]): CredAgrupado[] {
  const map = new Map<string, CredAgrupado>();
  for (const c of list) {
    const existing = map.get(c.corretor_id);
    if (existing) {
      existing.turno_ativo_agora = existing.turno_ativo_agora || c.turno_ativo_agora;
      existing.turnos.push({ janela: c.janela, leads: c.leads_recebidos_dia });
    } else {
      map.set(c.corretor_id, {
        corretor_id: c.corretor_id,
        nome: c.nome,
        avatar_url: c.avatar_url,
        turno_ativo_agora: c.turno_ativo_agora,
        turnos: [{ janela: c.janela, leads: c.leads_recebidos_dia }],
      });
    }
  }
  for (const item of map.values()) {
    item.turnos.sort(
      (a, b) => (TURNO_ORDER[a.janela] ?? 99) - (TURNO_ORDER[b.janela] ?? 99),
    );
  }
  return Array.from(map.values());
}

function CredCard({ c }: { c: CredAgrupado }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/20 p-2.5">
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9">
          <AvatarImage src={c.avatar_url ?? undefined} alt={c.nome ?? ""} />
          <AvatarFallback className="text-xs">
            {(c.nome ?? "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {c.turno_ativo_agora && (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success-500 ring-2 ring-card" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{c.nome ?? "—"}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {c.turnos
            .map((t) => `${TURNO_LABEL[t.janela] ?? t.janela} · ${t.leads}`)
            .join("  ·  ")}
        </p>
      </div>
    </div>
  );
}

export function V4PanelRoleta({ gestorId }: Props) {
  const { isAdmin } = useUserRole();
  const { data, isLoading } = useDashboardGerenteV4Dia(gestorId, "hoje");
  const roleta = data?.roleta_dia;
  const credenciados = roleta?.credenciados ?? [];
  const agrupados = groupByCorretor(credenciados);
  const ativos = agrupados.filter((c) => c.turno_ativo_agora).length;
  const turnoLabel = TURNO_LABEL[roleta?.turno_ativo_atual ?? ""] ?? "—";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Roleta — turno {turnoLabel}</h3>
      </div>

      <div
        className={cn(
          "rounded-lg p-2.5 mb-3 text-xs font-medium",
          ativos > 0 ? "bg-success-50 text-success-700" : "bg-muted/40 text-muted-foreground",
        )}
      >
        Credenciados agora: <span className="tabular-nums font-bold">{ativos}</span> / {agrupados.length}
      </div>

      <div className="flex-1 min-h-[180px]">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : agrupados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum credenciamento aprovado hoje
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {agrupados.map((c) => (
              <CredCard key={c.corretor_id} c={c} />
            ))}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-4 pt-3 border-t border-border flex justify-end">
          <Link
            to="/roleta"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            Gerenciar roleta <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
