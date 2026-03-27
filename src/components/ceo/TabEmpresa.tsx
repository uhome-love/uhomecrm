import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, CalendarCheck, CalendarDays, Briefcase, DollarSign, Users, Trophy } from "lucide-react";
import { cn, formatBRLCompact } from "@/lib/utils";

const GERENTES = [
  { user_id: "7882d73e-ff5c-4b23-9b08-2adeadcd1800", nome: "Gabrielle", cor: "#9333EA", equipe: "gabrielle" },
  { user_id: "fb61ecda-5c4b-49d7-bda7-ccf9b589da07", nome: "Bruno Schuler", cor: "#2563EB", equipe: "bruno" },
  { user_id: "b3a1c3a4-f109-40ae-b5d4-15eff3a541ab", nome: "Gabriel", cor: "#16A34A", equipe: "gabriel" },
];

type EmpPeriod = "hoje" | "semana" | "mes" | "30dias";

const PERIOD_PILLS: { label: string; value: EmpPeriod }[] = [
  { label: "Hoje", value: "hoje" },
  { label: "Semana", value: "semana" },
  { label: "Mês", value: "mes" },
  { label: "30 dias", value: "30dias" },
];

function getDateRange(p: EmpPeriod): { from: string; to: string } {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const today = brt.toISOString().slice(0, 10);

  if (p === "hoje") return { from: today, to: today };
  if (p === "semana") {
    const d = new Date(brt);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return { from: d.toISOString().slice(0, 10), to: today };
  }
  if (p === "mes") {
    return { from: `${today.slice(0, 7)}-01`, to: today };
  }
  // 30dias
  const d30 = new Date(brt);
  d30.setDate(d30.getDate() - 29);
  return { from: d30.toISOString().slice(0, 10), to: today };
}

interface TeamData {
  gerente: typeof GERENTES[0];
  membros: number;
  ligacoes: number;
  visitasMarcadas: number;
  visitasRealizadas: number;
  negocios: number;
  vgv: number;
}

interface CorretorRank {
  nome: string;
  equipe: string;
  cor: string;
  ligacoes: number;
  vMarc: number;
  vReal: number;
  pts: number;
}

