import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { todayBRT } from "@/lib/utils";
import { AlertTriangle, Phone, UserX, Clock, Users, Wifi, WifiOff, MapPin, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface CorretorAgora {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  presenca: string;
  na_roleta: boolean;
  ligacoes_hoje: number;
  meta_ligacoes: number;
  aproveitados_hoje: number;
  oa_tentativas: number;
  usou_foco: boolean;
  visitas_marcadas: number;
  visitas_realizadas: number;
  leads_desatualizados: number;
  obs_gerente: string;
  activity_status: "produzindo" | "baixa" | "sem_atividade" | "offline";
}

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
}

const PRESENCA_LABELS: Record<string, { label: string; color: string }> = {
  presente: { label: "Presente", color: "bg-emerald-500" },
  meio_periodo: { label: "½ Período", color: "bg-amber-500" },
  ausente: { label: "Ausente", color: "bg-destructive" },
  atestado: { label: "Atestado", color: "bg-muted-foreground" },
  folga: { label: "Folga", color: "bg-muted-foreground" },
  nao_informado: { label: "Não registrado", color: "bg-muted-foreground/50" },
};

const ACTIVITY_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  produzindo: { label: "Produzindo", dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600" },
  baixa: { label: "Baixa atividade", dot: "bg-amber-400", bg: "bg-amber-500/10", text: "text-amber-600" },
  sem_atividade: { label: "Sem atividade", dot: "bg-red-400", bg: "bg-red-500/10", text: "text-red-600" },
  offline: { label: "Offline", dot: "bg-gray-400", bg: "bg-gray-500/10", text: "text-gray-500" },
};

function MiniRing({ value, max, size = 48, strokeWidth = 4, color = "hsl(var(--primary))" }: {
  value: number; max: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference - pct * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--muted))" strokeWidth={strokeWidth} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-extrabold text-foreground leading-none">{value}</span>
      </div>
    </div>
  );
}

