import { useState } from "react";
import { useMutiraoParticipantes, useMutiraoRanking } from "@/hooks/useMutiraoRealtime";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Trophy, AlertTriangle } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const STATUS_STYLE: Record<string, string> = {
  online: "bg-emerald-500",
  ocioso: "bg-amber-500",
  offline: "bg-muted-foreground/40",
};

export function PainelAoVivo({ sessaoId }: { sessaoId: string }) {
  const { isGestor, isAdmin, isDiretor, hasRole } = useUserRole();
  const { user } = useAuth();
  const isOnlyGestor = hasRole("gestor") && !isAdmin && !isDiretor;
  const [scope, setScope] = useState<"time" | "todos">(isOnlyGestor ? "time" : "todos");
  const parts = useMutiraoParticipantes(sessaoId);
  const rank = useMutiraoRanking(sessaoId);

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
  const totalAp = filtered.reduce((s, p) => s + p.aproveitamentos, 0);
  const totalV = filtered.reduce((s, p) => s + p.visitas, 0);
  const ociosos = filtered.filter((p) => p.status_online === "ocioso");

  return (
    <div className="p-4 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Corretores" value={filtered.length} icon={<Users className="w-4 h-4" />} />
        <KpiCard label="Ligações" value={totalLig} />
        <KpiCard label="Aproveitamentos" value={totalAp} />
        <KpiCard label="Visitas agendadas" value={totalV} highlight />
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {(isGestor || isAdmin || isDiretor) && (
            <>
              <Button size="sm" variant={scope === "time" ? "default" : "outline"} onClick={() => setScope("time")}>Minha equipe</Button>
              <Button size="sm" variant={scope === "todos" ? "default" : "outline"} onClick={() => setScope("todos")}>Toda a Uhome</Button>
            </>
          )}
        </div>
        {ociosos.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5" />
            {ociosos.length} corretor(es) ocioso(s) &gt;10min
          </div>
        )}
      </div>

      {/* Grid corretores */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Corretores ao vivo</div>
        {parts.isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {filtered.map((p) => (
              <div key={p.corretor_id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
                <div className={`w-2 h-2 rounded-full ${STATUS_STYLE[p.status_online] ?? "bg-muted-foreground/40"}`} />
                {p.foto_url ? <img src={p.foto_url} className="w-8 h-8 rounded-full object-cover" /> :
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">{p.nome?.slice(0, 1)}</div>
                }
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.nome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.ligacoes} lig · {p.aproveitamentos} ap · {p.visitas} vis · {p.pontos} pts
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {p.ultima_acao_at ? formatBRT(p.ultima_acao_at, "HH:mm") : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ranking equipes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Ranking entre equipes</p>
          {(rank.data?.equipes ?? []).slice(0, 8).map((e, i) => (
            <div key={i} className="flex items-center gap-2 py-1 border-b last:border-b-0">
              <span className="text-xs font-bold w-4">{i + 1}</span>
              <span className="text-sm flex-1 truncate">{e.equipe}</span>
              <span className="text-xs text-muted-foreground">{e.corretores} corr</span>
              <span className="text-sm font-bold tabular-nums w-14 text-right">{e.pontos} pts</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Ranking individual</p>
          {(rank.data?.corretores ?? []).slice(0, 10).map((c, i) => (
            <div key={c.corretor_id} className="flex items-center gap-2 py-1 border-b last:border-b-0">
              <span className="text-xs font-bold w-4">{i + 1}</span>
              <span className="text-sm flex-1 truncate">{c.nome}</span>
              <span className="text-xs text-muted-foreground">{c.visitas} vis</span>
              <span className="text-sm font-bold tabular-nums w-14 text-right">{c.pontos} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, highlight, icon }: { label: string; value: number | string; highlight?: boolean; icon?: any }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <p className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
