import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { filaCeoStageOrFilter } from "@/lib/filaCeoStages";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCeoDashboard, type DashPeriod } from "@/hooks/useCeoDashboard";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { fmtMoney } from "@/lib/fmtMoney";
import type { Tables } from "@/integrations/supabase/types";
import type { KpiDetailType } from "@/components/ceo/KpiDetailDialog";

export type PendingCredential = Tables<"roleta_credenciamentos"> & {
  corretor_nome: string; avatar: string | null; empreendimentos_alocados: string[];
};
const formatBRLCompact = (v: number) => fmtMoney(v, "short");
const FRASES = [
  "Liderar é servir com propósito.",
  "Dados guiam, pessoas executam.",
  "Cada número esconde uma história.",
  "A disciplina do processo gera resultado.",
  "O melhor dashboard é aquele que provoca ação.",
  "Quem mede, melhora. Quem acompanha, transforma.",
];


export function useCeoDashboardController() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { period, range } = useDateFilter();
  const [frase] = useState(() => FRASES[Math.floor(Math.random() * FRASES.length)]);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [filaCeoCount, setFilaCeoCount] = useState(0);
  const [lastDispatch, setLastDispatch] = useState<{ at: string; count: number } | null>(null);
  const [bulkEmpOpen, setBulkEmpOpen] = useState(false);
  const [kpiDetail, setKpiDetail] = useState<{ type: KpiDetailType; label: string } | null>(null);
  
  const [funnelCorretorFilter, setFunnelCorretorFilter] = useState<"all" | string>("all");
  const [showAllCorretorLeads, setShowAllCorretorLeads] = useState(false);

  const dashboard = useCeoDashboard(period as DashPeriod, { start: range.start, end: range.end });
  const {
    loading, lastUpdate, profile, roletaPendentes, kpis, prevKpis,
    pipelineStages, campanhas, alertas, negocioFases, vgvEmRisco, topCorretoresVgv, vendasPeriodo, vgvMesAtual,
    teams, corretoresRank, origens, leadsPorEmpreendimento, leadsPorCorretor, visitasPorEmp,
    totalLeadsPeriodo, leadsReaproveitadosOA, agendaVisitas, agendaVisitasPrev, novoInteresse, enviadosRoleta, presentesHoje, metasDiaTotal,
    reload, reloadRoleta,
    error: dashError, partial, partialSources, errors,
  } = dashboard;

  /** Variação % vs. período anterior (null quando não há base de comparação). */
  const delta = (curr: number | undefined, prev: number | undefined): number | null => {
    if (curr == null || prev == null || !Number.isFinite(prev) || prev === 0) return null;
    return ((curr - prev) / prev) * 100;
  };


  // CEO metas (React Query)
  const mesAtual = useMemo(() => format(new Date(), "yyyy-MM"), []);
  const { data: ceoMetas = {} } = useQuery({
    queryKey: ["ceo-metas-mensais", mesAtual],
    queryFn: async () => {
      const { data, error } = await supabase.from("ceo_metas_mensais").select("*").eq("mes", mesAtual);
      if (error) throw error;
      if (!data || data.length === 0) return {};
      return {
        meta_ligacoes: data.reduce((a, m) => a + (m.meta_ligacoes || 0), 0),
        meta_visitas_marcadas: data.reduce((a, m) => a + (m.meta_visitas_marcadas || 0), 0),
        meta_visitas_realizadas: data.reduce((a, m) => a + (m.meta_visitas_realizadas || 0), 0),
        meta_vgv_assinado: data.reduce((a, m) => a + (m.meta_vgv_assinado || 0), 0),
        meta_propostas: data.reduce((a, m) => a + (m.meta_propostas || 0), 0),
        meta_contratos: data.reduce((a, m) => a + (m.meta_contratos || 0), 0),
        meta_assinados: data.reduce((a, m) => a + (m.meta_assinados || 0), 0),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  // Fila CEO
  const loadFilaCeo = useCallback(async () => {
    const stageFilter = await filaCeoStageOrFilter();
    let filaQuery = supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).eq("aceite_status", "pendente_distribuicao").is("corretor_id", null).eq("arquivado", false);
    if (stageFilter) filaQuery = filaQuery.or(stageFilter);
    const [countRes, logRes] = await Promise.all([
      filaQuery,
      supabase.from("audit_log").select("created_at, depois").eq("acao", "dispatch_fila_ceo").order("created_at", { ascending: false }).limit(1),
    ]);
    setFilaCeoCount(countRes.count || 0);
    if (logRes.data?.[0]) {
      const d = logRes.data[0].depois;
      setLastDispatch({ at: logRes.data[0].created_at, count: d && typeof d === "object" && !Array.isArray(d) && typeof d.dispatched === "number" ? d.dispatched : 0 });
    }
  }, []);
  useEffect(() => {
    loadFilaCeo();

    const handleFocus = () => loadFilaCeo();
    window.addEventListener("focus", handleFocus);

    const interval = window.setInterval(() => {
      loadFilaCeo();
    }, 15000);

    const channel = supabase
      .channel("ceo-fila-ceo-counter")
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_leads" }, () => {
        loadFilaCeo();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_log" }, () => {
        loadFilaCeo();
      })
      .subscribe();

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadFilaCeo]);

  // Roleta approval logic
  const [localPendentes, setLocalPendentes] = useState<PendingCredential[]>([]);
  useEffect(() => { setLocalPendentes(roletaPendentes); }, [roletaPendentes]);

  const getProfileId = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
    return data?.id || null;
  }, [user]);

  const insertFilaForCred = useCallback(async (cred: PendingCredential) => {
    if (!cred.corretor_id) return;
    const segmentoIds = [cred.segmento_1_id, cred.segmento_2_id].filter(Boolean) as string[];
    for (const segId of segmentoIds) {
      await supabase.rpc("upsert_roleta_fila", {
        p_corretor_id: cred.corretor_id ?? "",
        p_segmento_id: segId,
        p_janela: cred.janela,
        p_data: hoje,
        p_credenciamento_id: cred.id,
      });
    }
  }, [hoje]);

  const aprovar = useCallback(async (id: string) => {
    if (!user) return;
    const profileId = await getProfileId();
    if (!profileId) { toast.error("Perfil não encontrado"); return; }
    const item = localPendentes.find((c) => c.id === id);
    setLocalPendentes(prev => prev.filter((c) => c.id !== id));
    const { data: cred, error } = await supabase.from("roleta_credenciamentos")
      .update({ status: "aprovado", aprovado_por: profileId, aprovado_em: new Date().toISOString() })
      .eq("id", id).select().single();
    if (error || !cred) {
      toast.error("Erro ao aprovar");
      if (item) setLocalPendentes(prev => [...prev, item]);
      return;
    }
    await insertFilaForCred({ ...cred, corretor_nome: "", avatar: null, empreendimentos_alocados: [] });
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("id", cred.corretor_id).single();
    if (prof?.user_id) {
      await supabase.from("corretor_disponibilidade")
        .upsert({ user_id: prof.user_id, na_roleta: true, status: "na_empresa", segmentos: [], updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    }
    toast.success(`${item?.corretor_nome || "Corretor"} aprovado(a) na Roleta`);
    reloadRoleta();
  }, [user, localPendentes, getProfileId, insertFilaForCred, reloadRoleta]);

  const recusar = useCallback(async (id: string) => {
    if (!user) return;
    const profileId = await getProfileId();
    if (!profileId) return;
    const item = localPendentes.find((c) => c.id === id);
    setLocalPendentes(prev => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from("roleta_credenciamentos")
      .update({ status: "recusado", aprovado_por: profileId, aprovado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Erro ao recusar"); if (item) setLocalPendentes(prev => [...prev, item]); return; }
    if (item?.corretor_id) {
      const { count } = await supabase.from("roleta_credenciamentos")
        .select("id", { count: "exact", head: true }).eq("corretor_id", item.corretor_id).eq("data", hoje).eq("status", "aprovado");
      if ((count || 0) === 0) {
        const { data: prof } = await supabase.from("profiles").select("user_id").eq("id", item.corretor_id).single();
        if (prof?.user_id) await supabase.from("corretor_disponibilidade").update({ na_roleta: false, updated_at: new Date().toISOString() }).eq("user_id", prof.user_id);
      }
    }
    toast.success(`${item?.corretor_nome || "Corretor"} recusado(a) da Roleta`);
    reloadRoleta();
  }, [user, localPendentes, getProfileId, reloadRoleta, hoje]);

  const aprovarTodos = useCallback(async () => {
    if (!user) return;
    const profileId = await getProfileId();
    if (!profileId) { toast.error("Perfil não encontrado"); return; }
    const pending = [...localPendentes];
    setLocalPendentes([]);
    let ok = 0;
    for (const c of pending) {
      const { data: cred, error } = await supabase.from("roleta_credenciamentos")
        .update({ status: "aprovado", aprovado_por: profileId, aprovado_em: new Date().toISOString() })
        .eq("id", c.id).select().single();
      if (!error && cred) {
        await insertFilaForCred({ ...cred, corretor_nome: "", avatar: null, empreendimentos_alocados: [] });
        const { data: prof } = await supabase.from("profiles").select("user_id").eq("id", cred.corretor_id).single();
        if (prof?.user_id) {
          await supabase.from("corretor_disponibilidade")
            .upsert({ user_id: prof.user_id, na_roleta: true, status: "na_empresa", segmentos: [], updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        }
        ok++;
      }
    }
    toast.success(`${ok} corretor(es) aprovado(s) na Roleta`);
    reloadRoleta();
  }, [user, localPendentes, getProfileId, insertFilaForCred, reloadRoleta]);

  // Derived
  const totalTeam = teams.reduce((acc, t) => ({
    ligacoes: acc.ligacoes + t.ligacoes, aproveitados: acc.aproveitados + t.aproveitados,
    visitasMarcadas: acc.visitasMarcadas + t.visitasMarcadas, visitasRealizadas: acc.visitasRealizadas + t.visitasRealizadas,
    propostas: acc.propostas + t.propostas, vgv: acc.vgv + t.vgv,
  }), { ligacoes: 0, aproveitados: 0, visitasMarcadas: 0, visitasRealizadas: 0, propostas: 0, vgv: 0 });

  const totalNeg = negocioFases.reduce((a, f) => a + f.count, 0);
  const negTotalVgv = negocioFases.reduce((a, f) => a + f.vgv, 0);
  // "Contrato" = fase canônica intermediária (contrato gerado/em assinatura)
  const contratoGerado = negocioFases.find((f) => f.fase === "contrato_gerado");
  const vgvContrato = contratoGerado?.vgv || 0;
  const countContrato = contratoGerado?.count || 0;
  const leadsDistribuidos = enviadosRoleta;

  // Rótulo legível do período selecionado (para deixar claro o escopo dos KPIs)
  const periodoLabel = useMemo(() => {
    const br = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
    return range.start === range.end ? br(range.start) : `${br(range.start)} – ${br(range.end)}`;
  }, [range]);

  // Taxas de conversão do período (Lead → Visita realizada → Venda assinada)
  const conversoes = useMemo(() => {
    const vendas = vendasPeriodo.length;
    const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");
    return [
      { label: "Lead → Visita realizada", value: pct(kpis.visitasRealizadas, totalLeadsPeriodo), sub: `${kpis.visitasRealizadas} de ${totalLeadsPeriodo} leads` },
      { label: "Visita → Venda", value: pct(vendas, kpis.visitasRealizadas), sub: `${vendas} de ${kpis.visitasRealizadas} visitas` },
      { label: "Lead → Venda", value: pct(vendas, totalLeadsPeriodo), sub: `${vendas} de ${totalLeadsPeriodo} leads` },
      { label: "Ticket médio", value: vendas > 0 ? formatBRLCompact(kpis.vgvAssinado / vendas) : "—", sub: "VGV assinado / vendas" },
    ];
  }, [vendasPeriodo, kpis.visitasRealizadas, kpis.vgvAssinado, totalLeadsPeriodo]);


  // Pipeline funnel totals
  const funnelTotal = pipelineStages.reduce((a, s) => a + s.count, 0) || 1;
  

  // Funil de negócios — 3 fases canônicas (pós-consolidação 07/2026).
  // "Perdido" vive em coluna status, não em fase, portanto fora deste funil.
  const negFunnelOrder = ["documentacao", "proposta", "contrato_gerado", "ganho"];
  const negFunnelLabels: Record<string,string> = {
    documentacao: "Documentação",
    proposta: "Em Negociação",
    contrato_gerado: "Contrato",
    ganho: "Ganho",
  };
  const negFunnelColors: Record<string,string> = {
    documentacao: "var(--ceo-chart-primary)",
    proposta: "var(--ceo-chart-proposal)",
    contrato_gerado: "var(--ceo-chart-contract)",
    ganho: "var(--ceo-chart-won)",
  };


  return { dashboard, navigate, user, isAdmin, period, range, frase, dispatchOpen, setDispatchOpen, filaCeoCount, bulkEmpOpen, setBulkEmpOpen, kpiDetail, setKpiDetail, showAllCorretorLeads, setShowAllCorretorLeads, loading, lastUpdate, profile, kpis, prevKpis, pipelineStages, campanhas, alertas, negocioFases, vgvEmRisco, vendasPeriodo, vgvMesAtual, teams, corretoresRank, origens, leadsPorEmpreendimento, leadsPorCorretor, totalLeadsPeriodo, leadsReaproveitadosOA, agendaVisitas, agendaVisitasPrev, novoInteresse, presentesHoje, metasDiaTotal, reload, reloadRoleta, dashError, partial, partialSources, errors, delta, ceoMetas, hoje, loadFilaCeo, localPendentes, aprovar, recusar, aprovarTodos, totalTeam, totalNeg, vgvContrato, countContrato, leadsDistribuidos, periodoLabel, conversoes, funnelTotal, negFunnelOrder, negFunnelLabels, negFunnelColors };
}
export type CeoDashboardController = ReturnType<typeof useCeoDashboardController>;
