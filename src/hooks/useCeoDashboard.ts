import { useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import { todayBRT, dateToBRT, formatBRLCompact } from "@/lib/utils";
import { fetchKPIs as fetchOfficialKPIs } from "@/lib/metricsService";

export type DashPeriod = "hoje" | "ontem" | "semana" | "mes" | "ultimos_30d" | "custom";

function getRange(period: DashPeriod, customRange?: { start: string; end: string }) {
  if (period === "custom" && customRange) return customRange;
  const now = new Date();
  if (period === "hoje") { const t = todayBRT(); return { start: t, end: t }; }
  if (period === "ontem") { const y = dateToBRT(subDays(now, 1)); return { start: y, end: y }; }
  if (period === "semana") return { start: dateToBRT(startOfWeek(now, { weekStartsOn: 1 })), end: dateToBRT(endOfWeek(now, { weekStartsOn: 1 })) };
  if (period === "ultimos_30d") return { start: dateToBRT(subDays(now, 29)), end: todayBRT() };
  return { start: dateToBRT(startOfMonth(now)), end: dateToBRT(endOfMonth(now)) };
}

function getPrevRange(period: DashPeriod) {
  const now = new Date();
  if (period === "hoje") { const d = subDays(now, 1); return { start: format(d, "yyyy-MM-dd"), end: format(d, "yyyy-MM-dd") }; }
  if (period === "semana") { const d = subWeeks(now, 1); return { start: format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"), end: format(endOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd") }; }
  const d = subMonths(now, 1);
  return { start: format(startOfMonth(d), "yyyy-MM-dd"), end: format(endOfMonth(d), "yyyy-MM-dd") };
}

export interface KPIs {
  ligacoes: number; aproveitados: number; taxaConversao: number;
  visitasMarcadas: number; visitasRealizadas: number; taxaRealizacao: number;
  vgvGerado: number; vgvAssinado: number; propostas: number; negociosPerdidos: number;
  noShows: number;
}

export interface PipelineStageData {
  id: string; nome: string; tipo: string; count: number; ordem: number;
}

export interface CampanhaData {
  empreendimento: string; leads: number; avancou: number; parados: number; pctAvancou: number; pctParados: number;
}

export interface AlertaGargalo {
  tipo: "red" | "yellow" | "green"; mensagem: string; link?: string;
}

export interface NegocioFase {
  fase: string; count: number; vgv: number;
}

export interface TeamData {
  gerente_id: string; gerente_nome: string;
  ligacoes: number; aproveitados: number; taxa: number;
  visitasMarcadas: number; visitasRealizadas: number; propostas: number; vgv: number;
}

export interface CorretorRankData {
  corretor_id: string; nome: string; gerente_nome: string;
  ligacoes: number; aproveitados: number; taxa: number;
  visitasMarcadas: number; visitasRealizadas: number; propostas: number; vgv: number;
}

export interface OrigemData {
  origem: string; count: number;
}

// ── KPI fetcher — MIGRATED to official metrics layer ──
async function fetchKPIs(r: { start: string; end: string }): Promise<KPIs> {
  const allKPIs = await fetchOfficialKPIs(r);

  // Aggregate across all corretores (CEO sees company-wide)
  const lig = allKPIs.reduce((s, k) => s + k.total_ligacoes, 0);
  const aprov = allKPIs.reduce((s, k) => s + k.total_aproveitados, 0);
  const visitasMarcadas = allKPIs.reduce((s, k) => s + k.visitas_marcadas, 0);
  const visitasRealizadas = allKPIs.reduce((s, k) => s + k.visitas_realizadas, 0);
  const noShows = allKPIs.reduce((s, k) => s + k.visitas_no_show, 0);
  const vgvGerado = allKPIs.reduce((s, k) => s + k.vgv_gerado, 0);
  const vgvAssinado = allKPIs.reduce((s, k) => s + k.vgv_assinado, 0);
  const propostas = allKPIs.reduce((s, k) => s + k.propostas, 0);
  const vendas = allKPIs.reduce((s, k) => s + k.vendas, 0);
  const perdidosUnicos = allKPIs.reduce((s, k) => s + k.perdidos_unicos, 0);

  return {
    ligacoes: lig, aproveitados: aprov, taxaConversao: lig > 0 ? Math.round((aprov / lig) * 100) : 0,
    visitasMarcadas, visitasRealizadas, taxaRealizacao: visitasMarcadas > 0 ? Math.round((visitasRealizadas / visitasMarcadas) * 100) : 0,
    vgvGerado, vgvAssinado, propostas, negociosPerdidos: perdidosUnicos, noShows,
  };
}

