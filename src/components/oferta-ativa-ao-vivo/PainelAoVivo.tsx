import { useState } from "react";
import { useMutiraoParticipantes, useMutiraoRanking } from "@/hooks/useMutiraoRealtime";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Users, Trophy, AlertTriangle, PhoneCall, Sparkles, CalendarCheck2 } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; dot: string }> = {
  online:  { label: "Online",  dot: "bg-success-500" },
  ocioso:  { label: "Ocioso",  dot: "bg-warning-500" },
  offline: { label: "Offline", dot: "bg-muted-foreground/40" },
};

const MEDALS = ["🥇", "🥈", "🥉"];

export function PainelAoVivo({ sessaoId }: { sessaoId: string }) {
  const { isGestor, isAdmin, isDiretor, hasRole } = useUserRole();
  const { user } = useAuth();
  const isOnlyGestor = hasRole("gestor") && !isAdmin && !isDiretor;
  const [scope, setScope] = useState<"time" | "todos">(isOnlyGestor ? "time" : "todos");
  const parts = useMutiraoParticipantes(sessaoId);
  const rank = useMutiraoRanking(sessaoId);
  const canScope = isGestor || isAdmin || isDiretor;

  const { data: myProfile } = useQuery({
    queryKey: ["oa-live-my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id").eq("user_id", user!.id).maybeSingle();
      return data?.id ?? null;
    },
  });

  const items = parts.data?.participantes ?? [];
  const filtered = scope === "time" && myProfile
    ? items.filter((p) => p.gerente_id === myProfile)
    : items;

  const totalLig = filtered.reduce((s, p) => s + p.ligacoes, 0);
  const totalAp  = filtered.reduce((s, p) => s + p.aproveitamentos, 0);
  const totalV   = filtered.reduce((s, p) => s + p.visitas, 0);
  const ociosos  = filtered.filter((p) => p.status_online === "ocioso");

  const equipes = rank.data?.equipes ?? [];
  const maxEqPts = Math.max(1, ...equipes.map((e) => e.pontos));
  const corretores = rank.data?.corretores ?? [];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile label="Corretores" value={filtered.length} icon={Users} />
          <KpiTile label="Ligações" value={totalLig} icon={PhoneCall} />
          <KpiTile label="Aproveitamentos" value={totalAp} icon={Sparkles} />
          <KpiTile label="Visitas agendadas" value={totalV} icon={CalendarCheck2} highlight />
        </div>

        {/* Toolbar: scope + alerts */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canScope ? (
            <div className="inline-flex rounded-md border border-border bg-card p-0.5 shadow-sm">
              <SegBtn active={scope === "time"} onClick={() => setScope("time")}>Minha equipe</SegBtn>
              <SegBtn active={scope === "todos"} onClick={() => setScope("todos")}>Toda a Uhome</SegBtn>
            </div>
          ) : <div />}
          {ociosos.length > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-warning-500/30 bg-warning-500/10 px-2.5 py-1 text-xs font-medium text-warning-700 dark:text-warning-500">
              <AlertTriangle className="w-3.5 h-3.5" />
              {ociosos.length} corretor{ociosos.length > 1 ? "es" : ""} ociosos &gt;10min
            </div>
          )}
        </div>

        {/* Corretores ao vivo */}
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <Users className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Corretores ao vivo</p>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{filtered.length}</span>
          </div>
          <div className="p-3">
            {parts.isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">Ninguém aqui ainda.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {filtered.map((p) => {
                  const status = STATUS_META[p.status_online] ?? STATUS_META.offline;
                  return (
                    <div
                      key={p.corretor_id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted/40 transition-colors"
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9">
                          {p.foto_url && <AvatarImage src={p.foto_url} alt={p.nome} />}
                          <AvatarFallback className="text-xs">{(p.nome || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(
                              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card",
                              status.dot,
                            )} />
                          </TooltipTrigger>
                          <TooltipContent>{status.label}</TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-foreground">{p.nome}</p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {p.ligacoes} lig · {p.aproveitamentos} ap · {p.visitas} vis · <span className="font-semibold text-foreground">{p.pontos}</span> pts
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {p.ultima_acao_at ? formatBRT(p.ultima_acao_at, "HH:mm") : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Equipes */}
          <div className="rounded-xl border border-border bg-card shadow-card">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
              <Trophy className="w-4 h-4 text-warning-500" />
              <p className="text-sm font-semibold text-foreground">Ranking entre equipes</p>
            </div>
            <div className="p-3 space-y-2">
              {equipes.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Sem equipes ainda.</p>}
              {equipes.slice(0, 8).map((e, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-5 text-center">{i < 3 ? MEDALS[i] : <span className="text-muted-foreground font-semibold">{i + 1}</span>}</span>
                    <span className="flex-1 truncate font-medium text-foreground">{e.equipe}</span>
                    <span className="text-muted-foreground shrink-0">{e.corretores} corr</span>
                    <span className="w-14 text-right tabular-nums text-muted-foreground shrink-0">{e.ligacoes} lig</span>
                    <span className="w-14 text-right tabular-nums text-muted-foreground shrink-0">{e.visitas} vis</span>
                    <span className="w-16 text-right font-bold tabular-nums text-foreground shrink-0">{e.pontos} pts</span>
                  </div>
                  <Progress value={(e.pontos / maxEqPts) * 100} className="h-1.5" />
                </div>
              ))}

            </div>
          </div>

          {/* Individual */}
          <div className="rounded-xl border border-border bg-card shadow-card">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
              <Trophy className="w-4 h-4 text-warning-500" />
              <p className="text-sm font-semibold text-foreground">Ranking individual</p>
            </div>
            <div className="p-2">
              {corretores.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Sem participantes.</p>}
              {corretores.slice(0, 10).map((c, i) => {
                const isMe = c.corretor_id === myProfile;
                return (
                  <div
                    key={c.corretor_id}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors",
                      isMe ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60",
                    )}
                  >
                    <span className={cn("w-6 text-center shrink-0", i < 3 ? "text-base" : "text-xs font-semibold text-muted-foreground")}>
                      {i < 3 ? MEDALS[i] : i + 1}
                    </span>
                    <Avatar className="h-7 w-7">
                      {c.foto_url && <AvatarImage src={c.foto_url} alt={c.nome} />}
                      <AvatarFallback className="text-[10px]">{(c.nome || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className={cn("text-sm truncate flex-1", isMe && "font-semibold text-foreground")}>{c.nome}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{c.visitas} vis</span>
                    <span className="text-sm font-bold tabular-nums w-14 text-right text-foreground">{c.pontos} pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 h-7 rounded text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function KpiTile({
  label, value, icon: Icon, highlight,
}: { label: string; value: number | string; icon: any; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-lift bg-card shadow-card",
        highlight ? "border-primary/40 bg-primary/[0.04]" : "border-border",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className={cn(
        "text-3xl font-bold tabular-nums mt-1.5 leading-none",
        highlight ? "text-primary" : "text-foreground",
      )}>
        {value}
      </p>
    </div>
  );
}