export default function TabEmpresa() {
  const [period, setPeriod] = useState<EmpPeriod>("hoje");
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState<TeamData[]>([]);
  const [totals, setTotals] = useState({ ligacoes: 0, vMarc: 0, vReal: 0, negocios: 0, vgv: 0 });
  const [ranking, setRanking] = useState<CorretorRank[]>([]);

  const range = useMemo(() => getDateRange(period), [period]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get team members per gerente
      const { data: members } = await supabase
        .from("team_members")
        .select("id, user_id, gerente_id")
        .in("gerente_id", GERENTES.map(g => g.user_id));

      const membersByGerente: Record<string, { user_id: string; tm_id: string }[]> = {};
      GERENTES.forEach(g => { membersByGerente[g.user_id] = []; });
      (members || []).forEach(m => {
        if (membersByGerente[m.gerente_id]) {
          membersByGerente[m.gerente_id].push({ user_id: m.user_id, tm_id: m.id });
        }
      });

      const allUserIds = (members || []).map(m => m.user_id);

      // 2. Get names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", allUserIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach(p => { nameMap[p.user_id] = p.nome || ""; });

      // 3. Get KPIs via RPC
      const { data: kpisData } = await supabase.rpc("get_kpis_por_periodo", {
        p_start: range.from,
        p_end: range.to,
        p_user_id: null,
      });
      const kpiMap: Record<string, any> = {};
      (kpisData || []).forEach((k: any) => { kpiMap[k.auth_user_id] = k; });

      // 4. Get active negocios from 'negocios' table
      const { data: negocios } = await supabase
        .from("negocios")
        .select("auth_user_id, vgv_estimado, vgv_final, fase")
        .in("fase", ["novo_negocio", "proposta", "negociacao", "documentacao"])
        .in("auth_user_id", allUserIds);

      const negMap: Record<string, { count: number; vgv: number }> = {};
      (negocios || []).forEach((n: any) => {
        const uid = n.auth_user_id;
        if (!negMap[uid]) negMap[uid] = { count: 0, vgv: 0 };
        negMap[uid].count++;
        negMap[uid].vgv += Number(n.vgv_estimado || n.vgv_final || 0);
      });

      // 5. Build team data
      const teams: TeamData[] = GERENTES.map(g => {
        const mems = membersByGerente[g.user_id] || [];
        let lig = 0, vm = 0, vr = 0, neg = 0, vgv = 0;
        mems.forEach(m => {
          const k = kpiMap[m.user_id];
          if (k) {
            lig += Number(k.total_ligacoes || 0);
            vm += Number(k.visitas_marcadas || 0);
            vr += Number(k.visitas_realizadas || 0);
          }
          const n = negMap[m.user_id];
          if (n) { neg += n.count; vgv += n.vgv; }
        });
        return { gerente: g, membros: mems.length, ligacoes: lig, visitasMarcadas: vm, visitasRealizadas: vr, negocios: neg, vgv };
      });

      const totalLig = teams.reduce((a, t) => a + t.ligacoes, 0);
      const totalVM = teams.reduce((a, t) => a + t.visitasMarcadas, 0);
      const totalVR = teams.reduce((a, t) => a + t.visitasRealizadas, 0);
      const totalNeg = teams.reduce((a, t) => a + t.negocios, 0);
      const totalVgv = teams.reduce((a, t) => a + t.vgv, 0);

      setTeamData(teams);
      setTotals({ ligacoes: totalLig, vMarc: totalVM, vReal: totalVR, negocios: totalNeg, vgv: totalVgv });

      // 6. Build ranking
      const gerenteMap: Record<string, typeof GERENTES[0]> = {};
      GERENTES.forEach(g => {
        (membersByGerente[g.user_id] || []).forEach(m => { gerenteMap[m.user_id] = g; });
      });

      const rankList: CorretorRank[] = allUserIds.map(uid => {
        const k = kpiMap[uid];
        const g = gerenteMap[uid];
        const lig = Number(k?.total_ligacoes || 0);
        const aprov = Number(k?.total_aproveitados || 0);
        const vm = Number(k?.visitas_marcadas || 0);
        const vr = Number(k?.visitas_realizadas || 0);
        const pts = lig * 1 + aprov * 1 + vm * 3 + vr * 5;
        return {
          nome: nameMap[uid] || uid.slice(0, 8),
          equipe: g?.nome || "",
          cor: g?.cor || "#71717a",
          ligacoes: lig,
          vMarc: vm,
          vReal: vr,
          pts,
        };
      }).filter(r => r.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 10);

      setRanking(rankList);
    } catch (e) {
      console.error("TabEmpresa load error", e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const iv = setInterval(loadData, 60_000);
    return () => clearInterval(iv);
  }, [loadData]);

  const metaVisitasDia = 50;

  return (
    <div className="space-y-5">
      {/* Period Pills */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg w-fit">
        {PERIOD_PILLS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              period === p.value
                ? "bg-[#4F46E5] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando dados...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiBox icon={<Phone size={14} />} label="Ligações" value={totals.ligacoes.toLocaleString("pt-BR")} />
            <KpiBox icon={<CalendarDays size={14} />} label="Visitas Marcadas" value={totals.vMarc.toString()} />
            <KpiBox icon={<CalendarCheck size={14} />} label="Visitas Realizadas" value={totals.vReal.toString()} />
            <KpiBox icon={<Briefcase size={14} />} label="Negócios ativos" value={totals.negocios.toString()} />
            <KpiBox icon={<DollarSign size={14} />} label="VGV total" value={formatBRLCompact(totals.vgv)} highlight />
          </div>

          {/* Team Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {teamData.map(t => {
              const metaVis = period === "hoje" ? metaVisitasDia : undefined;
              const totalVis = t.visitasMarcadas + t.visitasRealizadas;
              const pctVis = metaVis && metaVis > 0 ? Math.min(Math.round((totalVis / metaVis) * 100), 100) : null;

              return (
                <Card key={t.gerente.user_id} className="overflow-hidden border-t-[3px] bg-card" style={{ borderTopColor: t.gerente.cor }}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-foreground">{t.gerente.nome}</h3>
                        <p className="text-[10px] text-muted-foreground">{t.membros} corretores</p>
                      </div>
                      <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${t.gerente.cor}15` }}>
                        <Users size={14} style={{ color: t.gerente.cor }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Ligações</p>
                        <p className="font-bold text-foreground">{t.ligacoes.toLocaleString("pt-BR")}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Visitas M/R</p>
                        <p className="font-bold text-foreground">{t.visitasMarcadas}/{t.visitasRealizadas}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Negócios</p>
                        <p className="font-bold text-foreground">{t.negocios}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">VGV</p>
                        <p className="font-bold text-foreground">{formatBRLCompact(t.vgv)}</p>
                      </div>
                    </div>

                    {pctVis !== null && (
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">Visitas ({totalVis}/{metaVis})</span>
                          <span className="font-semibold" style={{ color: t.gerente.cor }}>{pctVis}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctVis}%`, backgroundColor: t.gerente.cor }} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Comparativo */}
          <Card className="bg-card">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Trophy size={14} className="text-[#4F46E5]" /> Comparativo entre equipes
              </h3>
              <ComparisonBars label="Visitas (marc+real)" teams={teamData} getValue={t => t.visitasMarcadas + t.visitasRealizadas} />
              <ComparisonBars label="VGV" teams={teamData} getValue={t => t.vgv} formatFn={formatBRLCompact} />
              <ComparisonBars label="Ligações" teams={teamData} getValue={t => t.ligacoes} />
            </CardContent>
          </Card>

          {/* Top 10 Ranking */}
          {ranking.length > 0 && (
            <Card className="bg-card overflow-hidden">
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Trophy size={14} className="text-[#4F46E5]" />
                  <h3 className="text-sm font-bold text-foreground">Top 10 corretores da empresa</h3>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 text-muted-foreground w-8">#</th>
                      <th className="text-left px-2 py-2 text-muted-foreground">Nome</th>
                      <th className="text-center px-2 py-2 text-muted-foreground">Equipe</th>
                      <th className="text-center px-2 py-2 text-muted-foreground">Lig</th>
                      <th className="text-center px-2 py-2 text-muted-foreground">V.Marc</th>
                      <th className="text-center px-2 py-2 text-muted-foreground">V.Real</th>
                      <th className="text-center px-2 py-2 text-muted-foreground font-bold">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r, i) => (
                      <tr key={`${r.nome}-${i}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 font-bold text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-2 font-medium text-foreground">{r.nome}</td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: r.cor }} />
                            <span className="text-muted-foreground text-[10px]">{r.equipe}</span>
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center text-muted-foreground">{r.ligacoes}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">{r.vMarc}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">{r.vReal}</td>
                        <td className="px-2 py-2 text-center font-bold text-[#4F46E5]">{r.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function KpiBox({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-[#4F46E5]">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[#4F46E5]">{icon}</span>
        <p className="text-[10px] font-medium text-muted-foreground truncate">{label}</p>
      </div>
      <p className={cn("text-xl font-[800] leading-none", highlight ? "text-[#4F46E5]" : "text-foreground")}>{value}</p>
    </div>
  );
}

function ComparisonBars({ label, teams, getValue, formatFn }: {
  label: string;
  teams: TeamData[];
  getValue: (t: TeamData) => number;
  formatFn?: (v: number) => string;
}) {
  const values = teams.map(t => ({ ...t, val: getValue(t) }));
  const max = Math.max(...values.map(v => v.val), 1);
  const sorted = [...values].sort((a, b) => b.val - a.val);

  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="space-y-1.5">
        {sorted.map((t, i) => {
          const pct = max > 0 ? Math.round((t.val / max) * 100) : 0;
          const isLeader = i === 0;
          return (
            <div key={t.gerente.user_id} className="flex items-center gap-2">
              <span className="text-[10px] w-20 truncate text-muted-foreground">{t.gerente.nome}</span>
              <div className="flex-1 h-5 rounded-md bg-muted overflow-hidden relative">
                <div
                  className={cn("h-full rounded-md transition-all duration-500", isLeader ? "opacity-100" : "opacity-50")}
                  style={{ width: `${pct}%`, backgroundColor: t.gerente.cor }}
                />
              </div>
              <span className={cn("text-[11px] font-semibold w-16 text-right", isLeader ? "text-foreground" : "text-muted-foreground")}>
                {formatFn ? formatFn(t.val) : t.val.toLocaleString("pt-BR")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
