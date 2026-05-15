import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { todayBRT } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface CorretorAgora {
  user_id: string;
  team_member_id: string | null;
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
  leads_recebidos_hoje: number;
  obs_gerente: string;
  activity_status: "produzindo" | "baixa" | "sem_atividade" | "offline";
  pontos_atividade: number;
}

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
}

const PRESENCA_LABELS: Record<string, { label: string; color: string }> = {
  sim: { label: "Presente", color: "bg-emerald-500" },
  presente: { label: "Presente", color: "bg-emerald-500" },
  meio_periodo: { label: "½ Período", color: "bg-amber-500" },
  nao: { label: "Ausente", color: "bg-destructive" },
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

function calcPontos(c: { ligacoes_hoje: number; leads_atualizados_hoje: number; followups_hoje: number; visitas_marcadas: number; visitas_realizadas: number }) {
  return c.ligacoes_hoje * 1 + c.leads_atualizados_hoje * 1 + c.followups_hoje * 2 + c.visitas_marcadas * 3 + c.visitas_realizadas * 5;
}

function calcActivityStatus(isOnline: boolean, pontos: number): CorretorAgora["activity_status"] {
  if (!isOnline) return "offline";
  if (pontos >= 10) return "produzindo";
  if (pontos >= 1) return "baixa";
  return "sem_atividade";
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

    const todayStart = `${today}T00:00:00-03:00`;
    const todayEnd = `${today}T23:59:59.999-03:00`;

    const { data: teamMembersData } = await supabase
      .from("team_members")
      .select("id, nome, user_id")
      .eq("gerente_id", user.id)
      .eq("status", "ativo");

    const members = teamMembersData || [];
    const tmIdToUserId: Record<string, string> = {};
    const userIdToTmId: Record<string, string> = {};
    members.forEach(m => {
      if (m.user_id) {
        tmIdToUserId[m.id] = m.user_id;
        userIdToTmId[m.user_id] = m.id;
      }
    });
    const tmIds = members.map(m => m.id);

    const [r2, r3, r5, r6, r8, rLeadsAll, rFollowupLeads, rCheckpoint, rLeadsRecebidos, rTarefasAtrasadas, rTarefasExistentes, rTarefasConcluidas] = await Promise.all([
      supabase.from("profiles").select("user_id, avatar_url").in("user_id", teamUserIds),
      supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado").in("corretor_id", teamUserIds).gte("created_at", todayStart).lte("created_at", todayEnd),
      supabase.from("corretor_disponibilidade").select("user_id, status, na_roleta, updated_at").in("user_id", teamUserIds),
      supabase.from("visitas").select("corretor_id, status").in("corretor_id", teamUserIds).eq("data_visita", today),
      supabase.from("corretor_daily_goals").select("corretor_id, meta_ligacoes").in("corretor_id", teamUserIds).eq("data", today),
      supabase.from("pipeline_leads").select("id, corretor_id").in("corretor_id", teamUserIds).eq("arquivado", false),
      // Leads atualizados hoje (ultima_acao_at)
      supabase.from("pipeline_leads").select("id, corretor_id").in("corretor_id", teamUserIds).gte("ultima_acao_at", todayStart).lte("ultima_acao_at", todayEnd),
      tmIds.length > 0
        ? supabase.from("checkpoints").select("id").eq("gerente_id", user.id).eq("data", today).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("distribuicao_historico").select("corretor_id").in("corretor_id", teamUserIds).eq("acao", "aceito").gte("created_at", todayStart).lte("created_at", todayEnd),
      supabase.from("pipeline_tarefas").select("pipeline_lead_id").in("responsavel_id", teamUserIds).eq("status", "pendente").lt("data_vencimento", today),
      supabase.from("pipeline_tarefas").select("pipeline_lead_id").in("responsavel_id", teamUserIds),
      // Follow-ups = tarefas concluídas hoje
      supabase.from("pipeline_tarefas").select("responsavel_id").in("responsavel_id", teamUserIds).gte("concluida_em", todayStart).lte("concluida_em", todayEnd),
    ]);

    let presencaMap: Record<string, string> = {};
    if (rCheckpoint.data?.id && tmIds.length > 0) {
      const { data: lines } = await supabase
        .from("checkpoint_lines")
        .select("corretor_id, meta_presenca, real_presenca")
        .eq("checkpoint_id", rCheckpoint.data.id)
        .in("corretor_id", tmIds);
      (lines || []).forEach(l => {
        const uid = tmIdToUserId[l.corretor_id];
        if (uid) {
          presencaMap[uid] = l.real_presenca || l.meta_presenca || "nao_informado";
        }
      });
    }

    const profiles: Record<string, any> = {};
    (r2.data || []).forEach((p: any) => { profiles[p.user_id] = p; });

    const oaLig: Record<string, number> = {};
    const oaAprov: Record<string, number> = {};
    (r3.data || []).forEach((t: any) => {
      oaLig[t.corretor_id] = (oaLig[t.corretor_id] || 0) + 1;
      if (t.resultado === "com_interesse") oaAprov[t.corretor_id] = (oaAprov[t.corretor_id] || 0) + 1;
    });

    const disps: Record<string, any> = {};
    (r5.data || []).forEach((d: any) => { disps[d.user_id] = d; });

    // 1. Visitas: marcadas = (marcada|confirmada|reagendada), realizadas = (realizada)
    const vmCount: Record<string, number> = {};
    const vrCount: Record<string, number> = {};
    const visitasMarcadasStatuses = new Set(["marcada", "confirmada", "reagendada"]);
    (r6.data || []).forEach((v: any) => {
      if (visitasMarcadasStatuses.has(v.status)) vmCount[v.corretor_id] = (vmCount[v.corretor_id] || 0) + 1;
      if (v.status === "realizada") vrCount[v.corretor_id] = (vrCount[v.corretor_id] || 0) + 1;
    });

    // 2. Desatualizados: leads sem tarefa OU com tarefa atrasada
    const allLeads = rLeadsAll.data || [];
    const idsComTarefa = new Set((rTarefasExistentes.data || []).map((t: any) => t.pipeline_lead_id).filter(Boolean));
    const idsAtrasados = new Set((rTarefasAtrasadas.data || []).map((t: any) => t.pipeline_lead_id).filter(Boolean));
    const desatCount: Record<string, number> = {};
    allLeads.forEach((l: any) => {
      if (!idsComTarefa.has(l.id) || idsAtrasados.has(l.id)) {
        desatCount[l.corretor_id] = (desatCount[l.corretor_id] || 0) + 1;
      }
    });

    const goals: Record<string, any> = {};
    (r8.data || []).forEach((g: any) => { goals[g.corretor_id] = g; });

    // 3. Follow-ups = tarefas concluídas hoje
    const followupsCount: Record<string, number> = {};
    (rTarefasConcluidas.data || []).forEach((t: any) => {
      if (t.responsavel_id) followupsCount[t.responsavel_id] = (followupsCount[t.responsavel_id] || 0) + 1;
    });

    // Atualizados = leads únicos com ultima_acao_at hoje
    const leadsAtualCount: Record<string, number> = {};
    (rFollowupLeads.data || []).forEach((l: any) => {
      if (l.corretor_id) leadsAtualCount[l.corretor_id] = (leadsAtualCount[l.corretor_id] || 0) + 1;
    });

    const leadsRecebidosCount: Record<string, number> = {};
    (rLeadsRecebidos.data || []).forEach((l: any) => { if (l.corretor_id) leadsRecebidosCount[l.corretor_id] = (leadsRecebidosCount[l.corretor_id] || 0) + 1; });

    const totalDesat = Object.values(desatCount).reduce((s, v) => s + v, 0);
    setLeadsSemContato48h(totalDesat);

    const cards: CorretorAgora[] = members
      .filter((m: any) => m.user_id && teamUserIds.includes(m.user_id))
      .map((m: any) => {
        const uid = m.user_id;
        const disp = disps[uid];
        const todayCalls = oaLig[uid] || 0;
        const todayAprov = oaAprov[uid] || 0;
        const isOnline = disp?.status === "online" || disp?.status === "disponivel" || disp?.status === "na_empresa" || disp?.status === "em_visita";
        const metaLig = goals[uid]?.meta_ligacoes ?? 30;
        const vm = vmCount[uid] || 0;
        const vr = vrCount[uid] || 0;
        const fu = followupsCount[uid] || 0;
        const la = leadsAtualCount[uid] || 0;

        const pontos = calcPontos({ ligacoes_hoje: todayCalls, leads_atualizados_hoje: la, followups_hoje: fu, visitas_marcadas: vm, visitas_realizadas: vr });
        const activity = calcActivityStatus(isOnline, pontos);

        return {
          user_id: uid,
          team_member_id: m.id,
          nome: m.nome,
          avatar_url: profiles[uid]?.avatar_url || null,
          presenca: presencaMap[uid] || (isOnline ? "presente" : "nao_informado"),
          na_roleta: disp?.na_roleta || false,
          ligacoes_hoje: todayCalls,
          meta_ligacoes: metaLig,
          aproveitados_hoje: todayAprov,
          taxa: todayCalls > 0 ? Math.round((todayAprov / todayCalls) * 100) : 0,
          oa_tentativas: todayCalls,
          usou_foco: false,
          visitas_marcadas: vm,
          visitas_realizadas: vr,
          leads_desatualizados: desatCount[uid] || 0,
          followups_hoje: fu,
          leads_atualizados_hoje: la,
          leads_recebidos_hoje: leadsRecebidosCount[uid] || 0,
          obs_gerente: "",
          activity_status: activity,
          pontos_atividade: pontos,
        };
      });

    cards.sort((a, b) => {
      const aOn = a.activity_status !== "offline" ? 1 : 0;
      const bOn = b.activity_status !== "offline" ? 1 : 0;
      if (aOn !== bOn) return bOn - aOn;
      return b.pontos_atividade - a.pontos_atividade;
    });

    setCorretores(cards);

    const semLig = cards.filter(c => c.ligacoes_hoje === 0 && !["nao", "ausente", "atestado", "folga"].includes(c.presenca));
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
    <div className="space-y-2">
      {/* Alertas — barra fina inline */}
      {hasAlerts && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          {semLigacaoNomes.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="hover:text-destructive transition-colors cursor-pointer inline-flex items-center gap-1">
                  <span className="text-destructive">●</span>
                  <span className="font-medium text-destructive">{semLigacaoNomes.length}</span> sem ligação hoje
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto max-w-xs p-3">
                <p className="text-xs font-semibold mb-1 text-foreground">Sem ligação hoje</p>
                <p className="text-xs text-muted-foreground">{semLigacaoNomes.join(", ")}</p>
              </PopoverContent>
            </Popover>
          )}
          {leadsSemContato48h > 0 && (
            <>
              {semLigacaoNomes.length > 0 && <span className="text-muted-foreground/40">·</span>}
              <span className="inline-flex items-center gap-1">
                <span className="text-amber-500">▲</span>
                <span className="font-medium text-amber-600">{leadsSemContato48h}</span> leads sem contato +48h
              </span>
            </>
          )}
          {offlineNomes.length > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1">
                    <span className="text-muted-foreground">●</span>
                    <span className="font-medium">{offlineNomes.length}</span> offline +2h
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto max-w-xs p-3">
                  <p className="text-xs font-semibold mb-1 text-foreground">Offline +2h</p>
                  <p className="text-xs text-muted-foreground">{offlineNomes.join(", ")}</p>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      )}

      {/* Grid de Corretores — Compacto, 3 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {corretores.map(c => {
          const pres = PRESENCA_LABELS[c.presenca] || PRESENCA_LABELS.nao_informado;
          const act = ACTIVITY_CONFIG[c.activity_status];
          const ligPct = c.meta_ligacoes > 0 ? Math.min(100, Math.round((c.ligacoes_hoje / c.meta_ligacoes) * 100)) : 0;

          return (
            <Card key={c.user_id} className={`border-border/60 hover:shadow-md transition-shadow border-l-[3px] ${act.borderColor}`}>
              <CardContent className="p-2.5">
                {/* Topo: foto + nome + badges */}
                <div className="flex items-center gap-2 mb-2">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt={c.nome} className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">
                      {c.nome.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs font-bold text-foreground truncate">{c.nome.split(" ").slice(0, 2).join(" ")}</span>
                      {c.na_roleta && <Badge variant="outline" className="text-[7px] h-3 px-0.5 border-primary/30 text-primary leading-none">Roleta</Badge>}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`inline-flex items-center gap-0.5 text-[8px] font-medium px-1 py-px rounded-full ${act.bg} ${act.text}`}>
                        <span className={`inline-block h-1 w-1 rounded-full ${act.dot}`} />
                        {act.label} · {c.pontos_atividade}pts
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[8px] px-1 py-px rounded-full bg-muted">
                        <span className={`inline-block h-1 w-1 rounded-full ${pres.color}`} />
                        {pres.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Duas seções lado a lado */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Seção Esquerda: Oferta Ativa */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Oferta Ativa</p>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-foreground/60">Ligações</span>
                        <span className="font-bold text-sm text-foreground">{c.ligacoes_hoje}<span className="text-foreground/60 font-normal">/{c.meta_ligacoes}</span></span>
                      </div>
                      <div className="w-full mt-0.5 h-[4px] rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${ligPct}%`,
                            backgroundColor: ligPct >= 80 ? "hsl(142, 72%, 42%)" : ligPct >= 40 ? "hsl(45, 90%, 50%)" : "hsl(var(--destructive))",
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/60">Aproveitados</span>
                      <span className="font-bold text-sm text-emerald-600">{c.aproveitados_hoje} <span className="text-foreground/60 font-normal">({c.taxa}%)</span></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/60">OA tent.</span>
                      <span className="font-bold text-sm text-foreground">{c.oa_tentativas}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/60">Modo foco</span>
                      <span className={c.usou_foco ? "text-emerald-600 font-bold text-sm" : "text-foreground/60 text-sm"}>
                        {c.usou_foco ? "✓" : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Seção Direita: Pipeline */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Pipeline</p>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/60">Leads Roleta</span>
                      <span className={`font-bold text-sm ${c.leads_recebidos_hoje > 0 ? "text-blue-600" : "text-muted-foreground"}`}>{c.leads_recebidos_hoje}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/60">Follow-ups</span>
                      <span className="font-bold text-sm text-foreground">{c.followups_hoje}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/60">Atualizados</span>
                      <span className="font-bold text-sm text-foreground">{c.leads_atualizados_hoje}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/60">Desatual.</span>
                      <span className={`font-bold text-sm ${c.leads_desatualizados > 0 ? "text-destructive" : "text-foreground/60"}`}>{c.leads_desatualizados}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/60">Visitas</span>
                      <span className="font-bold text-sm">
                        <span className="text-blue-600">{c.visitas_marcadas}</span>
                        <span className="text-foreground/40 font-normal">M</span>
                        <span className="text-foreground/30 mx-0.5">·</span>
                        {c.visitas_realizadas > 0 && <span className="text-emerald-600">✓</span>}
                        <span className="text-emerald-600">{c.visitas_realizadas}</span>
                        <span className="text-foreground/40 font-normal">R</span>
                      </span>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legenda de pontuação */}
      <p className="text-xs text-muted-foreground text-center pt-1">
        Índice de atividade: Ligação = 1pt · Lead atualizado = 1pt · Follow-up = 2pts · Visita marcada = 3pts · Visita realizada = 5pts · Produzindo ≥ 10pts
      </p>
    </div>
  );
}
