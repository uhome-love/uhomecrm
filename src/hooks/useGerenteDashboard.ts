import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { todayBRT } from "@/lib/utils";

export type Period = "dia" | "semana" | "mes";
export const periodLabels: Record<Period, string> = { dia: "Hoje", semana: "Esta Semana", mes: "Este Mês" };

function getPeriodRange(period: Period) {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  if (period === "dia") return { start: todayStr, end: todayStr, startTs: `${todayStr}T00:00:00-03:00`, endTs: `${todayStr}T23:59:59.999-03:00` };
  if (period === "semana") {
    const s = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const e = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    return { start: s, end: e, startTs: `${s}T00:00:00-03:00`, endTs: `${e}T23:59:59.999-03:00` };
  }
  const s = format(startOfMonth(now), "yyyy-MM-dd");
  const e = format(endOfMonth(now), "yyyy-MM-dd");
  return { start: s, end: e, startTs: `${s}T00:00:00-03:00`, endTs: `${e}T23:59:59.999-03:00` };
}

export function formatCurrency(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

export function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
}

export function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h = ((hash % 360) + 360) % 360;
  return `hsl(${h}, 55%, 50%)`;
}

export interface CorretorRow {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  avatar_gamificado_url: string | null;
  ligacoes: number;
  aproveitados: number;
  taxa: number;
  visitas: number;
  negocios: number;
  pontos: number;
  status: "online" | "paused" | "offline";
  activityStatus: "produzindo" | "baixa" | "sem_atividade" | "offline";
}

export interface RadarAlert {
  id: string;
  type: "danger" | "warning" | "info";
  icon: string;
  label: string;
  count: number;
  route: string;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  pct: number;
}

export interface NegocioAcao {
  id: string;
  nome_cliente: string;
  empreendimento: string;
  vgv: number;
  fase: string;
  corretor_nome: string;
  dias_parado: number;
  updated_at: string;
  unidade: string;
  proposta_valor: number;
}

export interface VisitaHoje {
  id: string;
  nome_cliente: string;
  empreendimento: string;
  hora_visita: string;
  status: string;
  corretor_id: string;
  corretor_nome?: string;
}

export interface OAResumo {
  leadsDisponiveis: number;
  tentativasHoje: number;
  aproveitados: number;
  taxa: number;
  corretoresAtivos: number;
  corretoresParados: number;
  tempoMedioMinutos: number;
  taxaPorCorretor: { nome: string; taxa: number }[];
}

export interface AlertaOp {
  icon: string;
  msg: string;
  count: number;
  route: string;
}

export interface NegocioQuente {
  id: string;
  nome_cliente: string;
  empreendimento: string;
  vgv: number;
  fase: string;
  corretor_nome: string;
  updated_at: string;
  horas_desde_update: number;
  unidade: string;
  proposta_valor: number;
}

const FASE_PRIORITY: Record<string, number> = { assinado: 6, documentacao: 5, negociacao: 4, proposta: 3, gerado: 2, visita: 1 };

