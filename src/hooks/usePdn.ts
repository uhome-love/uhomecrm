import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

// ─── Grupos / status do PDN ──────────────────────────────────────────────────
export type PdnGrupo = "visita_realizada" | "em_negociacao" | "contrato" | "ganho" | "caidos";

export const PDN_GRUPOS: { key: PdnGrupo; label: string; cor: string }[] = [
  { key: "visita_realizada", label: "Visita Realizada", cor: "#10B981" },
  { key: "em_negociacao", label: "Em Negociação", cor: "#EC4899" },
  { key: "contrato", label: "Contrato", cor: "#06B6D4" },
  { key: "ganho", label: "Ganho", cor: "#22C55E" },
  { key: "caidos", label: "Caídos", cor: "#EF4444" },
];

// Probabilidade ponderada por grupo (para forecast)
const PROB_POR_GRUPO: Record<PdnGrupo, number> = {
  visita_realizada: 0.2,
  em_negociacao: 0.5,
  contrato: 0.8,
  ganho: 1,
  caidos: 0,
};

// Etapas do pipeline (pipeline_stages.tipo) → grupo do PDN
const STAGE_TIPO_TO_GRUPO: Record<string, PdnGrupo> = {
  proposta: "em_negociacao",
  contrato_gerado: "contrato",
  venda: "ganho",
};

function mesOf(dateStr: string): string {
  return (dateStr || "").slice(0, 7); // YYYY-MM
}

export interface PdnRow {
  id: string;                 // chave única da linha
  negocioId: string | null;   // negocios.id (se houver)
  pipelineLeadId: string | null; // pipeline_leads.id (fonte)
  overrideId: string | null;  // pdn_entries.id do overlay (se houver)
  grupo: PdnGrupo;            // grupo efetivo (caidos se caiu=true)
  grupoOrigem: PdnGrupo;      // grupo natural (etapa) antes da queda
  nome: string;
  data: string;               // YYYY-MM-DD
  empreendimento: string;
  vgv: number;
  situacaoLabel: string;
  corretor: string;
  equipe: string;
  status: string;             // status livre do gerente (overlay)
  observacoes: string;
  proximaAcao: string;
  caiu: boolean;
  motivoQueda: string;
  diasParado: number;
  emRisco: boolean;
  isManual: boolean;
}

type PdnEntry = {
  id: string;
  negocio_id: string | null;
  pipeline_lead_id: string | null;
  gerente_id: string;
  mes: string;
  nome: string;
  situacao: string;
  empreendimento: string | null;
  vgv: number | null;
  corretor: string | null;
  equipe: string | null;
  data_visita: string | null;
  status: string | null;
  observacoes: string | null;
  proxima_acao: string | null;
  caiu: boolean | null;
  motivo_queda: string | null;
};

function diffDays(dateStr: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / 86400000);
}

interface PipelineDeal {
  id: string;              // pipeline_lead_id
  nome: string;
  corretorAuthId: string | null;
  grupo: PdnGrupo;
  stageChangedAt: string;
  // do negócio vinculado
  negocioId: string | null;
  empreendimento: string;
  vgv: number;
  dataAssinatura: string | null;
  observacoesNegocio: string;
}

