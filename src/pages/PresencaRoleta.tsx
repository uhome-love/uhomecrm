// =============================================================================
// PresencaRoleta — Central de presença da roleta.
// 3 abas: Hoje (grid operacional), Histórico (métricas agregadas), Auditoria.
// - admin/diretor: escopo empresa inteira
// - gestor: escopo time
// =============================================================================
import { useMemo, useState } from "react";
import { CalendarClock, BarChart3, ScrollText, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { PresencaRoletaPanel } from "@/components/roleta/PresencaRoletaPanel";
import { PresencaHeaderStats } from "@/components/roleta/PresencaHeaderStats";
import { usePresencaAgregada } from "@/hooks/usePresencaAgregada";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatBRT } from "@/lib/brtTime";
import { TURNO_LABEL } from "@/lib/roletaPresenca";
import { cn } from "@/lib/utils";

function todayBRT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysAgoBRT(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default function PresencaRoleta() {
  const { user } = useAuth();
  const { isAdmin, isDiretor, isGestor } = useUserRole();

  // Escopo: admin/diretor = empresa; gestor = time
  const scope: "ceo" | "gestor" = isAdmin || isDiretor ? "ceo" : "gestor";
  const gestorId = scope === "gestor" ? user?.id : undefined;

  if (!isAdmin && !isDiretor && !isGestor) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Página exclusiva para gestão. Fale com seu gerente ou admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-3 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Presença</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Validação por turno, histórico e auditoria.
          {scope === "ceo" ? " Empresa inteira." : " Seu time."}
        </p>
      </div>

      {/* KPIs do dia (migrados do Dashboard CEO) */}
      <PresencaHeaderStats scope={scope} gestorId={gestorId} />

      <Tabs defaultValue="hoje" className="space-y-4">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="hoje" className="gap-1.5 text-xs sm:text-sm">
            <CalendarClock className="h-3.5 w-3.5" />
            <span className="hidden xs:inline sm:inline">Hoje</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1.5 text-xs sm:text-sm">
            <ScrollText className="h-3.5 w-3.5" />
            <span>Auditoria</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="mt-0">
          <PresencaRoletaPanel scope={scope} gestorId={gestorId} hideManagerLink />
        </TabsContent>

        <TabsContent value="historico" className="mt-0">
          <HistoricoTab scope={scope} gestorId={gestorId} />
        </TabsContent>

        <TabsContent value="auditoria" className="mt-0">
          <AuditoriaTab scope={scope} gestorId={gestorId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Histórico ───────────────────────────────────────────────────────────────
function HistoricoTab({
  scope,
  gestorId,
}: {
  scope: "ceo" | "gestor";
  gestorId?: string;
}) {
  const [range, setRange] = useState<"7" | "30" | "90">("30");
  const dataInicio = daysAgoBRT(Number(range) - 1);
  const dataFim = todayBRT();

  const { data, isLoading } = usePresencaAgregada({
    dataInicio,
    dataFim,
    gestorId: scope === "gestor" ? gestorId ?? null : null,
  });

  const rows = useMemo(
    () =>
      (data ?? [])
        .slice()
        .sort((a, b) => (b.total_presencas ?? 0) - (a.total_presencas ?? 0)),
    [data],
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold">Presenças acumuladas</h3>
          <p className="text-[11px] text-muted-foreground">
            {dataInicio} até {dataFim}
          </p>
        </div>
        <div className="flex rounded-lg bg-muted/40 p-0.5 text-xs">
          {(["7", "30", "90"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1 rounded-md font-medium transition",
                range === r
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground/60 mb-2" />
          <p className="text-sm text-muted-foreground">
            Sem presenças registradas nesse período.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="text-left font-semibold py-2">Corretor</th>
                {scope === "ceo" && (
                  <th className="text-left font-semibold py-2 hidden md:table-cell">
                    Equipe
                  </th>
                )}
                <th className="text-center font-semibold py-2">Manhã</th>
                <th className="text-center font-semibold py-2">Tarde</th>
                <th className="text-center font-semibold py-2">Diurnas</th>
                <th className="text-center font-semibold py-2">Noturnas</th>
                <th className="text-center font-semibold py-2">Domingos</th>
                <th className="text-center font-semibold py-2 text-yellow-700">Saídas</th>
                <th className="text-center font-semibold py-2 text-destructive">Faltas</th>
                <th className="text-center font-semibold py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.corretor_id}
                  className="border-b border-border/50 hover:bg-muted/20"
                >
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={r.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[9px]">
                          {(r.nome ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{r.nome ?? "—"}</span>
                    </div>
                  </td>
                  {scope === "ceo" && (
                    <td className="py-2 text-[11px] text-muted-foreground hidden md:table-cell">
                      {r.gerente_nome ?? "—"}
                    </td>
                  )}
                  <td className="text-center tabular-nums">{r.manha}</td>
                  <td className="text-center tabular-nums">{r.tarde}</td>
                  <td className="text-center tabular-nums font-semibold">
                    {r.diurnas}
                  </td>
                  <td className="text-center tabular-nums">{r.noturnas}</td>
                  <td className="text-center tabular-nums">{r.domingos}</td>
                  <td className="text-center tabular-nums text-yellow-700">
                    {r.saidas}
                  </td>
                  <td className="text-center tabular-nums text-destructive">
                    {r.faltas}
                  </td>
                  <td className="text-center tabular-nums font-bold text-primary">
                    {r.total_presencas}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Auditoria ───────────────────────────────────────────────────────────────
function AuditoriaTab({
  scope,
  gestorId,
}: {
  scope: "ceo" | "gestor";
  gestorId?: string;
}) {
  const [dias, setDias] = useState<"1" | "7" | "30">("7");
  const desde = daysAgoBRT(Number(dias) - 1);

  const { data, isLoading } = useQuery({
    queryKey: ["presenca-auditoria", scope, gestorId, dias],
    staleTime: 30_000,
    queryFn: async () => {
      // Últimas alterações em roleta_presencas
      let q = supabase
        .from("roleta_presencas")
        .select(
          "id, corretor_id, data, turno, status, chegou_em, saiu_em, origem, criado_em",
        )
        .gte("data", desde)
        .order("criado_em", { ascending: false })
        .limit(200);

      const { data: rows, error } = await q;
      if (error) throw error;

      // Buscar nomes (uma query só)
      const ids = Array.from(new Set((rows ?? []).map((r: any) => r.corretor_id)));
      let nomesMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", ids);
        for (const p of profs ?? []) {
          nomesMap.set((p as any).id, (p as any).nome ?? "—");
        }
      }
      return (rows ?? []).map((r: any) => ({
        ...r,
        nome: nomesMap.get(r.corretor_id) ?? "—",
      }));
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold">Últimas alterações</h3>
          <p className="text-[11px] text-muted-foreground">
            Registro cronológico de presenças, saídas e faltas.
          </p>
        </div>
        <div className="flex rounded-lg bg-muted/40 p-0.5 text-xs">
          {(["1", "7", "30"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setDias(r)}
              className={cn(
                "px-3 py-1 rounded-md font-medium transition",
                dias === r
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Nenhum registro no período.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
          {(data ?? []).map((r: any) => (
            <div
              key={r.id}
              className="flex items-center gap-2 text-xs rounded-md px-2 py-1.5 bg-muted/20 border border-transparent hover:border-border"
            >
              <span className="w-32 shrink-0 font-medium truncate">{r.nome}</span>
              <span className="text-[10px] text-muted-foreground w-16 shrink-0">
                {TURNO_LABEL[r.turno] ?? r.turno}
              </span>
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-[1px] rounded-full",
                  r.status === "na_empresa"
                    ? "bg-success-500/15 text-success-700"
                    : r.status === "saiu"
                      ? "bg-yellow-500/15 text-yellow-700"
                      : "bg-destructive/10 text-destructive",
                )}
              >
                {r.status}
              </span>
              <span className="text-[10px] text-muted-foreground">{r.data}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {r.origem ?? "—"}
              </span>
              <span className="text-[10px] text-muted-foreground w-20 text-right shrink-0">
                {r.criado_em ? formatBRT(r.criado_em, "dd/MM HH:mm") : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