export function useGerenteDashboard(period: Period) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ nome?: string; avatar_url?: string; avatar_gamificado_url?: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome, avatar_url, avatar_gamificado_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  const { start, end, startTs, endTs } = useMemo(() => getPeriodRange(period), [period]);
  const today = todayBRT();

  // ── Team members ──
  const { data: teamMembers } = useQuery({
    queryKey: ["gerente-team-v2", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id, user_id, nome, equipe, status").eq("gerente_id", user!.id).eq("status", "ativo");
      return data || [];
    },
    enabled: !!user,
  });

  const teamUserIds = useMemo(() => (teamMembers || []).map(t => t.user_id).filter(Boolean) as string[], [teamMembers]);
  const teamNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (teamMembers || []).forEach(m => { if (m.user_id) map[m.user_id] = m.nome; });
    return map;
  }, [teamMembers]);

  // ── KPIs ──
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["gerente-kpis-v2", user?.id, period, teamUserIds.join(",")],
    queryFn: async () => {
      if (teamUserIds.length === 0) return { ligacoes: 0, metaTime: 0, aproveitados: 0, taxa: 0, visitasHoje: 0, visitasSemana: 0, visitasMarcadas: 0, visitasRealizadas: 0, totalLeads: 0, negociosAtivos: 0, vgvTotal: 0, melhorStreak: { nome: "-", count: 0 } };

      const [{ count: ligacoes }, { count: aproveitados }, { count: visitasHoje }, { count: visitasSemana }, { count: visitasMarcadas }, { count: visitasRealizadas }, { count: totalLeads }] = await Promise.all([
        supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).gte("created_at", startTs).lte("created_at", endTs),
        supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).eq("resultado", "com_interesse").gte("created_at", startTs).lte("created_at", endTs),
        supabase.from("visitas").select("id", { count: "exact", head: true }).eq("gerente_id", user!.id).eq("data_visita", today),
        supabase.from("visitas").select("id", { count: "exact", head: true }).eq("gerente_id", user!.id).gte("data_visita", format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")).lte("data_visita", format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")),
        supabase.from("visitas").select("id", { count: "exact", head: true }).eq("gerente_id", user!.id).gte("data_visita", start).lte("data_visita", end),
        supabase.from("visitas").select("id", { count: "exact", head: true }).eq("gerente_id", user!.id).eq("status", "realizada").gte("data_visita", start).lte("data_visita", end),
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds),
      ]);

      const { data: negocios } = await supabase.from("negocios").select("fase, vgv_estimado").eq("gerente_id", user!.id).not("fase", "in", '("perdido","cancelado","distrato")');
      const negociosAtivos = negocios?.length || 0;
      const vgvTotal = (negocios || []).reduce((s, n) => s + Number(n.vgv_estimado || 0), 0);
      const lig = ligacoes || 0;
      const apr = aproveitados || 0;
      const metaPorCorretor = period === "dia" ? 30 : period === "semana" ? 150 : 600;
      const metaTime = teamUserIds.length * metaPorCorretor;

      const { data: streakData } = await supabase.from("oferta_ativa_tentativas").select("corretor_id").in("corretor_id", teamUserIds).gte("created_at", startTs).lte("created_at", endTs);
      const streakCounts: Record<string, number> = {};
      (streakData || []).forEach(s => { streakCounts[s.corretor_id] = (streakCounts[s.corretor_id] || 0) + 1; });
      const topStreakId = Object.entries(streakCounts).sort((a, b) => b[1] - a[1])[0];

      return {
        ligacoes: lig, metaTime, aproveitados: apr, taxa: lig > 0 ? Math.round((apr / lig) * 100) : 0,
        visitasHoje: visitasHoje || 0, visitasSemana: visitasSemana || 0,
        visitasMarcadas: visitasMarcadas || 0, visitasRealizadas: visitasRealizadas || 0,
        totalLeads: totalLeads || 0,
        negociosAtivos, vgvTotal,
        melhorStreak: topStreakId ? { nome: teamNameMap[topStreakId[0]]?.split(" ")[0] || "Corretor", count: topStreakId[1] } : { nome: "-", count: 0 },
      };
    },
    enabled: !!user && teamUserIds.length > 0,
    staleTime: 30_000,
  });

  // ── Ranking ──
  const { data: ranking } = useQuery({
    queryKey: ["gerente-ranking-v2", user?.id, period, teamUserIds.join(",")],
    queryFn: async () => {
      if (teamUserIds.length === 0) return [];
      const [{ data: profiles }, { data: tentativas }, { data: visitas }, { data: disps }, { data: negociosData }] = await Promise.all([
        supabase.from("profiles").select("user_id, nome, avatar_url, avatar_gamificado_url").in("user_id", teamUserIds),
        supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado, pontos").in("corretor_id", teamUserIds).gte("created_at", startTs).lte("created_at", endTs),
        supabase.from("visitas").select("corretor_id").eq("gerente_id", user!.id).gte("data_visita", start).lte("data_visita", end),
        supabase.from("corretor_disponibilidade").select("user_id, status").in("user_id", teamUserIds),
        supabase.from("negocios").select("corretor_id").eq("gerente_id", user!.id).not("fase", "in", '("perdido","cancelado","distrato")'),
      ]);

      // Also get today's calls for activity status
      const todayStr = todayBRT();
      const { data: todayCalls } = await supabase.from("oferta_ativa_tentativas").select("corretor_id").in("corretor_id", teamUserIds).gte("created_at", `${todayStr}T00:00:00`).lte("created_at", `${todayStr}T23:59:59`);
      const todayCallCounts: Record<string, number> = {};
      (todayCalls || []).forEach(t => { todayCallCounts[t.corretor_id] = (todayCallCounts[t.corretor_id] || 0) + 1; });

      const { data: todayVisitas } = await supabase.from("visitas").select("corretor_id").eq("gerente_id", user!.id).eq("data_visita", todayStr).eq("status", "realizada");
      const todayVisitSet = new Set((todayVisitas || []).map(v => v.corretor_id).filter(Boolean));

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
      const dispMap = Object.fromEntries((disps || []).map(d => [d.user_id, d.status]));

      const stats: Record<string, { lig: number; apr: number; pts: number; vis: number; neg: number }> = {};
      teamUserIds.forEach(id => { stats[id] = { lig: 0, apr: 0, pts: 0, vis: 0, neg: 0 }; });
      (tentativas || []).forEach(t => { if (stats[t.corretor_id]) { stats[t.corretor_id].lig++; if (t.resultado === "com_interesse") stats[t.corretor_id].apr++; stats[t.corretor_id].pts += t.pontos || 0; } });
      (visitas || []).forEach(v => { if (v.corretor_id && stats[v.corretor_id]) stats[v.corretor_id].vis++; });
      (negociosData || []).forEach(n => { if (n.corretor_id && stats[n.corretor_id]) stats[n.corretor_id].neg++; });

      const rows: CorretorRow[] = teamUserIds.map(uid => {
        const p = profileMap[uid];
        const s = stats[uid];
        const disp = dispMap[uid];
        const todayCalls = todayCallCounts[uid] || 0;
        const hasVisit = todayVisitSet.has(uid);

        let activityStatus: CorretorRow["activityStatus"] = "offline";
        if (disp === "disponivel" || disp === "pausa") {
          if (todayCalls >= 10 || hasVisit) activityStatus = "produzindo";
          else if (todayCalls >= 1) activityStatus = "baixa";
          else activityStatus = "sem_atividade";
        }

        return {
          user_id: uid,
          nome: p?.nome || teamMembers?.find(t => t.user_id === uid)?.nome || "Corretor",
          avatar_url: p?.avatar_url || null,
          avatar_gamificado_url: (p as any)?.avatar_gamificado_url || null,
          ligacoes: s.lig, aproveitados: s.apr, taxa: s.lig > 0 ? Math.round((s.apr / s.lig) * 100) : 0,
          visitas: s.vis, negocios: s.neg, pontos: s.pts,
          status: disp === "disponivel" ? "online" : disp === "pausa" ? "paused" : "offline",
          activityStatus,
        };
      });
      return rows.sort((a, b) => b.pontos - a.pontos);
    },
    enabled: !!user && teamUserIds.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // ── Radar Alerts ──
  const { data: radarAlerts } = useQuery({
    queryKey: ["gerente-radar-v2", user?.id, teamUserIds.join(",")],
    queryFn: async () => {
      if (teamUserIds.length === 0) return [];
      const now = new Date();
      const alerts: RadarAlert[] = [];

      const { data: stages } = await supabase.from("pipeline_stages").select("id, tipo").eq("ativo", true).eq("pipeline_tipo", "leads").in("tipo", ["novo_lead", "sem_contato"]);
      const stageIds = (stages || []).map(s => s.id);
      if (stageIds.length > 0) {
        const cutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
        const { count } = await supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).in("stage_id", stageIds).lt("created_at", cutoff);
        if ((count || 0) > 0) alerts.push({ id: "leads_sem_contato", type: "danger", icon: "🔴", label: "leads sem contato", count: count || 0, route: "/pipeline-leads" });
      }

      const cutoff48h = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();
      const { count: negParados } = await supabase.from("negocios").select("id", { count: "exact", head: true }).eq("gerente_id", user!.id).not("fase", "in", '("perdido","cancelado","distrato","assinado","vendido")').lt("updated_at", cutoff48h);
      if ((negParados || 0) > 0) alerts.push({ id: "negocios_parados", type: "warning", icon: "💼", label: "negócios sem atualização >48h", count: negParados || 0, route: "/pipeline-negocios" });

      const { data: tentHoje } = await supabase.from("oferta_ativa_tentativas").select("corretor_id").in("corretor_id", teamUserIds).gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`);
      const comLigacao = new Set((tentHoje || []).map(t => t.corretor_id));
      const semLigacao = teamUserIds.filter(id => !comLigacao.has(id)).length;
      if (semLigacao > 0) alerts.push({ id: "sem_ligacao", type: "warning", icon: "🚫", label: "corretores sem ligação hoje", count: semLigacao, route: "/central-do-gerente" });

      const { count: visitasPendentes } = await supabase.from("visitas").select("id", { count: "exact", head: true }).eq("gerente_id", user!.id).eq("data_visita", today).eq("status", "marcada");
      if ((visitasPendentes || 0) > 0) alerts.push({ id: "visitas_pendentes", type: "info", icon: "📅", label: "visitas pendentes de status", count: visitasPendentes || 0, route: "/agenda-visitas" });

      // Leads sem tarefa
      const { count: leadsSemTarefa } = await supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).is("prioridade_lead", null);
      if ((leadsSemTarefa || 0) > 0) alerts.push({ id: "leads_sem_tarefa", type: "info", icon: "📝", label: "leads sem tarefa", count: leadsSemTarefa || 0, route: "/pipeline-leads" });

      return alerts;
    },
    enabled: !!user && teamUserIds.length > 0,
    staleTime: 60_000,
  });

  // ── Funil Comercial ──
  const { data: funnel } = useQuery({
    queryKey: ["gerente-funnel-v2", user?.id, teamUserIds.join(",")],
    queryFn: async () => {
      if (teamUserIds.length === 0) return [];
      const { data: stages } = await supabase.from("pipeline_stages").select("id, tipo, nome, ordem").eq("ativo", true).eq("pipeline_tipo", "leads").order("ordem");
      const { data: leads } = await supabase.from("pipeline_leads").select("stage_id").in("corretor_id", teamUserIds);
      const { data: negocios } = await supabase.from("negocios").select("fase").eq("gerente_id", user!.id).not("fase", "in", '("perdido","cancelado","distrato")');

      const stageCounts: Record<string, number> = {};
      (leads || []).forEach(l => { stageCounts[l.stage_id] = (stageCounts[l.stage_id] || 0) + 1; });

      const funnelStages: FunnelStage[] = (stages || [])
        .filter(s => s.tipo !== "descarte" && s.tipo !== "convertido")
        .map(s => ({ key: s.tipo, label: s.nome, count: stageCounts[s.id] || 0, pct: 0 }));

      const negFases = ["proposta", "negociacao", "assinado"];
      const negCounts: Record<string, number> = {};
      (negocios || []).forEach(n => { negCounts[n.fase] = (negCounts[n.fase] || 0) + 1; });
      funnelStages.push({ key: "negocio", label: "Negócio", count: Object.values(negCounts).reduce((a, b) => a + b, 0), pct: 0 });
      funnelStages.push({ key: "proposta", label: "Proposta", count: negCounts["proposta"] || 0, pct: 0 });
      funnelStages.push({ key: "assinado", label: "Assinado", count: (negCounts["assinado"] || 0) + (negCounts["vendido"] || 0), pct: 0 });

      for (let i = 1; i < funnelStages.length; i++) {
        funnelStages[i].pct = funnelStages[i - 1].count > 0 ? Math.round((funnelStages[i].count / funnelStages[i - 1].count) * 100) : 0;
      }
      if (funnelStages.length > 0) funnelStages[0].pct = 100;

      return funnelStages;
    },
    enabled: !!user && teamUserIds.length > 0,
    staleTime: 60_000,
  });

  // ── Negócios que pedem ação ──
  const { data: negociosAcao } = useQuery({
    queryKey: ["gerente-negocios-acao-v2", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("negocios").select("id, nome_cliente, empreendimento, vgv_estimado, fase, corretor_id, updated_at, unidade, proposta_valor").eq("gerente_id", user!.id).not("fase", "in", '("perdido","cancelado","distrato","assinado","vendido")').order("updated_at", { ascending: true }).limit(5);
      if (!data) return [];
      const corrIds = [...new Set(data.map(n => n.corretor_id).filter(Boolean))];
      const { data: profs } = corrIds.length > 0 ? await supabase.from("profiles").select("user_id, nome").in("user_id", corrIds as string[]) : { data: [] };
      const nameMap = Object.fromEntries((profs || []).map(p => [p.user_id, p.nome]));

      return data.map(n => {
        const dias = Math.floor((Date.now() - new Date(n.updated_at).getTime()) / 86400000);
        return {
          id: n.id, nome_cliente: n.nome_cliente || "Cliente", empreendimento: n.empreendimento || "—",
          vgv: Number(n.vgv_estimado || 0), fase: n.fase,
          corretor_nome: n.corretor_id ? (nameMap[n.corretor_id] || "Corretor") : "—",
          dias_parado: dias, updated_at: n.updated_at,
          unidade: n.unidade || "", proposta_valor: Number(n.proposta_valor || 0),
        } as NegocioAcao;
      });
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // ── Negócios Quentes (mais avançados) ──
  const { data: negociosQuentes } = useQuery({
    queryKey: ["gerente-negocios-quentes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("negocios").select("id, nome_cliente, empreendimento, vgv_estimado, fase, corretor_id, updated_at, unidade, proposta_valor").eq("gerente_id", user!.id).not("fase", "in", '("perdido","cancelado","distrato","assinado","vendido")');
      if (!data || data.length === 0) return [];
      const corrIds = [...new Set(data.map(n => n.corretor_id).filter(Boolean))];
      const { data: profs } = corrIds.length > 0 ? await supabase.from("profiles").select("user_id, nome").in("user_id", corrIds as string[]) : { data: [] };
      const nameMap = Object.fromEntries((profs || []).map(p => [p.user_id, p.nome]));

      return data
        .map(n => ({
          id: n.id, nome_cliente: n.nome_cliente || "Cliente", empreendimento: n.empreendimento || "—",
          vgv: Number(n.vgv_estimado || 0), fase: n.fase,
          corretor_nome: n.corretor_id ? (nameMap[n.corretor_id] || "Corretor") : "—",
          updated_at: n.updated_at,
          horas_desde_update: Math.round((Date.now() - new Date(n.updated_at).getTime()) / 3600000),
          unidade: n.unidade || "", proposta_valor: Number(n.proposta_valor || 0),
        }))
        .sort((a, b) => {
          const pA = FASE_PRIORITY[a.fase] || 0;
          const pB = FASE_PRIORITY[b.fase] || 0;
          if (pB !== pA) return pB - pA;
          if (b.vgv !== a.vgv) return b.vgv - a.vgv;
          return a.horas_desde_update - b.horas_desde_update;
        })
        .slice(0, 5) as NegocioQuente[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // ── Agenda de Hoje ──
  const { data: agendaHoje } = useQuery({
    queryKey: ["gerente-agenda-v2", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("visitas").select("id, nome_cliente, empreendimento, hora_visita, status, corretor_id").eq("gerente_id", user!.id).eq("data_visita", today).order("hora_visita");
      return (data || []).map(v => ({ ...v, corretor_nome: teamNameMap[v.corretor_id || ""]?.split(" ")[0] })) as VisitaHoje[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // ── Resumo Oferta Ativa ──
  const { data: oaResumo } = useQuery({
    queryKey: ["gerente-oa-v2", user?.id, teamUserIds.join(",")],
    queryFn: async () => {
      if (teamUserIds.length === 0) return { leadsDisponiveis: 0, tentativasHoje: 0, aproveitados: 0, taxa: 0, corretoresAtivos: 0, corretoresParados: 0, tempoMedioMinutos: 0, taxaPorCorretor: [] } as OAResumo;

      const [{ count: totalLeads }, { data: tentHojeData }] = await Promise.all([
        supabase.from("oferta_ativa_leads").select("id", { count: "exact", head: true }).eq("status", "disponivel"),
        supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado, created_at").in("corretor_id", teamUserIds).gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`),
      ]);

      const tentHoje = tentHojeData || [];
      const aprHoje = tentHoje.filter(t => t.resultado === "com_interesse").length;

      // Tempo médio entre tentativas (proxy para tempo de resposta)
      const corrTimestamps: Record<string, number[]> = {};
      tentHoje.forEach(t => {
        if (!corrTimestamps[t.corretor_id]) corrTimestamps[t.corretor_id] = [];
        corrTimestamps[t.corretor_id].push(new Date(t.created_at).getTime());
      });
      let totalIntervals = 0; let intervalCount = 0;
      Object.values(corrTimestamps).forEach(ts => {
        ts.sort((a, b) => a - b);
        for (let i = 1; i < ts.length; i++) {
          totalIntervals += ts[i] - ts[i - 1];
          intervalCount++;
        }
      });
      const tempoMedioMinutos = intervalCount > 0 ? Math.round(totalIntervals / intervalCount / 60000) : 0;

      // Taxa por corretor
      const corrStats: Record<string, { lig: number; apr: number }> = {};
      tentHoje.forEach(t => {
        if (!corrStats[t.corretor_id]) corrStats[t.corretor_id] = { lig: 0, apr: 0 };
        corrStats[t.corretor_id].lig++;
        if (t.resultado === "com_interesse") corrStats[t.corretor_id].apr++;
      });
      const taxaPorCorretor = Object.entries(corrStats)
        .map(([id, s]) => ({ nome: teamNameMap[id]?.split(" ")[0] || "Corretor", taxa: s.lig > 0 ? Math.round((s.apr / s.lig) * 100) : 0 }))
        .sort((a, b) => b.taxa - a.taxa)
        .slice(0, 5);

      const { data: disps } = await supabase.from("corretor_disponibilidade").select("user_id, status, updated_at").in("user_id", teamUserIds);
      const ativos = (disps || []).filter(d => d.status === "disponivel").length;
      const parados = (disps || []).filter(d => {
        if (d.status !== "disponivel") return false;
        const mins = (Date.now() - new Date(d.updated_at).getTime()) / 60000;
        return mins > 20;
      }).length;

      const t = tentHoje.length;
      return { leadsDisponiveis: totalLeads || 0, tentativasHoje: t, aproveitados: aprHoje, taxa: t > 0 ? Math.round((aprHoje / t) * 100) : 0, corretoresAtivos: ativos, corretoresParados: parados, tempoMedioMinutos, taxaPorCorretor } as OAResumo;
    },
    enabled: !!user && teamUserIds.length > 0,
    staleTime: 30_000,
  });

  // ── Alertas operacionais ──
  const alertasOp = useMemo<AlertaOp[]>(() => {
    const alerts: AlertaOp[] = [];
    const radar = radarAlerts || [];
    radar.forEach(r => {
      alerts.push({ icon: r.icon, msg: `${r.count} ${r.label}`, count: r.count, route: r.route });
    });
    return alerts;
  }, [radarAlerts]);

  return {
    user, profile, teamUserIds, teamNameMap, teamMembers,
    kpis: kpis || { ligacoes: 0, metaTime: 0, aproveitados: 0, taxa: 0, visitasHoje: 0, visitasSemana: 0, negociosAtivos: 0, vgvTotal: 0, melhorStreak: { nome: "-", count: 0 } },
    kpisLoading,
    ranking: ranking || [],
    radarAlerts: radarAlerts || [],
    funnel: funnel || [],
    negociosAcao: negociosAcao || [],
    negociosQuentes: negociosQuentes || [],
    agendaHoje: agendaHoje || [],
    oaResumo: oaResumo || { leadsDisponiveis: 0, tentativasHoje: 0, aproveitados: 0, taxa: 0, corretoresAtivos: 0, corretoresParados: 0, tempoMedioMinutos: 0, taxaPorCorretor: [] },
    alertasOp,
    today, start, end, startTs, endTs,
  };
}
