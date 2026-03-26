import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { todayBRT } from "@/lib/utils";
import { AlertTriangle, Phone, WifiOff, CheckCircle2, ListTodo, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  taxa: number;
  oa_tentativas: number;
  usou_foco: boolean;
  visitas_marcadas: number;
  visitas_realizadas: number;
  leads_desatualizados: number;
  followups_hoje: number;
  leads_atualizados_hoje: number;
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

const ACTIVITY_CONFIG: Record<string, { label: string; borderColor: string; dot: string; bg: string; text: string }> = {
  produzindo: { label: "Produzindo", borderColor: "border-l-emerald-500", dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600" },
  baixa: { label: "Baixa atividade", borderColor: "border-l-amber-400", dot: "bg-amber-400", bg: "bg-amber-500/10", text: "text-amber-600" },
  sem_atividade: { label: "Sem atividade", borderColor: "border-l-red-400", dot: "bg-red-400", bg: "bg-red-500/10", text: "text-red-600" },
  offline: { label: "Offline", borderColor: "border-l-gray-300", dot: "bg-gray-400", bg: "bg-gray-500/10", text: "text-gray-500" },
};

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

    const todayStart = `${today}T00:00:00-03:00`;
    const todayEnd = `${today}T23:59:59.999-03:00`;

    const [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10] = await Promise.all([
      supabase.from("team_members").select("id, nome, user_id").eq("gerente_id", user.id).eq("status", "ativo"),
      supabase.from("profiles").select("user_id, avatar_url").in("user_id", teamUserIds),
      supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado").in("corretor_id", teamUserIds).gte("created_at", todayStart).lte("created_at", todayEnd),
      supabase.from("checkpoint_diario").select("corretor_id, presenca, meta_ligacoes, obs_gerente").eq("data", today).in("corretor_id", teamUserIds),
      supabase.from("corretor_disponibilidade").select("user_id, status, na_roleta, updated_at").in("user_id", teamUserIds),
      supabase.from("visitas").select("corretor_id, status").in("corretor_id", teamUserIds).eq("data_visita", today),
      supabase.from("pipeline_leads").select("corretor_id").in("corretor_id", teamUserIds).lt("updated_at", new Date(Date.now() - 48 * 3600 * 1000).toISOString()),
      supabase.from("corretor_daily_goals").select("corretor_id, meta_ligacoes").in("corretor_id", teamUserIds).eq("data", today),
      // Follow-ups hoje: tarefas concluídas hoje
      supabase.from("pipeline_tarefas").select("responsavel_id").in("responsavel_id", teamUserIds).gte("concluida_em", todayStart).lte("concluida_em", todayEnd),
      // Leads atualizados hoje
      supabase.from("pipeline_leads").select("corretor_id").in("corretor_id", teamUserIds).gte("ultima_acao_at", todayStart).lte("ultima_acao_at", todayEnd),
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

    const followupsCount: Record<string, number> = {};
    (r9.data || []).forEach((t: any) => { if (t.responsavel_id) followupsCount[t.responsavel_id] = (followupsCount[t.responsavel_id] || 0) + 1; });

    const leadsAtualCount: Record<string, number> = {};
    (r10.data || []).forEach((l: any) => { if (l.corretor_id) leadsAtualCount[l.corretor_id] = (leadsAtualCount[l.corretor_id] || 0) + 1; });

    const total48h = Object.values(desatCount).reduce((s, v) => s + v, 0);
    setLeadsSemContato48h(total48h);

    const cards: CorretorAgora[] = members
      .filter((m: any) => m.user_id && teamUserIds.includes(m.user_id))
      .map((m: any) => {
        const uid = m.user_id;
        const cp = checkpoints[uid];
        const disp = disps[uid];
        const todayCalls = oaLig[uid] || 0;
        const todayAprov = oaAprov[uid] || 0;
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
          aproveitados_hoje: todayAprov,
          taxa: todayCalls > 0 ? Math.round((todayAprov / todayCalls) * 100) : 0,
          oa_tentativas: todayCalls,
          usou_foco: false,
          visitas_marcadas: vmCount[uid] || 0,
          visitas_realizadas: vrCount[uid] || 0,
          leads_desatualizados: desatCount[uid] || 0,
          followups_hoje: followupsCount[uid] || 0,
          leads_atualizados_hoje: leadsAtualCount[uid] || 0,
          obs_gerente: cp?.obs_gerente || "",
          activity_status: activity,
        };
      });

    cards.sort((a, b) => {
      const aOn = a.activity_status !== "offline" ? 1 : 0;
      const bOn = b.activity_status !== "offline" ? 1 : 0;
      if (aOn !== bOn) return bOn - aOn;
      return b.ligacoes_hoje - a.ligacoes_hoje;
    });

    setCorretores(cards);

    const semLig = cards.filter(c => c.ligacoes_hoje === 0 && !["ausente", "atestado", "folga"].includes(c.presenca));
    setSemLigacaoNomes(semLig.map(c => c.nome.split(" ")[0]));

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
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="h-4 w-4 text-destructive" />
                  <span className="text-xs font-bold text-destructive">Sem ligação hoje</span>
                  <Badge variant="destructive" className="text-[10px] h-4 px-1">{semLigacaoNomes.length}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{semLigacaoNomes.join(", ")}</p>
              </CardContent>
            </Card>
          )}
          {leadsSemContato48h > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">Leads sem contato +48h</span>
                  <Badge className="text-[10px] h-4 px-1 bg-amber-500">{leadsSemContato48h}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">Leads que não foram tocados há mais de 48h</p>
              </CardContent>
            </Card>
          )}
          {offlineNomes.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <WifiOff className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">Offline +2h</span>
                  <Badge className="text-[10px] h-4 px-1 bg-amber-500">{offlineNomes.length}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{offlineNomes.join(", ")}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Grid de Corretores — Compacto, 3 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {corretores.map(c => {
          const pres = PRESENCA_LABELS[c.presenca] || PRESENCA_LABELS.nao_informado;
          const act = ACTIVITY_CONFIG[c.activity_status];
          const ligPct = c.meta_ligacoes > 0 ? Math.min(100, Math.round((c.ligacoes_hoje / c.meta_ligacoes) * 100)) : 0;

          return (
            <Card key={c.user_id} className={`border-border/60 hover:shadow-md transition-shadow border-l-4 ${act.borderColor}`}>
              <CardContent className="p-3">
                {/* Topo: foto + nome + badges */}
                <div className="flex items-center gap-2 mb-2.5">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt={c.nome} className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                      {c.nome.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-foreground truncate">{c.nome.split(" ").slice(0, 2).join(" ")}</span>
                      {c.na_roleta && <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-primary/30 text-primary">Roleta</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1 py-0.5 rounded-full ${act.bg} ${act.text}`}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${act.dot}`} />
                        {act.label}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded-full bg-muted">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${pres.color}`} />
                        {pres.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Duas seções lado a lado */}
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  {/* Seção Esquerda: Oferta Ativa */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Oferta Ativa</p>
                    {/* Ligações com mini barra */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Ligações</span>
                        <span className="font-bold text-foreground">{c.ligacoes_hoje}<span className="text-muted-foreground font-normal">/{c.meta_ligacoes}</span></span>
                      </div>
                      <Progress value={ligPct} className="h-1 mt-0.5" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Aproveitados</span>
                      <span className="font-bold text-emerald-600">{c.aproveitados_hoje} <span className="text-muted-foreground font-normal">({c.taxa}%)</span></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">OA tentativas</span>
                      <span className="font-bold text-foreground">{c.oa_tentativas}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Modo foco</span>
                      <span className={c.usou_foco ? "text-emerald-600 font-bold" : "text-muted-foreground"}>
                        {c.usou_foco ? "✓" : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Seção Direita: Pipeline */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Pipeline</p>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Follow-ups</span>
                      <span className="font-bold text-foreground">{c.followups_hoje}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Atualizados</span>
                      <span className="font-bold text-foreground">{c.leads_atualizados_hoje}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Desatualizados</span>
                      <span className={`font-bold ${c.leads_desatualizados > 0 ? "text-destructive" : "text-muted-foreground"}`}>{c.leads_desatualizados}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Visitas</span>
                      <span className="font-bold text-foreground">{c.visitas_marcadas}<span className="text-muted-foreground font-normal">/{c.visitas_realizadas}</span></span>
                    </div>
                  </div>
                </div>

                {/* Rodapé: Feedback */}
                <div className="mt-2.5">
                  <Textarea
                    placeholder="Feedback do gerente..."
                    value={c.obs_gerente}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCorretores(prev => prev.map(x => x.user_id === c.user_id ? { ...x, obs_gerente: val } : x));
                    }}
                    onBlur={() => saveObsGerente(c.user_id, c.obs_gerente)}
                    className="text-[11px] min-h-[28px] resize-none py-1.5 px-2"
                    rows={1}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