const EMPTY_KPIS: KPIs = { ligacoes: 0, aproveitados: 0, taxaConversao: 0, visitasMarcadas: 0, visitasRealizadas: 0, taxaRealizacao: 0, vgvGerado: 0, vgvAssinado: 0, propostas: 0, negociosPerdidos: 0, noShows: 0 };

export function useCeoDashboard(period: DashPeriod, customRange?: { start: string; end: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const range = useMemo(() => getRange(period, customRange), [period, customRange]);
  const prevRange = useMemo(() => getPrevRange(period), [period]);
  const hoje = todayBRT();

  // Stable range key to avoid unnecessary refetches
  const rangeKey = `${range.start}_${range.end}`;
  const prevRangeKey = `${prevRange.start}_${prevRange.end}`;

  // ── Profile ──
  const { data: profile } = useQuery({
    queryKey: ["ceo-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("nome, avatar_gamificado_url, avatar_url").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
    staleTime: 300_000,
    placeholderData: keepPreviousData,
  });

  // ── Roleta ──
  const { data: roletaPendentes = [], refetch: reloadRoleta } = useQuery({
    queryKey: ["ceo-roleta", hoje],
    queryFn: async () => {
      const { data: creds } = await supabase.from("roleta_credenciamentos").select("*").eq("data", hoje).eq("status", "pendente").order("created_at");
      if (!creds?.length) return [];
      const ids = [...new Set(creds.map(c => c.corretor_id).filter(Boolean))] as string[];
      const [{ data: profs }, { data: segs }] = await Promise.all([
        supabase.from("profiles").select("id, nome, avatar_gamificado_url").in("id", ids),
        supabase.from("roleta_segmentos").select("id, nome"),
      ]);
      const pm = new Map((profs as any[])?.map((p: any) => [p.id, p]) || []);
      const sm = new Map((segs as any[])?.map((s: any) => [s.id, s.nome]) || []);
      return creds.map(c => ({
        ...c,
        corretor_nome: c.corretor_id ? pm.get(c.corretor_id)?.nome || "Corretor" : "Corretor",
        avatar: c.corretor_id ? pm.get(c.corretor_id)?.avatar_gamificado_url : null,
        seg1_nome: c.segmento_1_id ? sm.get(c.segmento_1_id) || "—" : "—",
        seg2_nome: c.segmento_2_id ? sm.get(c.segmento_2_id) || "—" : null,
      }));
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });

  // ── KPIs (current period) ──
  const { data: kpis = EMPTY_KPIS, isFetching: kpisFetching, isLoading: kpisFirstLoad } = useQuery({
    queryKey: ["ceo-kpis", rangeKey],
    queryFn: () => fetchKPIs(range),
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  // ── KPIs (previous period for comparison) ──
  const { data: prevKpis = null } = useQuery({
    queryKey: ["ceo-kpis-prev", prevRangeKey],
    queryFn: () => fetchKPIs(prevRange),
    enabled: !!user,
    staleTime: 120_000,
    placeholderData: keepPreviousData,
  });

  // ── Pipeline + Campanhas + Alertas + Origens ──
  const { data: pipelineData } = useQuery({
    queryKey: ["ceo-pipeline", user?.id, rangeKey],
    queryFn: async () => {
      const [{ data: stages }, { data: leads }] = await Promise.all([
        supabase.from("pipeline_stages").select("id, nome, tipo, ordem").eq("ativo", true).eq("pipeline_tipo", "leads").order("ordem"),
        supabase.from("pipeline_leads").select("id, stage_id, empreendimento, updated_at, created_at, origem, corretor_id")
          .gte("created_at", range.start)
          .lte("created_at", range.end + "T23:59:59")
          .limit(2000),
      ]);

      const stageData = (stages || []).map(s => ({
        id: s.id, nome: s.nome, tipo: s.tipo, ordem: s.ordem,
        count: (leads || []).filter(l => l.stage_id === s.id).length,
      }));

      const empMap = new Map<string, { leads: number; avancou: number; parados: number }>();
      const now = new Date();
      // Filter: only marketing leads (not Oferta Ativa) for empreendimento chart
      const mktLeads = (leads || []).filter(l => l.origem !== "Oferta Ativa");
      for (const l of mktLeads) {
        const emp = l.empreendimento || "Sem empreendimento";
        const curr = empMap.get(emp) || { leads: 0, avancou: 0, parados: 0 };
        curr.leads++;
        const stageOrdem = stageData.find(s => s.id === l.stage_id)?.ordem || 0;
        if (stageOrdem > 1) curr.avancou++;
        const diffDays = Math.floor((now.getTime() - new Date(l.updated_at || l.created_at).getTime()) / 86400000);
        if (diffDays > 3) curr.parados++;
        empMap.set(emp, curr);
      }

      const campanhas = Array.from(empMap.entries()).map(([emp, d]) => ({
        empreendimento: emp, leads: d.leads, avancou: d.avancou, parados: d.parados,
        pctAvancou: d.leads > 0 ? Math.round((d.avancou / d.leads) * 100) : 0,
        pctParados: d.leads > 0 ? Math.round((d.parados / d.leads) * 100) : 0,
      })).sort((a, b) => b.leads - a.leads);

      const alertas: AlertaGargalo[] = [];
      const parados7d = (leads || []).filter(l => {
        const diff = Math.floor((now.getTime() - new Date(l.updated_at || l.created_at).getTime()) / 86400000);
        return diff > 7;
      }).length;
      if (parados7d > 0) alertas.push({ tipo: "red", mensagem: `${parados7d} leads parados >7 dias sem contato`, link: "/pipeline-leads" });
      const filaCeo = (leads || []).filter(l => {
        const st = stageData.find(s => s.id === l.stage_id);
        return st?.tipo === "novo_lead";
      }).length;
      if (filaCeo > 5) alertas.push({ tipo: "yellow", mensagem: `${filaCeo} leads na Fila CEO aguardando distribuição`, link: "/pipeline-leads" });
      const bestCamp = Array.from(empMap.entries()).sort((a, b) => {
        const pA = a[1].leads > 0 ? a[1].avancou / a[1].leads : 0;
        const pB = b[1].leads > 0 ? b[1].avancou / b[1].leads : 0;
        return pB - pA;
      })[0];
      if (bestCamp && bestCamp[1].leads >= 3) alertas.push({ tipo: "green", mensagem: `Campanha ${bestCamp[0]} com melhor taxa de conversão`, link: "/pipeline-leads" });

      const origMap = new Map<string, number>();
      for (const l of mktLeads) {
        const orig = l.origem || "Desconhecido";
        origMap.set(orig, (origMap.get(orig) || 0) + 1);
      }
      const origens = Array.from(origMap.entries()).map(([origem, count]) => ({ origem, count })).sort((a, b) => b.count - a.count);
      const leadsPorEmpreendimento = Array.from(empMap.entries()).map(([emp, d]) => ({ emp, count: d.leads })).sort((a, b) => b.count - a.count).slice(0, 10);

      // Leads por corretor (only marketing, not OA)
      const corrLeadMap = new Map<string, number>();
      const corrIdSet = new Set<string>();
      for (const l of mktLeads) {
        if (l.corretor_id) {
          corrLeadMap.set(l.corretor_id, (corrLeadMap.get(l.corretor_id) || 0) + 1);
          corrIdSet.add(l.corretor_id);
        }
      }
      const corrIds = [...corrIdSet];
      let leadsPorCorretor: { nome: string; count: number }[] = [];
      if (corrIds.length > 0) {
        const { data: corrProfs } = await supabase.from("profiles").select("user_id, nome").in("user_id", corrIds);
        const nameMap = new Map((corrProfs || []).map(p => [p.user_id, p.nome || "Corretor"] as [string, string]));
        leadsPorCorretor = Array.from(corrLeadMap.entries())
          .map(([id, count]) => ({ nome: (nameMap.get(id) || "Corretor") as string, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
      }

      return { pipelineStages: stageData, campanhas, alertas, origens, leadsPorEmpreendimento, leadsPorCorretor };
    },
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  // ── Negocios ──
  const { data: negociosData } = useQuery({
    queryKey: ["ceo-negocios", user?.id, range.start, range.end],
    queryFn: async () => {
      // Fetch active negocios only (matching pipeline view)
      const { data: negocios } = await supabase
        .from("negocios")
        .select("id, fase, status, vgv_estimado, vgv_final, auth_user_id, updated_at, empreendimento, created_at, data_assinatura")
        .eq("status", "ativo")
        .limit(1000);
      const now = new Date();
      const faseMap = new Map<string, { count: number; vgv: number }>();
      let risco = 0;
      for (const n of (negocios || [])) {
        const fase = n.fase || "desconhecido";
        const curr = faseMap.get(fase) || { count: 0, vgv: 0 };
        curr.count++;
        curr.vgv += n.vgv_estimado || 0;
        faseMap.set(fase, curr);
        const diffDays = Math.floor((now.getTime() - new Date(n.updated_at || "").getTime()) / 86400000);
        if (diffDays > 15) risco += n.vgv_estimado || 0;
      }
      const negocioFases = Array.from(faseMap.entries()).map(([fase, d]) => ({ fase, ...d }));

      // MIGRATED: Top corretores by VGV using auth_user_id (canonical)
      const corrMap = new Map<string, number>();
      for (const n of (negocios || [])) {
        const uid = n.auth_user_id;
        if (!uid) continue;
        if (n.fase !== "assinado" && n.fase !== "vendido") continue;
        corrMap.set(uid, (corrMap.get(uid) || 0) + (n.vgv_final || n.vgv_estimado || 0));
      }
      const corrIds = [...corrMap.keys()];
      const { data: profs } = corrIds.length > 0 ? await supabase.from("profiles").select("user_id, nome").in("user_id", corrIds) : { data: [] as { user_id: string; nome: string }[] };
      const profMap = new Map((profs || []).map(p => [p.user_id, p.nome] as [string, string]));
      const topCorretoresVgv = Array.from(corrMap.entries()).map(([id, vgv]) => ({ nome: profMap.get(id) || "Corretor", vgv })).sort((a, b) => b.vgv - a.vgv).slice(0, 5);

      return { negocioFases, vgvEmRisco: risco, topCorretoresVgv };
    },
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  // ── Teams + Ranking ──
  const { data: teamsData } = useQuery({
    queryKey: ["ceo-teams", rangeKey],
    queryFn: async () => {
      const startTs = `${range.start}T00:00:00`;
      const endTs = `${range.end}T23:59:59`;
      const { data: gerenteRoles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
      const gerenteIds = (gerenteRoles || []).map(r => r.user_id);
      if (gerenteIds.length === 0) return { teams: [] as TeamData[], corretoresRank: [] as CorretorRankData[] };

      const [{ data: profs }, { data: members }] = await Promise.all([
        supabase.from("profiles").select("id, nome, user_id").in("user_id", gerenteIds),
        supabase.from("team_members").select("id, user_id, gerente_id").in("gerente_id", gerenteIds),
      ]);
      const profMap = new Map(profs?.map(p => [p.user_id, p.nome]) || []);
      const allMemberUserIds = (members || []).map(m => m.user_id).filter(Boolean) as string[];
      if (allMemberUserIds.length === 0) return { teams: [] as TeamData[], corretoresRank: [] as CorretorRankData[] };

      const { data: corrProfs } = await supabase.from("profiles").select("id, nome, user_id").in("user_id", allMemberUserIds);
      const corrNameMap = new Map((corrProfs || []).map(p => [p.user_id, p.nome || "Corretor"]));
      // Map user_id -> profile_id for negocios lookup
      const userToProfileId = new Map((corrProfs || []).map(p => [p.user_id, p.id]));
      const profileToUserId = new Map((corrProfs || []).map(p => [p.id, p.user_id]));
      const allMemberProfileIds = (corrProfs || []).map(p => p.id).filter(Boolean) as string[];

      // MIGRATED: Use auth_user_id for negocios instead of profile_id lookup
      const [{ data: allVisMarcadas }, { data: allVisRealizadas }, { data: allNeg }] = await Promise.all([
        supabase.from("visitas").select("id, corretor_id").in("corretor_id", allMemberUserIds).gte("created_at", startTs).lte("created_at", endTs),
        supabase.from("visitas").select("id, status, corretor_id").in("corretor_id", allMemberUserIds).gte("data_visita", range.start).lte("data_visita", range.end),
        supabase.from("negocios").select("id, fase, vgv_estimado, vgv_final, auth_user_id, data_assinatura").in("auth_user_id", allMemberUserIds).in("fase", ["assinado", "vendido"]).gte("data_assinatura", range.start).lte("data_assinatura", range.end),
      ]);

      // Paginated tentativas
      let allTent: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase.from("oferta_ativa_tentativas").select("id, resultado, corretor_id").in("corretor_id", allMemberUserIds).gte("created_at", startTs).lte("created_at", endTs).range(page * pageSize, (page + 1) * pageSize - 1);
        if (!data || data.length === 0) break;
        allTent = allTent.concat(data);
        if (data.length < pageSize) break;
        page++;
      }

      const corretoresAll: CorretorRankData[] = [];
      const teamDataArr: TeamData[] = [];
      for (const gId of gerenteIds) {
        const teamMbrs = (members || []).filter(m => m.gerente_id === gId);
        const memberUserIds = teamMbrs.map(m => m.user_id).filter(Boolean) as string[];
        if (memberUserIds.length === 0) continue;
        let tLig = 0, tAprov = 0, tVM = 0, tVR = 0, tProp = 0, tVgv = 0;
        const gerenteNome = profMap.get(gId) || "Gerente";
        for (const uid of memberUserIds) {
          const tent = allTent.filter(t => t.corretor_id === uid);
          const lig = tent.length;
          const aprov = tent.filter(t => t.resultado === "com_interesse").length;
          const vm = (allVisMarcadas || []).filter(v => v.corretor_id === uid).length;
          const vr = (allVisRealizadas || []).filter(v => v.corretor_id === uid && v.status === "realizada").length;
          // MIGRATED: Use auth_user_id directly (no profile_id conversion needed)
          const neg = (allNeg || []).filter(n => n.auth_user_id === uid);
          const prop = neg.filter(n => n.fase === "proposta" || n.fase === "negociacao").length;
          const vgv = neg.reduce((s: number, n: any) => s + (n.vgv_final || n.vgv_estimado || 0), 0);
          tLig += lig; tAprov += aprov; tVM += vm; tVR += vr; tProp += prop; tVgv += vgv;
          corretoresAll.push({
            corretor_id: uid as string, nome: corrNameMap.get(uid) as string || "Corretor", gerente_nome: gerenteNome as string,
            ligacoes: lig, aproveitados: aprov, taxa: lig > 0 ? Math.round((aprov / lig) * 100) : 0,
            visitasMarcadas: vm, visitasRealizadas: vr, propostas: prop, vgv,
          });
        }
        teamDataArr.push({
          gerente_id: gId as string, gerente_nome: gerenteNome as string,
          ligacoes: tLig, aproveitados: tAprov, taxa: tLig > 0 ? Math.round((tAprov / tLig) * 100) : 0,
          visitasMarcadas: tVM, visitasRealizadas: tVR, propostas: tProp, vgv: tVgv,
        });
      }
      return { teams: teamDataArr, corretoresRank: corretoresAll };
    },
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  // ── Visitas por Empreendimento ──
  const { data: visitasPorEmp = [] } = useQuery({
    queryKey: ["ceo-visitas-emp", rangeKey],
    queryFn: async () => {
      const startTs = `${range.start}T00:00:00`;
      const endTs = `${range.end}T23:59:59`;
      const [{ data: visMarcadas }, { data: visRealizadas }] = await Promise.all([
        supabase.from("visitas").select("empreendimento").gte("created_at", startTs).lte("created_at", endTs).not("status", "eq", "cancelada"),
        supabase.from("visitas").select("empreendimento").gte("data_visita", range.start).lte("data_visita", range.end).eq("status", "realizada"),
      ]);
      const empMap = new Map<string, { marcadas: number; realizadas: number }>();
      for (const v of (visMarcadas || [])) {
        const emp = v.empreendimento || "Sem empreendimento";
        const curr = empMap.get(emp) || { marcadas: 0, realizadas: 0 };
        curr.marcadas++;
        empMap.set(emp, curr);
      }
      for (const v of (visRealizadas || [])) {
        const emp = v.empreendimento || "Sem empreendimento";
        const curr = empMap.get(emp) || { marcadas: 0, realizadas: 0 };
        curr.realizadas++;
        empMap.set(emp, curr);
      }
      return Array.from(empMap.entries()).map(([emp, d]) => ({ emp, ...d })).sort((a, b) => b.marcadas - a.marcadas);
    },
    enabled: !!user,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  // ── Extra KPIs ──
  const { data: extraKpis } = useQuery({
    queryKey: ["ceo-extra-kpis", rangeKey, hoje],
    queryFn: async () => {
      const startTs = `${range.start}T00:00:00`;
      const endTs = `${range.end}T23:59:59`;

      const [{ count: leadsCount }, { count: leadsOACount }, { count: visitasCriadasCount }, { count: novoInteresseCount }, { data: roletaRows }, { data: goals }] = await Promise.all([
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).gte("created_at", startTs).lte("created_at", endTs).neq("origem", "Oferta Ativa"),
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).gte("created_at", startTs).lte("created_at", endTs).eq("origem", "Oferta Ativa"),
        supabase.from("visitas").select("id", { count: "exact", head: true }).gte("created_at", startTs).lte("created_at", endTs).neq("status", "cancelada"),
        supabase.from("campaign_clicks").select("id", { count: "exact", head: true }).gte("created_at", startTs).lte("created_at", endTs).eq("lead_action", "updated"),
        supabase.from("roleta_credenciamentos").select("corretor_id").eq("data", hoje).in("status", ["aprovado", "saiu"]),
        supabase.from("corretor_daily_goals").select("meta_ligacoes, meta_aproveitados, meta_visitas_marcadas").eq("data", hoje),
      ]);

      const dispIds = new Set<string>();
      (roletaRows || []).forEach(r => { if (r.corretor_id) dispIds.add(r.corretor_id); });

      return {
        totalLeadsPeriodo: leadsCount || 0,
        leadsReaproveitadosOA: leadsOACount || 0,
        totalVisitasCriadas: visitasCriadasCount || 0,
        novoInteresse: novoInteresseCount || 0,
        presentesHoje: dispIds.size,
        metasDiaTotal: {
          ligacoes: (goals || []).reduce((a, g) => a + (g.meta_ligacoes || 0), 0),
          aproveitados: (goals || []).reduce((a, g) => a + (g.meta_aproveitados || 0), 0),
          visitasMarcadas: (goals || []).reduce((a, g) => a + (g.meta_visitas_marcadas || 0), 0),
        },
      };
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  // ── Derived state (stable, no flicker) ──
  const lastUpdate = new Date();

  return {
    loading: kpisFirstLoad, // true only on very first fetch, false after cache is populated
    lastUpdate,
    profile: profile || null,
    roletaPendentes,
    kpis,
    prevKpis,
    pipelineStages: pipelineData?.pipelineStages || [],
    campanhas: pipelineData?.campanhas || [],
    alertas: pipelineData?.alertas || [],
    negocioFases: negociosData?.negocioFases || [],
    vgvEmRisco: negociosData?.vgvEmRisco || 0,
    topCorretoresVgv: negociosData?.topCorretoresVgv || [],
    teams: teamsData?.teams || [],
    corretoresRank: teamsData?.corretoresRank || [],
    origens: pipelineData?.origens || [],
    leadsPorEmpreendimento: pipelineData?.leadsPorEmpreendimento || [],
    leadsPorCorretor: pipelineData?.leadsPorCorretor || [],
    visitasPorEmp,
    totalLeadsPeriodo: extraKpis?.totalLeadsPeriodo || 0,
    leadsReaproveitadosOA: extraKpis?.leadsReaproveitadosOA || 0,
    totalVisitasCriadas: extraKpis?.totalVisitasCriadas || 0,
    novoInteresse: extraKpis?.novoInteresse || 0,
    presentesHoje: extraKpis?.presentesHoje || 0,
    metasDiaTotal: extraKpis?.metasDiaTotal || { ligacoes: 0, aproveitados: 0, visitasMarcadas: 0 },
    reload: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["ceo-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["ceo-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["ceo-negocios"] });
      queryClient.invalidateQueries({ queryKey: ["ceo-teams"] });
      queryClient.invalidateQueries({ queryKey: ["ceo-extra-kpis"] });
    }, [queryClient]),
    reloadRoleta,
  };
}
