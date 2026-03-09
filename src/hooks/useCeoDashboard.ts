import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";

export type DashPeriod = "hoje" | "semana" | "mes";

function getRange(period: DashPeriod) {
  const now = new Date();
  if (period === "hoje") return { start: format(now, "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
  if (period === "semana") return { start: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), end: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd") };
  return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
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

export interface OrigemData {
  origem: string; count: number;
}

export function useCeoDashboard(period: DashPeriod) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Profile
  const [profile, setProfile] = useState<{ nome: string; avatar_gamificado_url: string | null; avatar_url: string | null } | null>(null);

  // Roleta
  const [roletaPendentes, setRoletaPendentes] = useState<any[]>([]);

  // KPIs
  const [kpis, setKpis] = useState<KPIs>({ ligacoes: 0, aproveitados: 0, taxaConversao: 0, visitasMarcadas: 0, visitasRealizadas: 0, taxaRealizacao: 0, vgvGerado: 0, vgvAssinado: 0, propostas: 0, negociosPerdidos: 0, noShows: 0 });
  const [prevKpis, setPrevKpis] = useState<KPIs | null>(null);

  // Pipeline
  const [pipelineStages, setPipelineStages] = useState<PipelineStageData[]>([]);
  const [campanhas, setCampanhas] = useState<CampanhaData[]>([]);
  const [alertas, setAlertas] = useState<AlertaGargalo[]>([]);

  // Negocios
  const [negocioFases, setNegocioFases] = useState<NegocioFase[]>([]);
  const [vgvEmRisco, setVgvEmRisco] = useState(0);
  const [topCorretoresVgv, setTopCorretoresVgv] = useState<{ nome: string; vgv: number }[]>([]);

  // Teams
  const [teams, setTeams] = useState<TeamData[]>([]);

  // Marketing
  const [origens, setOrigens] = useState<OrigemData[]>([]);
  const [leadsPorEmpreendimento, setLeadsPorEmpreendimento] = useState<{ emp: string; count: number }[]>([]);

  // Visitas by empreendimento
  const [visitasPorEmp, setVisitasPorEmp] = useState<{ emp: string; marcadas: number; realizadas: number }[]>([]);

  const range = useMemo(() => getRange(period), [period]);
  const prevRange = useMemo(() => getPrevRange(period), [period]);
  const hoje = format(new Date(), "yyyy-MM-dd");

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("nome, avatar_gamificado_url, avatar_url").eq("user_id", user.id).single();
    if (data) setProfile(data);
  }, [user]);

  const loadRoleta = useCallback(async () => {
    const { data: creds } = await supabase.from("roleta_credenciamentos").select("*").eq("data", hoje).eq("status", "pendente").order("created_at");
    if (!creds?.length) { setRoletaPendentes([]); return; }
    const ids = [...new Set(creds.map(c => c.corretor_id).filter(Boolean))] as string[];
    const { data: profs } = await supabase.from("profiles").select("id, nome, avatar_gamificado_url").in("id", ids);
    const pm = new Map(profs?.map(p => [p.id, p]) || []);
    const { data: segs } = await supabase.from("roleta_segmentos").select("id, nome");
    const sm = new Map(segs?.map(s => [s.id, s.nome]) || []);
    setRoletaPendentes(creds.map(c => ({
      ...c,
      corretor_nome: c.corretor_id ? pm.get(c.corretor_id)?.nome || "Corretor" : "Corretor",
      avatar: c.corretor_id ? pm.get(c.corretor_id)?.avatar_gamificado_url : null,
      seg1_nome: c.segmento_1_id ? sm.get(c.segmento_1_id) || "—" : "—",
      seg2_nome: c.segmento_2_id ? sm.get(c.segmento_2_id) || "—" : null,
    })));
  }, [hoje]);

  const loadKPIs = useCallback(async (r: { start: string; end: string }) => {
    const startTs = `${r.start}T00:00:00`;
    const endTs = `${r.end}T23:59:59`;

    // Ligações e aproveitados
    const { data: tentativas } = await supabase.from("oferta_ativa_tentativas").select("id, resultado").gte("created_at", startTs).lte("created_at", endTs);
    const ligacoes = tentativas?.length || 0;
    const aproveitados = tentativas?.filter(t => t.resultado === "com_interesse").length || 0;

    // Visitas
    const { data: visitas } = await supabase.from("visitas").select("id, status, resultado_visita, empreendimento").gte("data_visita", r.start).lte("data_visita", r.end);
    const visitasMarcadas = visitas?.length || 0;
    const visitasRealizadas = visitas?.filter(v => v.status === "realizada").length || 0;
    const noShows = visitas?.filter(v => v.status === "no_show").length || 0;

    // Negocios
    const { data: negocios } = await supabase.from("negocios").select("id, fase, status, vgv_estimado, vgv_final").gte("created_at", startTs).lte("created_at", endTs);
    const vgvGerado = negocios?.reduce((s, n) => s + (n.vgv_estimado || 0), 0) || 0;
    const vgvAssinado = negocios?.filter(n => n.fase === "assinado").reduce((s, n) => s + (n.vgv_final || n.vgv_estimado || 0), 0) || 0;
    const propostas = negocios?.filter(n => n.fase === "proposta" || n.fase === "negociacao").length || 0;
    const negociosPerdidos = negocios?.filter(n => n.status === "perdido" || n.status === "cancelado").length || 0;

    return {
      ligacoes, aproveitados, taxaConversao: ligacoes > 0 ? Math.round((aproveitados / ligacoes) * 100) : 0,
      visitasMarcadas, visitasRealizadas, taxaRealizacao: visitasMarcadas > 0 ? Math.round((visitasRealizadas / visitasMarcadas) * 100) : 0,
      vgvGerado, vgvAssinado, propostas, negociosPerdidos, noShows,
    } as KPIs;
  }, []);

  const loadPipeline = useCallback(async () => {
    const { data: stages } = await supabase.from("pipeline_stages").select("id, nome, tipo, ordem").eq("ativo", true).eq("pipeline_tipo", "leads").order("ordem");
    const { data: leads } = await supabase.from("pipeline_leads").select("id, stage_id, empreendimento, updated_at, created_at, origem").limit(1000);

    const stageData = (stages || []).map(s => ({
      id: s.id, nome: s.nome, tipo: s.tipo, ordem: s.ordem,
      count: (leads || []).filter(l => l.stage_id === s.id).length,
    }));
    setPipelineStages(stageData);

    // Campanhas
    const empMap = new Map<string, { leads: number; avancou: number; parados: number }>();
    const now = new Date();
    for (const l of (leads || [])) {
      const emp = l.empreendimento || "Sem empreendimento";
      const curr = empMap.get(emp) || { leads: 0, avancou: 0, parados: 0 };
      curr.leads++;
      const stageOrdem = stageData.find(s => s.id === l.stage_id)?.ordem || 0;
      if (stageOrdem > 1) curr.avancou++;
      const diffDays = Math.floor((now.getTime() - new Date(l.updated_at || l.created_at).getTime()) / 86400000);
      if (diffDays > 3) curr.parados++;
      empMap.set(emp, curr);
    }
    setCampanhas(Array.from(empMap.entries()).map(([emp, d]) => ({
      empreendimento: emp, leads: d.leads, avancou: d.avancou, parados: d.parados,
      pctAvancou: d.leads > 0 ? Math.round((d.avancou / d.leads) * 100) : 0,
      pctParados: d.leads > 0 ? Math.round((d.parados / d.leads) * 100) : 0,
    })).sort((a, b) => b.leads - a.leads));

    // Alertas
    const als: AlertaGargalo[] = [];
    const parados7d = (leads || []).filter(l => {
      const diff = Math.floor((now.getTime() - new Date(l.updated_at || l.created_at).getTime()) / 86400000);
      return diff > 7;
    }).length;
    if (parados7d > 0) als.push({ tipo: "red", mensagem: `${parados7d} leads parados >7 dias sem contato`, link: "/pipeline" });
    
    const semCorretor = (leads || []).filter(l => !l.stage_id).length; // Approximate
    const filaCeo = (leads || []).filter(l => {
      const st = stageData.find(s => s.id === l.stage_id);
      return st?.tipo === "novo_lead";
    }).length;
    if (filaCeo > 5) als.push({ tipo: "yellow", mensagem: `${filaCeo} leads na Fila CEO aguardando distribuição`, link: "/pipeline" });

    // Find best campaign
    const bestCamp = Array.from(empMap.entries()).sort((a, b) => {
      const pA = a[1].leads > 0 ? a[1].avancou / a[1].leads : 0;
      const pB = b[1].leads > 0 ? b[1].avancou / b[1].leads : 0;
      return pB - pA;
    })[0];
    if (bestCamp && bestCamp[1].leads >= 3) als.push({ tipo: "green", mensagem: `Campanha ${bestCamp[0]} com melhor taxa de conversão`, link: "/pipeline" });

    setAlertas(als);

    // Origens
    const origMap = new Map<string, number>();
    for (const l of (leads || [])) {
      const orig = l.origem || "Desconhecido";
      origMap.set(orig, (origMap.get(orig) || 0) + 1);
    }
    setOrigens(Array.from(origMap.entries()).map(([origem, count]) => ({ origem, count })).sort((a, b) => b.count - a.count));

    // Leads por empreendimento
    setLeadsPorEmpreendimento(Array.from(empMap.entries()).map(([emp, d]) => ({ emp, count: d.leads })).sort((a, b) => b.count - a.count).slice(0, 10));
  }, []);

  const loadNegocios = useCallback(async () => {
    const { data: negocios } = await supabase.from("negocios").select("id, fase, status, vgv_estimado, vgv_final, corretor_id, updated_at, empreendimento").limit(500);
    
    // Fases
    const faseMap = new Map<string, { count: number; vgv: number }>();
    const now = new Date();
    let risco = 0;
    for (const n of (negocios || [])) {
      if (n.status === "perdido" || n.status === "cancelado") continue;
      const fase = n.fase || "desconhecido";
      const curr = faseMap.get(fase) || { count: 0, vgv: 0 };
      curr.count++;
      curr.vgv += n.vgv_estimado || 0;
      faseMap.set(fase, curr);
      const diffDays = Math.floor((now.getTime() - new Date(n.updated_at || "").getTime()) / 86400000);
      if (diffDays > 15) risco += n.vgv_estimado || 0;
    }
    setNegocioFases(Array.from(faseMap.entries()).map(([fase, d]) => ({ fase, ...d })));
    setVgvEmRisco(risco);

    // Top corretores by VGV
    const corrMap = new Map<string, number>();
    for (const n of (negocios || [])) {
      if (!n.corretor_id) continue;
      corrMap.set(n.corretor_id, (corrMap.get(n.corretor_id) || 0) + (n.vgv_estimado || 0));
    }
    const corrIds = [...corrMap.keys()];
    const { data: profs } = corrIds.length > 0 ? await supabase.from("profiles").select("id, nome").in("id", corrIds) : { data: [] as { id: string; nome: string }[] };
    const profMap = new Map((profs || []).map(p => [p.id, p.nome] as [string, string]));
    setTopCorretoresVgv(
      Array.from(corrMap.entries()).map(([id, vgv]) => ({ nome: profMap.get(id) || "Corretor", vgv }))
        .sort((a, b) => b.vgv - a.vgv).slice(0, 5)
    );
  }, []);

  const loadTeams = useCallback(async () => {
    const startTs = `${range.start}T00:00:00`;
    const endTs = `${range.end}T23:59:59`;

    const { data: gerenteRoles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
    const gerenteIds = (gerenteRoles || []).map(r => r.user_id);
    if (gerenteIds.length === 0) { setTeams([]); return; }

    const { data: profs } = await supabase.from("profiles").select("id, nome, user_id").in("user_id", gerenteIds);
    const profMap = new Map(profs?.map(p => [p.user_id, p.nome]) || []);

    const { data: members } = await supabase.from("team_members").select("id, user_id, gerente_id").in("gerente_id", gerenteIds);

    const teamData: TeamData[] = [];
    for (const gId of gerenteIds) {
      const teamMembers = (members || []).filter(m => m.gerente_id === gId);
      const memberUserIds = teamMembers.map(m => m.user_id).filter(Boolean) as string[];
      if (memberUserIds.length === 0) continue;

      // Tentativas
      const { data: tent } = await supabase.from("oferta_ativa_tentativas").select("id, resultado").in("corretor_id", memberUserIds).gte("created_at", startTs).lte("created_at", endTs);
      const ligacoes = tent?.length || 0;
      const aproveitados = tent?.filter(t => t.resultado === "com_interesse").length || 0;

      // Visitas
      const { data: vis } = await supabase.from("visitas").select("id, status").in("corretor_id", memberUserIds).gte("data_visita", range.start).lte("data_visita", range.end);
      const visitasMarcadas = vis?.length || 0;
      const visitasRealizadas = vis?.filter(v => v.status === "realizada").length || 0;

      // Negocios
      const { data: neg } = await supabase.from("negocios").select("id, fase, vgv_estimado, vgv_final").in("corretor_id", memberUserIds).gte("created_at", startTs).lte("created_at", endTs);
      const propostas = neg?.filter(n => n.fase === "proposta" || n.fase === "negociacao").length || 0;
      const vgv = neg?.reduce((s, n) => s + (n.vgv_estimado || 0), 0) || 0;

      teamData.push({
        gerente_id: gId, gerente_nome: profMap.get(gId) || "Gerente",
        ligacoes, aproveitados, taxa: ligacoes > 0 ? Math.round((aproveitados / ligacoes) * 100) : 0,
        visitasMarcadas, visitasRealizadas, propostas, vgv,
      });
    }
    setTeams(teamData);
  }, [range]);

  const loadVisitasPorEmp = useCallback(async () => {
    const { data: vis } = await supabase.from("visitas").select("empreendimento, status").gte("data_visita", range.start).lte("data_visita", range.end);
    const empMap = new Map<string, { marcadas: number; realizadas: number }>();
    for (const v of (vis || [])) {
      const emp = v.empreendimento || "Sem empreendimento";
      const curr = empMap.get(emp) || { marcadas: 0, realizadas: 0 };
      curr.marcadas++;
      if (v.status === "realizada") curr.realizadas++;
      empMap.set(emp, curr);
    }
    setVisitasPorEmp(Array.from(empMap.entries()).map(([emp, d]) => ({ emp, ...d })).sort((a, b) => b.marcadas - a.marcadas));
  }, [range]);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await loadProfile();
      await loadRoleta();
      const [currentKpis, previousKpis] = await Promise.all([loadKPIs(range), loadKPIs(prevRange)]);
      setKpis(currentKpis);
      setPrevKpis(previousKpis);
      await Promise.all([loadPipeline(), loadNegocios(), loadTeams(), loadVisitasPorEmp()]);
    } catch (err) {
      console.error("Erro ao carregar dashboard CEO:", err);
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  }, [user, range, prevRange, loadProfile, loadRoleta, loadKPIs, loadPipeline, loadNegocios, loadTeams, loadVisitasPorEmp]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(loadAll, 60000);
    return () => clearInterval(interval);
  }, [loadAll]);

  // Roleta refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadRoleta, 30000);
    return () => clearInterval(interval);
  }, [loadRoleta]);

  return {
    loading, lastUpdate, profile, roletaPendentes, kpis, prevKpis,
    pipelineStages, campanhas, alertas, negocioFases, vgvEmRisco, topCorretoresVgv,
    teams, origens, leadsPorEmpreendimento, visitasPorEmp,
    reload: loadAll, reloadRoleta: loadRoleta,
  };
}