export function usePdn(mes: string) {
  const { user } = useAuth();
  const { isAdmin, isGestor, isDiretor } = useUserRole();
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [nameByAuthId, setNameByAuthId] = useState<Record<string, string>>({});
  const [equipeByAuthId, setEquipeByAuthId] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<PdnEntry[]>([]);
  const [visitasReal, setVisitasReal] = useState<
    { id: string; leadId: string | null; nome: string; data: string; empreendimento: string; corretorAuthId: string | null; temNegocio: boolean }[]
  >([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // ── Overlay do gerente (pdn_entries) ─────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    if (!user) return;
    setLoadingEntries(true);
    const { data, error } = await supabase
      .from("pdn_entries")
      .select("id, negocio_id, pipeline_lead_id, gerente_id, mes, nome, situacao, empreendimento, vgv, corretor, equipe, data_visita, status, observacoes, proxima_acao, caiu, motivo_queda")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Erro ao carregar PDN:", error);
      setLoadingEntries(false);
      return;
    }
    setEntries((data || []) as PdnEntry[]);
    setLoadingEntries(false);
  }, [user]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // ── Fonte única: pipeline_leads (Em Negociação / Contrato / Ganho) ───────────
  const loadDeals = useCallback(async () => {
    if (!user) return;
    setLoadingDeals(true);

    // Escopo de corretores (auth ids)
    let corretorAuthIds: string[] | null = null; // null = admin/CEO (todos)
    if (!isAdmin) {
      if (isGestor) {
        const { data: managed } = await supabase.rpc("resolve_managed_brokers", { _gestor: user.id });
        const ids = (managed || []).map((m: { user_id: string }) => m.user_id).filter(Boolean) as string[];
        if (!ids.includes(user.id)) ids.push(user.id);
        corretorAuthIds = ids;
      } else {
        corretorAuthIds = [user.id];
      }
    }

    // Etapas de negócio do pipeline
    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, tipo")
      .in("tipo", ["proposta", "contrato_gerado", "venda"]);
    const stageGrupo: Record<string, PdnGrupo> = {};
    for (const s of stages || []) stageGrupo[(s as any).id] = STAGE_TIPO_TO_GRUPO[(s as any).tipo];
    const stageIds = Object.keys(stageGrupo);

    if (stageIds.length === 0) {
      setDeals([]);
      setLoadingDeals(false);
      return;
    }

    let leadQuery = supabase
      .from("pipeline_leads")
      .select("id, nome, corretor_id, stage_id, stage_changed_at, updated_at")
      .in("stage_id", stageIds)
      .limit(2000);
    if (corretorAuthIds) {
      if (corretorAuthIds.length === 0) { setDeals([]); setLoadingDeals(false); return; }
      leadQuery = leadQuery.in("corretor_id", corretorAuthIds);
    }
    const { data: leads, error: leadErr } = await leadQuery;
    if (leadErr) {
      console.error("Erro ao carregar pipeline do PDN:", leadErr);
      setLoadingDeals(false);
      return;
    }

    const leadIds = (leads || []).map((l: any) => l.id);
    // Negócios vinculados (VGV / empreendimento / assinatura)
    const negocioByLead: Record<string, any> = {};
    if (leadIds.length > 0) {
      const { data: negs } = await supabase
        .from("negocios")
        .select("id, pipeline_lead_id, empreendimento, vgv_final, vgv_estimado, data_assinatura, observacoes, status")
        .in("pipeline_lead_id", leadIds);
      for (const n of negs || []) {
        if ((n as any).status === "perdido") continue;
        negocioByLead[(n as any).pipeline_lead_id] = n;
      }
    }

    const dealRows: PipelineDeal[] = (leads || []).map((l: any) => {
      const n = negocioByLead[l.id];
      const grupo = stageGrupo[l.stage_id];
      return {
        id: l.id,
        nome: l.nome || "—",
        corretorAuthId: l.corretor_id || null,
        grupo,
        stageChangedAt: l.stage_changed_at || l.updated_at || "",
        negocioId: n ? n.id : null,
        empreendimento: n?.empreendimento || "—",
        vgv: Number(n?.vgv_final ?? n?.vgv_estimado ?? 0) || 0,
        dataAssinatura: n?.data_assinatura || null,
        observacoesNegocio: n?.observacoes || "",
      };
    });
    setDeals(dealRows);
    setLoadingDeals(false);
  }, [user, isAdmin, isGestor]);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  // ── Visitas realizadas no mês (leads sem negócio ativo) ───────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const inicio = `${mes}-01`;
      const [ano, m] = mes.split("-").map(Number);
      const fim = new Date(ano, m, 0).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("visitas")
        .select("id, nome_cliente, data_visita, empreendimento, pipeline_lead_id, corretor_id, status")
        .eq("status", "realizada")
        .gte("data_visita", inicio)
        .lte("data_visita", fim);
      if (error) { console.error("Erro ao carregar visitas do PDN:", error); return; }
      const negocioLeadIds = new Set(deals.filter(d => d.negocioId).map(d => d.id));
      const rows = (data || []).map((v: any) => ({
        id: v.id as string,
        leadId: (v.pipeline_lead_id as string) || null,
        nome: (v.nome_cliente as string) || "—",
        data: (v.data_visita as string) || "",
        empreendimento: (v.empreendimento as string) || "—",
        corretorAuthId: (v.corretor_id as string) || null,
        temNegocio: v.pipeline_lead_id ? negocioLeadIds.has(v.pipeline_lead_id) : false,
      }));
      setVisitasReal(rows);
    })();
  }, [user, mes, deals]);

  // ── Nomes/equipe dos corretores (auth id → nome), cobrindo negócios E visitas ─
  useEffect(() => {
    (async () => {
      const authIds = [...new Set([
        ...deals.map(d => d.corretorAuthId),
        ...visitasReal.map(v => v.corretorAuthId),
      ].filter(Boolean))] as string[];
      if (authIds.length === 0) {
        setNameByAuthId({});
        setEquipeByAuthId({});
        return;
      }
      const [profRes, memRes] = await Promise.all([
        supabase.from("profiles").select("user_id, nome").in("user_id", authIds),
        supabase.from("team_members").select("user_id, nome, equipe").in("user_id", authIds),
      ]);
      const nameMap: Record<string, string> = {};
      const equipeMap: Record<string, string> = {};
      profRes.data?.forEach((p: any) => { if (p.user_id) nameMap[p.user_id] = p.nome; });
      memRes.data?.forEach((m: any) => {
        if (!m.user_id) return;
        if (!nameMap[m.user_id] && m.nome) nameMap[m.user_id] = m.nome;
        if (m.equipe) equipeMap[m.user_id] = m.equipe;
      });
      setNameByAuthId(nameMap);
      setEquipeByAuthId(equipeMap);
    })();
  }, [deals, visitasReal]);

  // Overlay indexado por negocio_id e por pipeline_lead_id
  const overrideByNegocio = useMemo(() => {
    const map: Record<string, PdnEntry> = {};
    for (const e of entries) if (e.negocio_id) map[e.negocio_id] = e;
    return map;
  }, [entries]);
  const overrideByLead = useMemo(() => {
    const map: Record<string, PdnEntry> = {};
    for (const e of entries) if (!e.negocio_id && e.pipeline_lead_id) map[e.pipeline_lead_id] = e;
    return map;
  }, [entries]);
  const manualRows = useMemo(() => entries.filter(e => !e.negocio_id && !e.pipeline_lead_id && e.mes === mes), [entries, mes]);

  const rows = useMemo<PdnRow[]>(() => {
    const out: PdnRow[] = [];

    // Linhas do pipeline (Em Negociação / Contrato / Ganho)
    for (const d of deals) {
      // Ganho: recorte por mês do fechamento. Em Negociação/Contrato: snapshot ao vivo.
      if (d.grupo === "ganho") {
        const refMes = mesOf(d.dataAssinatura || d.stageChangedAt);
        if (refMes !== mes) continue;
      }
      const ov = d.negocioId ? overrideByNegocio[d.negocioId] : overrideByLead[d.id];
      const data = d.grupo === "ganho" ? (d.dataAssinatura || d.stageChangedAt.slice(0, 10)) : d.stageChangedAt.slice(0, 10);
      const corretor = (d.corretorAuthId && nameByAuthId[d.corretorAuthId]) || ov?.corretor || "—";
      const equipe = (d.corretorAuthId && equipeByAuthId[d.corretorAuthId]) || ov?.equipe || "—";
      const proximaAcao = ov?.proxima_acao || "";
      const dias = diffDays(d.stageChangedAt);
      const caiu = !!ov?.caiu;
      const emRisco = !caiu && d.grupo !== "ganho" && !proximaAcao && dias > 7;
      out.push({
        id: `deal-${d.id}`,
        negocioId: d.negocioId,
        pipelineLeadId: d.id,
        overrideId: ov?.id ?? null,
        grupo: caiu ? "caidos" : d.grupo,
        grupoOrigem: d.grupo,
        nome: d.nome,
        data,
        empreendimento: ov?.empreendimento || d.empreendimento || "—",
        vgv: Number(ov?.vgv ?? d.vgv) || 0,
        situacaoLabel: PDN_GRUPOS.find(g => g.key === d.grupo)?.label || d.grupo,
        corretor,
        equipe,
        status: ov?.status || "",
        observacoes: ov?.observacoes ?? d.observacoesNegocio ?? "",
        proximaAcao,
        caiu,
        motivoQueda: ov?.motivo_queda || "",
        diasParado: dias,
        emRisco,
        isManual: false,
      });
    }

    // Visitas realizadas (sem negócio ativo)
    for (const v of visitasReal) {
      if (v.temNegocio) continue;
      const ov = v.leadId ? overrideByLead[v.leadId] : undefined;
      const corretor = (v.corretorAuthId && nameByAuthId[v.corretorAuthId]) || ov?.corretor || "—";
      const equipe = (v.corretorAuthId && equipeByAuthId[v.corretorAuthId]) || ov?.equipe || "—";
      const caiu = !!ov?.caiu;
      out.push({
        id: `visita-${v.id}`,
        negocioId: null,
        pipelineLeadId: v.leadId,
        overrideId: ov?.id ?? null,
        grupo: caiu ? "caidos" : "visita_realizada",
        grupoOrigem: "visita_realizada",
        nome: v.nome,
        data: v.data,
        empreendimento: ov?.empreendimento || v.empreendimento,
        vgv: Number(ov?.vgv ?? 0) || 0,
        situacaoLabel: "Visita realizada",
        corretor,
        equipe,
        status: ov?.status || "",
        observacoes: ov?.observacoes || "",
        proximaAcao: ov?.proxima_acao || "",
        caiu,
        motivoQueda: ov?.motivo_queda || "",
        diasParado: 0,
        emRisco: false,
        isManual: false,
      });
    }

    // Linhas manuais (sem vínculo com pipeline)
    for (const m of manualRows) {
      const base = (["visita_realizada", "em_negociacao", "contrato", "ganho"].includes(m.situacao) ? m.situacao : "em_negociacao") as PdnGrupo;
      const caiu = !!m.caiu;
      out.push({
        id: `manual-${m.id}`,
        negocioId: null,
        pipelineLeadId: null,
        overrideId: m.id,
        grupo: caiu ? "caidos" : base,
        grupoOrigem: base,
        nome: m.nome,
        data: m.data_visita || "",
        empreendimento: m.empreendimento || "—",
        vgv: Number(m.vgv) || 0,
        situacaoLabel: PDN_GRUPOS.find(g => g.key === base)?.label || m.situacao,
        corretor: m.corretor || "—",
        equipe: m.equipe || "—",
        status: m.status || "",
        observacoes: m.observacoes || "",
        proximaAcao: m.proxima_acao || "",
        caiu,
        motivoQueda: m.motivo_queda || "",
        diasParado: 0,
        emRisco: false,
        isManual: true,
      });
    }

    return out;
  }, [deals, visitasReal, manualRows, overrideByNegocio, overrideByLead, nameByAuthId, equipeByAuthId, mes]);

  // ── Overlay: grava só em pdn_entries (nunca no pipeline/negócio) ──────────────
  const saveOverride = useCallback(async (row: PdnRow, patch: Partial<Pick<PdnRow, "observacoes" | "proximaAcao" | "status" | "caiu" | "motivoQueda">>) => {
    if (!user) return;
    const payload: Record<string, any> = {};
    if (patch.observacoes !== undefined) payload.observacoes = patch.observacoes || null;
    if (patch.proximaAcao !== undefined) payload.proxima_acao = patch.proximaAcao || null;
    if (patch.status !== undefined) payload.status = patch.status || null;
    if (patch.caiu !== undefined) payload.caiu = patch.caiu;
    if (patch.motivoQueda !== undefined) payload.motivo_queda = patch.motivoQueda || null;

    if (row.overrideId) {
      const { error } = await supabase.from("pdn_entries").update(payload).eq("id", row.overrideId);
      if (error) { toast.error("Erro ao salvar"); return; }
    } else {
      const { error } = await supabase.from("pdn_entries").insert({
        gerente_id: user.id,
        negocio_id: row.negocioId,
        pipeline_lead_id: row.negocioId ? null : row.pipelineLeadId,
        mes,
        nome: row.nome,
        situacao: row.grupoOrigem,
        empreendimento: row.empreendimento === "—" ? null : row.empreendimento,
        vgv: row.vgv,
        corretor: row.corretor === "—" ? null : row.corretor,
        equipe: row.equipe === "—" ? null : row.equipe,
        ...payload,
      });
      if (error) { toast.error("Erro ao salvar"); return; }
    }
    await loadEntries();
  }, [user, mes, loadEntries]);

  // ── Marcar / reverter queda ("caiu") — só no overlay ─────────────────────────
  const marcarQueda = useCallback(async (row: PdnRow, motivo: string) => {
    await saveOverride(row, { caiu: true, motivoQueda: motivo });
  }, [saveOverride]);

  const reativarQueda = useCallback(async (row: PdnRow) => {
    await saveOverride(row, { caiu: false, motivoQueda: "" });
  }, [saveOverride]);

  // ── Linha manual (CRUD completo) ─────────────────────────────────────────────
  const addManualRow = useCallback(async (grupo: PdnGrupo) => {
    if (!user) return;
    const { error } = await supabase.from("pdn_entries").insert({
      gerente_id: user.id,
      mes,
      nome: "Novo negócio",
      situacao: grupo === "caidos" ? "em_negociacao" : grupo,
    });
    if (error) { toast.error("Erro ao adicionar linha"); return; }
    await loadEntries();
  }, [user, mes, loadEntries]);

  const updateManualRow = useCallback(async (overrideId: string, patch: Record<string, any>) => {
    const { error } = await supabase.from("pdn_entries").update(patch).eq("id", overrideId);
    if (error) { toast.error("Erro ao salvar"); return; }
    await loadEntries();
  }, [loadEntries]);

  const deleteRow = useCallback(async (overrideId: string) => {
    const { error } = await supabase.from("pdn_entries").delete().eq("id", overrideId);
    if (error) { toast.error("Erro ao excluir"); return; }
    await loadEntries();
  }, [loadEntries]);

  // ── Totais / resumo (não conta caídos no VGV/forecast) ───────────────────────
  const resumo = useMemo(() => {
    const byGrupo: Record<PdnGrupo, { count: number; vgv: number }> = {
      visita_realizada: { count: 0, vgv: 0 },
      em_negociacao: { count: 0, vgv: 0 },
      contrato: { count: 0, vgv: 0 },
      ganho: { count: 0, vgv: 0 },
      caidos: { count: 0, vgv: 0 },
    };
    let forecast = 0;
    let emRisco = 0;
    for (const r of rows) {
      byGrupo[r.grupo].count++;
      byGrupo[r.grupo].vgv += r.vgv;
      if (r.grupo !== "caidos") forecast += r.vgv * (PROB_POR_GRUPO[r.grupo] ?? 0.3);
      if (r.emRisco) emRisco++;
    }
    const vgvTotal = byGrupo.em_negociacao.vgv + byGrupo.contrato.vgv + byGrupo.ganho.vgv;
    return { byGrupo, vgvTotal, forecast, emRisco, total: rows.length };
  }, [rows]);

  return {
    rows,
    resumo,
    loading: loadingDeals || loadingEntries,
    saveOverride,
    marcarQueda,
    reativarQueda,
    addManualRow,
    updateManualRow,
    deleteRow,
    reload: loadEntries,
  };
}