export default function TabAgora({ teamUserIds, teamNameMap }: Props) {
  const { user } = useAuth();
  const [corretores, setCorretores] = useState<CorretorAgora[]>([]);
  const [loading, setLoading] = useState(true);
  const [semLigacaoNomes, setSemLigacaoNomes] = useState<string[]>([]);
  const [leadsSemContato48h, setLeadsSemContato48h] = useState(0);
  const [offlineNomes, setOfflineNomes] = useState<string[]>([]);

  const today = todayBRT();

  const loadData = useCallback(async () => {
    if (!user || teamUserIds.length === 0) return;
    setLoading(true);

    const [r1, r2, r3, r4, r5, r6, r7, r8] = await Promise.all([
      supabase.from("team_members").select("id, nome, user_id").eq("gerente_id", user.id).eq("status", "ativo"),
      supabase.from("profiles").select("user_id, avatar_url").in("user_id", teamUserIds),
      supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado, canal").in("corretor_id", teamUserIds).gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`),
      supabase.from("checkpoint_diario").select("corretor_id, presenca, meta_ligacoes, meta_aproveitados, obs_gerente").eq("data", today).in("corretor_id", teamUserIds),
      supabase.from("corretor_disponibilidade").select("user_id, status, na_roleta, updated_at").in("user_id", teamUserIds),
      supabase.from("visitas").select("corretor_id, status").in("corretor_id", teamUserIds).eq("data_visita", today),
      supabase.from("pipeline_leads").select("corretor_id").in("corretor_id", teamUserIds).lt("updated_at", new Date(Date.now() - 48 * 3600 * 1000).toISOString()),
      supabase.from("corretor_daily_goals").select("corretor_id, meta_ligacoes").in("corretor_id", teamUserIds).eq("data", today),
    ]);

    const members = r1.data || [];
    const profiles: Record<string, any> = {};
    (r2.data || []).forEach((p: any) => { profiles[p.user_id] = p; });

    const oaLig: Record<string, number> = {};
    const oaAprov: Record<string, number> = {};
    (r3.data || []).forEach((t: any) => {
      oaLig[t.corretor_id] = (oaLig[t.corretor_id] || 0) + 1;
      if (t.resultado === "com_interesse") oaAprov[t.corretor_id] = (oaAprov[t.corretor_id] || 0) + 1;
    });

    const checkpoints: Record<string, any> = {};
    (r4.data || []).forEach((c: any) => { checkpoints[c.corretor_id] = c; });

    const disps: Record<string, any> = {};
    (r5.data || []).forEach((d: any) => { disps[d.user_id] = d; });

    const vmCount: Record<string, number> = {};
    const vrCount: Record<string, number> = {};
    (r6.data || []).forEach((v: any) => {
      vmCount[v.corretor_id] = (vmCount[v.corretor_id] || 0) + 1;
      if (v.status === "realizada") vrCount[v.corretor_id] = (vrCount[v.corretor_id] || 0) + 1;
    });

    const desatCount: Record<string, number> = {};
    (r7.data || []).forEach((l: any) => { desatCount[l.corretor_id] = (desatCount[l.corretor_id] || 0) + 1; });

    const goals: Record<string, any> = {};
    (r8.data || []).forEach((g: any) => { goals[g.corretor_id] = g; });

    // Count leads sem contato 48h (total)
    const total48h = Object.values(desatCount).reduce((s, v) => s + v, 0);
    setLeadsSemContato48h(total48h);

    const cards: CorretorAgora[] = members
      .filter((m: any) => m.user_id && teamUserIds.includes(m.user_id))
      .map((m: any) => {
        const uid = m.user_id;
        const cp = checkpoints[uid];
        const disp = disps[uid];
        const todayCalls = oaLig[uid] || 0;
        const isOnline = disp?.status === "online" || disp?.status === "disponivel" || disp?.status === "na_empresa" || disp?.status === "em_visita";
        const hasVisit = (vrCount[uid] || 0) > 0;

        let activity: CorretorAgora["activity_status"] = "offline";
        if (isOnline) {
          if (todayCalls >= 10 || hasVisit) activity = "produzindo";
          else if (todayCalls >= 1) activity = "baixa";
          else activity = "sem_atividade";
        }

        const metaLig = cp?.meta_ligacoes > 0 ? cp.meta_ligacoes : (goals[uid]?.meta_ligacoes ?? 30);

        return {
          user_id: uid,
          nome: m.nome,
          avatar_url: profiles[uid]?.avatar_url || null,
          presenca: cp?.presenca || "nao_informado",
          na_roleta: disp?.na_roleta || false,
          ligacoes_hoje: todayCalls,
          meta_ligacoes: metaLig,
          aproveitados_hoje: oaAprov[uid] || 0,
          oa_tentativas: todayCalls,
          usou_foco: false,
          visitas_marcadas: vmCount[uid] || 0,
          visitas_realizadas: vrCount[uid] || 0,
          leads_desatualizados: desatCount[uid] || 0,
          obs_gerente: cp?.obs_gerente || "",
          activity_status: activity,
        };
      });

    // Sort: online first, then by calls desc
    cards.sort((a, b) => {
      const aOn = a.activity_status !== "offline" ? 1 : 0;
      const bOn = b.activity_status !== "offline" ? 1 : 0;
      if (aOn !== bOn) return bOn - aOn;
      return b.ligacoes_hoje - a.ligacoes_hoje;
    });

    setCorretores(cards);

    // Alerts
    const semLig = cards.filter(c => c.ligacoes_hoje === 0 && !["ausente", "atestado", "folga"].includes(c.presenca));
    setSemLigacaoNomes(semLig.map(c => c.nome.split(" ")[0]));

    // Offline >2h
    const now = Date.now();
    const offlines = (r5.data || []).filter((d: any) => {
      const isOff = !["online", "disponivel", "na_empresa", "em_visita"].includes(d.status);
      if (!isOff) return false;
      const mins = (now - new Date(d.updated_at).getTime()) / 60000;
      return mins > 120;
    });
    setOfflineNomes(offlines.map((d: any) => teamNameMap[d.user_id]?.split(" ")[0] || "Corretor"));

    setLoading(false);
  }, [user, teamUserIds, teamNameMap, today]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh 60s
  useEffect(() => {
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const saveObsGerente = async (uid: string, obs: string) => {
    await supabase.from("checkpoint_diario").upsert({
      corretor_id: uid, data: today, obs_gerente: obs, presenca: "presente",
    }, { onConflict: "corretor_id,data" });
    toast.success("Observação salva!");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Carregando...</div>;
  }

  const hasAlerts = semLigacaoNomes.length > 0 || leadsSemContato48h > 0 || offlineNomes.length > 0;

  return (
    <div className="space-y-4">
      {/* Alertas Críticos */}
      {hasAlerts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {semLigacaoNomes.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-bold text-destructive">Sem ligação hoje</span>
                  <Badge variant="destructive" className="text-[10px] h-5">{semLigacaoNomes.length}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{semLigacaoNomes.join(", ")}</p>
              </CardContent>
            </Card>
          )}
          {leadsSemContato48h > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-700">Leads sem contato +48h</span>
                  <Badge className="text-[10px] h-5 bg-amber-500">{leadsSemContato48h}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Leads que não foram tocados há mais de 48h</p>
              </CardContent>
            </Card>
          )}
          {offlineNomes.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <WifiOff className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-700">Offline +2h</span>
                  <Badge className="text-[10px] h-5 bg-amber-500">{offlineNomes.length}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{offlineNomes.join(", ")}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Grid de Corretores */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {corretores.map(c => {
          const pres = PRESENCA_LABELS[c.presenca] || PRESENCA_LABELS.nao_informado;
          const act = ACTIVITY_CONFIG[c.activity_status];
          const ligPct = c.meta_ligacoes > 0 ? Math.round((c.ligacoes_hoje / c.meta_ligacoes) * 100) : 0;

          return (
            <Card key={c.user_id} className="border-border/60 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt={c.nome} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {c.nome.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground truncate">{c.nome.split(" ").slice(0, 2).join(" ")}</span>
                      {c.na_roleta && <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/30 text-primary">Roleta</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${act.bg} ${act.text}`}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${act.dot}`} />
                        {act.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-muted`}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${pres.color}`} />
                        {pres.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="flex flex-col items-center">
                    <MiniRing value={c.ligacoes_hoje} max={c.meta_ligacoes} color={ligPct >= 80 ? "hsl(142, 72%, 42%)" : ligPct >= 40 ? "hsl(45, 90%, 50%)" : "hsl(var(--destructive))"} />
                    <span className="text-[9px] text-muted-foreground mt-1">Lig ({c.meta_ligacoes})</span>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-emerald-600">{c.aproveitados_hoje}</p>
                    <span className="text-[9px] text-muted-foreground">Aproveit.</span>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-foreground">{c.visitas_marcadas}<span className="text-muted-foreground font-normal text-xs">/{c.visitas_realizadas}</span></p>
                    <span className="text-[9px] text-muted-foreground">Vis M/R</span>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-black ${c.leads_desatualizados > 5 ? "text-destructive" : c.leads_desatualizados > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{c.leads_desatualizados}</p>
                    <span className="text-[9px] text-muted-foreground">Desatual.</span>
                  </div>
                </div>

                {/* OA info */}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                  <span>OA: {c.oa_tentativas} tentativas</span>
                </div>

                {/* Feedback */}
                <Textarea
                  placeholder="Feedback do gerente..."
                  value={c.obs_gerente}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCorretores(prev => prev.map(x => x.user_id === c.user_id ? { ...x, obs_gerente: val } : x));
                  }}
                  onBlur={() => saveObsGerente(c.user_id, c.obs_gerente)}
                  className="text-xs min-h-[36px] resize-none"
                  rows={1}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
