import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import {
  syncPipelineStageFromPdn, syncNegocioVgvFromPdn,
  discardLeadFromPdn, inactivateLeadFromPdn,
  type PdnDestino,
} from "@/lib/pdnSyncEngine";
export type { PdnDestino };


// ─── Grupos / status do PDN ──────────────────────────────────────────────────
export type PdnGrupo = "pos_visita" | "em_negociacao" | "contrato" | "ganho" | "caidos";

export const PDN_GRUPOS: { key: PdnGrupo; label: string; cor: string }[] = [
  { key: "pos_visita", label: "Pós-Visita", cor: "#06B6D4" },
  { key: "em_negociacao", label: "Em Negociação", cor: "#EC4899" },
  { key: "contrato", label: "Contrato", cor: "#0891B2" },
  { key: "ganho", label: "Ganho", cor: "#22C55E" },
  { key: "caidos", label: "Caídos", cor: "#EF4444" },
];

// Probabilidade ponderada por grupo (para forecast)
const PROB_POR_GRUPO: Record<PdnGrupo, number> = {
  pos_visita: 0.2,
  em_negociacao: 0.5,
  contrato: 0.8,
  ganho: 1,
  caidos: 0,
};

// Etapas do pipeline (pipeline_stages.tipo) → grupo do PDN
const STAGE_TIPO_TO_GRUPO: Record<string, PdnGrupo> = {
  pos_visita: "pos_visita",
  proposta: "em_negociacao",
  contrato_gerado: "contrato",
  venda: "ganho",
};

const GRUPO_KEYS: PdnGrupo[] = ["pos_visita", "em_negociacao", "contrato", "ganho", "caidos"];

// Normaliza qualquer código de situação (inclui formatos legados) para um grupo do PDN.
function normalizeGrupo(situacao: string | null | undefined): PdnGrupo {
  const s = (situacao || "").toLowerCase().trim();
  if (GRUPO_KEYS.includes(s as PdnGrupo)) return s as PdnGrupo;
  switch (s) {
    case "visita_realizada": case "visita": return "pos_visita";
    case "proposta": return "em_negociacao";
    case "gerado": case "em_confeccao": case "contrato_gerado": return "contrato";
    case "assinado": case "venda": case "vendido": return "ganho";
    case "caiu": case "perdido": return "caidos";
    default: return "em_negociacao";
  }
}

const GRUPO_LABEL: Record<PdnGrupo, string> = {
  pos_visita: "Pós-Visita",
  em_negociacao: "Em Negociação",
  contrato: "Contrato",
  ganho: "Ganho",
  caidos: "Caídos",
};

function mesOf(dateStr: string): string {
  return (dateStr || "").slice(0, 7); // YYYY-MM
}

export interface PdnRow {
  id: string;                 // chave única da linha
  negocioId: string | null;   // negocios.id (se houver)
  pipelineLeadId: string | null; // pipeline_leads.id (fonte)
  corretorAuthId: string | null; // auth id do corretor (para avisar)
  overrideId: string | null;  // pdn_entries.id do overlay (se houver)
  grupo: PdnGrupo;            // etapa do pipeline (fonte única)
  grupoOrigem: PdnGrupo;      // idem — mantido por compatibilidade de leitura
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
  // ── Camada de gestão do gestor (interna) ──
  proximaAcaoData: string;   // YYYY-MM-DD
  prioridade: "alta" | "media" | "baixa" | "";
  riscoManual: boolean;
  riscoMotivo: string;
  proximaAcaoVencida: boolean;
  novoDesdeOntem: boolean;
  avisadoEm: string | null;  // quando o gestor avisou o corretor
  avisadoEtapa: string | null;
  etapaAtualLabel: string;   // etapa atual no pipeline
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
  proxima_acao_data: string | null;
  prioridade: string | null;
  risco_manual: boolean | null;
  risco_motivo: string | null;
  oculto: boolean | null;
  grupo_override: string | null;
  corretor_avisado_em: string | null;
  corretor_avisado_etapa: string | null;
  updated_at: string | null;
};

const MS_DAY = 86400000;
function isNovoDesdeOntem(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= MS_DAY;
}
function isVencida(dateStr: string): boolean {
  if (!dateStr) return false;
  const t = new Date(`${dateStr}T23:59:59`).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

function diffDays(dateStr: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / 86400000);
}


/**
 * As marcações do gestor (`caiu` / `oculto`) valem apenas para o mês em que foram
 * feitas e são descartadas automaticamente quando o negócio mudou de etapa depois
 * da marcação — evita negócio ativo sumir do PDN para sempre.
 */
function overlayMarcasAtivas(
  ov: { mes?: string | null; updated_at?: string | null } | undefined,
  mes: string,
  stageChangedAt: string | null | undefined,
): boolean {
  if (!ov) return false;
  if (ov.mes !== mes) return false;
  if (ov.updated_at && stageChangedAt) {
    const marcado = new Date(ov.updated_at).getTime();
    const mudou = new Date(stageChangedAt).getTime();
    if (Number.isFinite(marcado) && Number.isFinite(mudou) && mudou > marcado) return false;
  }
  return true;
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
  primeiraVendaEm: string | null; // 1ª entrada na etapa de venda (histórico) — fallback estável
  observacoesNegocio: string;
  negocioVendido: boolean; // negocios.fase === 'ganho' (fonte de Vendas Realizadas)
}

// Venda do mês (negocios.fase='ganho') — usada como fallback para o PDN mostrar
// SEMPRE como Ganho, mesmo que a etapa do lead no pipeline esteja atrasada ou o lead
// esteja arquivado. Garante PDN Ganho == Vendas Realizadas.
interface VendaMes {
  negocioId: string;
  pipelineLeadId: string | null;
  nome: string;
  empreendimento: string;
  vgv: number;
  dataAssinatura: string;
  corretorAuthId: string | null;
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
  // Marca que já concluímos o 1º load — refreshes seguintes rodam silenciosamente,
  // sem piscar a UI com o spinner de tela cheia (evita o "refresh infinito" no PDN).
  const dealsLoadedOnceRef = useRef(false);
  const entriesLoadedOnceRef = useRef(false);
  // Escopo de corretores resolvido (auth ids). undefined = ainda não resolvido; null = todos.
  const [scopeAuthIds, setScopeAuthIds] = useState<string[] | null | undefined>(undefined);
  const [vendasMes, setVendasMes] = useState<VendaMes[]>([]);
  const [gestorNames, setGestorNames] = useState<Record<string, string>>({});

  // ── Overlay do gerente (pdn_entries) ─────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    if (!user) return;
    if (!entriesLoadedOnceRef.current) setLoadingEntries(true);
    const { data, error } = await supabase
      .from("pdn_entries")
      .select("id, negocio_id, pipeline_lead_id, gerente_id, mes, nome, situacao, empreendimento, vgv, corretor, equipe, data_visita, status, observacoes, proxima_acao, caiu, motivo_queda, proxima_acao_data, prioridade, risco_manual, risco_motivo, oculto, grupo_override, corretor_avisado_em, corretor_avisado_etapa, updated_at")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Erro ao carregar PDN:", error);
      setLoadingEntries(false);
      entriesLoadedOnceRef.current = true;
      return;
    }
    setEntries((data || []) as PdnEntry[]);
    setLoadingEntries(false);
    entriesLoadedOnceRef.current = true;
  }, [user]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // ── Fonte única: pipeline_leads (Em Negociação / Contrato / Ganho) ───────────
  const loadDeals = useCallback(async () => {
    if (!user) return;
    if (!dealsLoadedOnceRef.current) setLoadingDeals(true);

    // Escopo de corretores (auth ids)
    let corretorAuthIds: string[] | null = null; // null = admin/diretor/CEO (todas as equipes)
    if (!isAdmin && !isDiretor) {
      if (isGestor) {
        const { data: managed } = await supabase.rpc("resolve_managed_brokers", { _gestor: user.id });
        const ids = (managed || []).map((m: { user_id: string }) => m.user_id).filter(Boolean) as string[];
        if (!ids.includes(user.id)) ids.push(user.id);
        corretorAuthIds = ids;
      } else {
        corretorAuthIds = [user.id];
      }
    }
    setScopeAuthIds(corretorAuthIds);

    // Etapas de negócio do pipeline
    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, tipo")
      .in("tipo", ["pos_visita", "proposta", "contrato_gerado", "venda"]);
    const stageGrupo: Record<string, PdnGrupo> = {};
    for (const s of stages || []) stageGrupo[(s as any).id] = STAGE_TIPO_TO_GRUPO[(s as any).tipo];
    const stageIds = Object.keys(stageGrupo);

    if (stageIds.length === 0) {
      setDeals([]);
      setLoadingDeals(false);
      dealsLoadedOnceRef.current = true;
      return;
    }

    let leadQuery = supabase
      .from("pipeline_leads")
      .select("id, nome, corretor_id, stage_id, stage_changed_at, updated_at")
      .in("stage_id", stageIds)
      .eq("arquivado", false)
      .limit(2000);
    if (corretorAuthIds) {
      if (corretorAuthIds.length === 0) { setDeals([]); setLoadingDeals(false); dealsLoadedOnceRef.current = true; return; }
      leadQuery = leadQuery.in("corretor_id", corretorAuthIds);
    }
    const { data: leads, error: leadErr } = await leadQuery;
    if (leadErr) {
      console.error("Erro ao carregar pipeline do PDN:", leadErr);
      setLoadingDeals(false);
      dealsLoadedOnceRef.current = true;
      return;
    }

    const leadIds = (leads || []).map((l: any) => l.id);
    // Negócios vinculados (VGV / empreendimento / assinatura)
    const negocioByLead: Record<string, any> = {};
    if (leadIds.length > 0) {
      const { data: negs } = await supabase
        .from("negocios")
        .select("id, pipeline_lead_id, empreendimento, vgv_final, vgv_estimado, data_assinatura, observacoes, status, fase")
        .in("pipeline_lead_id", leadIds);
      for (const n of negs || []) {
        if ((n as any).status === "perdido") continue;
        negocioByLead[(n as any).pipeline_lead_id] = n;
      }
    }

    // 1ª entrada na etapa de venda (Ganho), lida do histórico — fallback estável para o mês
    const vendaStageIds = Object.keys(stageGrupo).filter((sid) => stageGrupo[sid] === "ganho");
    const primeiraVendaByLead: Record<string, string> = {};
    if (leadIds.length > 0 && vendaStageIds.length > 0) {
      const { data: hist } = await supabase
        .from("pipeline_historico")
        .select("pipeline_lead_id, created_at, stage_novo_id")
        .in("pipeline_lead_id", leadIds)
        .in("stage_novo_id", vendaStageIds)
        .order("created_at", { ascending: true });
      for (const h of hist || []) {
        const lid = (h as any).pipeline_lead_id;
        if (!primeiraVendaByLead[lid]) primeiraVendaByLead[lid] = (h as any).created_at;
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
        primeiraVendaEm: primeiraVendaByLead[l.id] || null,
        observacoesNegocio: n?.observacoes || "",
        negocioVendido: n?.fase === "ganho",
      };
    });
    setDeals(dealRows);
    setLoadingDeals(false);
    dealsLoadedOnceRef.current = true;
  }, [user, isAdmin, isGestor, isDiretor]);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  // ── Vendas do mês (negocios.fase='ganho') — garante PDN Ganho == Vendas Realizadas ──
  // Cobre casos onde o lead está arquivado ou com etapa atrasada no pipeline.
  useEffect(() => {
    if (!user || scopeAuthIds === undefined) return;
    (async () => {
      const inicio = `${mes}-01`;
      const [ano, m] = mes.split("-").map(Number);
      const fim = new Date(ano, m, 0).toISOString().slice(0, 10);
      const { data: negs, error } = await supabase
        .from("negocios")
        .select("id, pipeline_lead_id, nome_cliente, empreendimento, vgv_final, vgv_estimado, data_assinatura, observacoes, fase, status")
        .eq("fase", "ganho")
        .neq("status", "perdido")
        .gte("data_assinatura", inicio)
        .lte("data_assinatura", fim)
        .limit(2000);
      if (error) { console.error("Erro ao carregar vendas do PDN:", error); return; }

      const leadIds = [...new Set((negs || []).map((n: any) => n.pipeline_lead_id).filter(Boolean))] as string[];
      // corretor (auth id) do lead vinculado — ignora arquivado/etapa de propósito
      const corretorByLead: Record<string, string | null> = {};
      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("pipeline_leads")
          .select("id, corretor_id")
          .in("id", leadIds);
        for (const l of leads || []) corretorByLead[(l as any).id] = (l as any).corretor_id || null;
      }

      const rows: VendaMes[] = [];
      for (const n of negs || []) {
        const leadId = (n as any).pipeline_lead_id as string | null;
        const corretorAuthId = leadId ? (corretorByLead[leadId] ?? null) : null;
        // Aplica o mesmo escopo do PDN (por corretor). Sem lead vinculado só entra p/ admin/diretor.
        if (scopeAuthIds !== null) {
          if (!corretorAuthId || !scopeAuthIds.includes(corretorAuthId)) continue;
        }
        rows.push({
          negocioId: (n as any).id,
          pipelineLeadId: leadId,
          nome: (n as any).nome_cliente || "—",
          empreendimento: (n as any).empreendimento || "—",
          vgv: Number((n as any).vgv_final ?? (n as any).vgv_estimado ?? 0) || 0,
          dataAssinatura: (n as any).data_assinatura,
          corretorAuthId,
          observacoesNegocio: (n as any).observacoes || "",
        });
      }
      setVendasMes(rows);
    })();
  }, [user, mes, scopeAuthIds]);


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

  // Nomes dos gestores que criaram overlays (para o painel de removidos)
  useEffect(() => {
    const ids = [...new Set(entries.map(e => e.gerente_id).filter(Boolean))] as string[];
    if (ids.length === 0) { setGestorNames({}); return; }
    (async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids);
      const map: Record<string, string> = {};
      for (const p of data || []) if ((p as any).user_id) map[(p as any).user_id] = (p as any).nome;
      setGestorNames(map);
    })();
  }, [entries]);

  // Overlay indexado por negocio_id e por pipeline_lead_id
  // Overlay indexado por negocio_id e por pipeline_lead_id — SEMPRE recortado pelo mês
  // selecionado (sem isso, uma nota de julho aparecia/era gravada em agosto).
  const entriesDoMes = useMemo(() => entries.filter(e => e.mes === mes), [entries, mes]);
  const overrideByNegocio = useMemo(() => {
    const map: Record<string, PdnEntry> = {};
    for (const e of entriesDoMes) if (e.negocio_id) map[e.negocio_id] = e;
    return map;
  }, [entriesDoMes]);
  const overrideByLead = useMemo(() => {
    const map: Record<string, PdnEntry> = {};
    for (const e of entriesDoMes) if (!e.negocio_id && e.pipeline_lead_id) map[e.pipeline_lead_id] = e;
    return map;
  }, [entriesDoMes]);


  const mesAtual = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const allRows = useMemo<PdnRow[]>(() => {
    const out: PdnRow[] = [];
    const isMesCorrente = mes === mesAtual;

    // Linhas do pipeline (Em Negociação / Contrato / Ganho)
    for (const d of deals) {
      const ov = d.negocioId ? overrideByNegocio[d.negocioId] : overrideByLead[d.id];
      // Vendido conta SEMPRE como Ganho, mesmo que a etapa do pipeline esteja atrasada.
      const isGanho = d.grupo === "ganho" || d.negocioVendido;
      // Ganho: recorte por mês do fechamento. Em Negociação/Contrato: só no mês corrente
      // (ou em mês passado se o gestor registrou algo naquele mês) — evita vazar entre meses.
      const ganhoRef = isGanho ? (d.dataAssinatura || d.primeiraVendaEm) : null;
      if (isGanho) {
        if (!ganhoRef) continue;           // sem data confiável: fora do recorte mensal
        if (mesOf(ganhoRef) !== mes) continue;
      } else {
        if (!isMesCorrente && ov?.mes !== mes) continue;
      }
      const grupoNatural: PdnGrupo = isGanho ? "ganho" : d.grupo;
      // PDN é espelho do pipeline: a etapa, o VGV e o empreendimento vêm SEMPRE
      // do pipeline/negócio. O overlay do gestor guarda apenas notas internas.
      const grupoBase = grupoNatural;
      const data = isGanho ? (ganhoRef as string).slice(0, 10) : d.stageChangedAt.slice(0, 10);
      const corretor = (d.corretorAuthId && nameByAuthId[d.corretorAuthId]) || "—";
      const equipe = (d.corretorAuthId && equipeByAuthId[d.corretorAuthId]) || "—";
      const proximaAcao = ov?.proxima_acao || "";
      const proximaAcaoData = ov?.proxima_acao_data || "";
      const observacoesRow = (ov?.observacoes ?? d.observacoesNegocio ?? "").toString().trim();
      const dias = diffDays(d.stageChangedAt);
      const riscoManual = !!ov?.risco_manual;
      // Sinais de "foi tocado recentemente": próxima ação, observações preenchidas,
      // ou edição manual no override do PDN nos últimos 7 dias. Qualquer um zera o risco automático.
      const foiEditadoRecente = !!ov?.updated_at && diffDays(ov.updated_at) <= 7;
      const temSinalDeAtualizacao = !!proximaAcao || !!observacoesRow || foiEditadoRecente;
      const emRisco = riscoManual || (grupoBase !== "ganho" && !temSinalDeAtualizacao && dias > 7);
      out.push({
        id: `deal-${d.id}`,
        negocioId: d.negocioId,
        pipelineLeadId: d.id,
        corretorAuthId: d.corretorAuthId,
        overrideId: ov?.id ?? null,
        grupo: grupoBase,
        grupoOrigem: grupoNatural,
        grupoOverride: null,
        etapaAjustada: false,
        nome: d.nome,
        data,
        empreendimento: d.empreendimento || "—",
        vgv: Number(d.vgv) || 0,
        situacaoLabel: GRUPO_LABEL[grupoBase],
        corretor,
        equipe,
        status: ov?.status || "",
        observacoes: ov?.observacoes ?? d.observacoesNegocio ?? "",
        proximaAcao,
        caiu: false,
        motivoQueda: "",
        diasParado: dias,
        emRisco,
        isManual: false,
        proximaAcaoData,
        prioridade: (ov?.prioridade as PdnRow["prioridade"]) || "",
        riscoManual,
        riscoMotivo: ov?.risco_motivo || "",
        proximaAcaoVencida: isVencida(proximaAcaoData),
        novoDesdeOntem: isNovoDesdeOntem(d.stageChangedAt),
        oculto: false,
        avisadoEm: ov?.corretor_avisado_em ?? null,
        avisadoEtapa: ov?.corretor_avisado_etapa ?? null,
        ocultoEm: null,
        ocultoPor: "",
        etapaAtualLabel: GRUPO_LABEL[grupoNatural],
      });

    }

    // Fallback: vendas do mês (negocios.fase='ganho') cujo lead está arquivado ou
    // com etapa atrasada e portanto NÃO veio em `deals`. Garante PDN Ganho == Vendas Realizadas.
    const negocioIdsNoOut = new Set(out.map(r => r.negocioId).filter(Boolean) as string[]);
    for (const vd of vendasMes) {
      if (vd.negocioId && negocioIdsNoOut.has(vd.negocioId)) continue; // já representado por um deal
      const ov = overrideByNegocio[vd.negocioId] || (vd.pipelineLeadId ? overrideByLead[vd.pipelineLeadId] : undefined);
      const corretor = (vd.corretorAuthId && nameByAuthId[vd.corretorAuthId]) || "—";
      const equipe = (vd.corretorAuthId && equipeByAuthId[vd.corretorAuthId]) || "—";
      const grupoBase: PdnGrupo = "ganho";
      out.push({
        id: `venda-${vd.negocioId}`,
        negocioId: vd.negocioId,
        pipelineLeadId: vd.pipelineLeadId,
        corretorAuthId: vd.corretorAuthId,
        overrideId: ov?.id ?? null,
        grupo: grupoBase,
        grupoOrigem: "ganho",
        grupoOverride: null,
        etapaAjustada: false,
        nome: vd.nome,
        data: (vd.dataAssinatura || "").slice(0, 10),
        empreendimento: vd.empreendimento || "—",
        vgv: Number(vd.vgv) || 0,
        situacaoLabel: GRUPO_LABEL[grupoBase],
        corretor,
        equipe,
        status: ov?.status || "",
        observacoes: ov?.observacoes ?? vd.observacoesNegocio ?? "",
        proximaAcao: ov?.proxima_acao || "",
        caiu: false,
        motivoQueda: "",
        diasParado: 0,
        emRisco: false,
        isManual: false,
        proximaAcaoData: ov?.proxima_acao_data || "",
        prioridade: (ov?.prioridade as PdnRow["prioridade"]) || "",
        riscoManual: !!ov?.risco_manual,
        riscoMotivo: ov?.risco_motivo || "",
        proximaAcaoVencida: false,
        novoDesdeOntem: isNovoDesdeOntem(vd.dataAssinatura),
        oculto: false,
        avisadoEm: ov?.corretor_avisado_em ?? null,
        avisadoEtapa: ov?.corretor_avisado_etapa ?? null,
        ocultoEm: null,
        ocultoPor: "",
        etapaAtualLabel: GRUPO_LABEL["ganho"],
      });
    }


    // NOTA: Visitas realizadas do mês NÃO geram mais linhas próprias no PDN Pós-Visita.
    // A fonte única do grupo Pós-Visita é `pipeline_leads` em stage `pos_visita` (via `deals` acima).
    // Para conferência de visitas do mês (incluindo as que já avançaram/regrediram/caíram),
    // use a aba "Conferência de Visitas" (useConferenciaVisitas).

    // NOTA: linhas manuais (pdn_entries sem vínculo com pipeline) NÃO são mais
    // exibidas — o PDN é espelho do pipeline. Negócio só entra na planilha se
    // existir no pipeline. O card "Divergências" aponta os casos a reconciliar.

    return out;
  }, [deals, vendasMes, overrideByNegocio, overrideByLead, nameByAuthId, equipeByAuthId, mes, mesAtual]);



  // O PDN mostra tudo que está no pipeline — nada é escondido por overlay.
  const rows = allRows;
  const hiddenRows = useMemo<PdnRow[]>(() => [], []);

  // ── Overlay: SOMENTE anotações internas do gestor (pdn_entries) ───────────────
  // Etapa, VGV, empreendimento, corretor e queda vêm do pipeline — nunca daqui.
  const saveOverride = useCallback(async (row: PdnRow, patch: Partial<Pick<PdnRow, "observacoes" | "proximaAcao" | "status" | "proximaAcaoData" | "prioridade" | "riscoManual" | "riscoMotivo" | "avisadoEm" | "avisadoEtapa">>): Promise<boolean> => {
    if (!user) return false;
    const payload: Record<string, any> = {};
    if (patch.observacoes !== undefined) payload.observacoes = patch.observacoes || null;
    if (patch.proximaAcao !== undefined) payload.proxima_acao = patch.proximaAcao || null;
    if (patch.status !== undefined) payload.status = patch.status || null;
    if (patch.proximaAcaoData !== undefined) payload.proxima_acao_data = patch.proximaAcaoData || null;
    if (patch.prioridade !== undefined) payload.prioridade = patch.prioridade || null;
    if (patch.riscoManual !== undefined) payload.risco_manual = patch.riscoManual;
    if (patch.riscoMotivo !== undefined) payload.risco_motivo = patch.riscoMotivo || null;
    if (patch.avisadoEm !== undefined) payload.corretor_avisado_em = patch.avisadoEm || null;
    if (patch.avisadoEtapa !== undefined) payload.corretor_avisado_etapa = patch.avisadoEtapa || null;
    if (Object.keys(payload).length === 0) return false;
    payload.updated_at = new Date().toISOString();

    const insertRow = async () => {
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
      if (error) { toast.error(`Erro ao salvar: ${error.message}`); return false; }
      return true;
    };

    let ok: boolean;
    if (row.overrideId) {
      // `.select("id")` é obrigatório: sem ele, um UPDATE bloqueado por RLS afeta 0
      // linhas e retorna sucesso — o gestor via "salvo" sem nada ter sido gravado.
      const { data, error } = await supabase
        .from("pdn_entries").update(payload).eq("id", row.overrideId).select("id");
      if (error) { toast.error(`Erro ao salvar: ${error.message}`); return false; }
      ok = (data?.length ?? 0) > 0 ? true : await insertRow();
    } else {
      ok = await insertRow();
    }
    if (!ok) return false;
    await loadEntries();
    return true;
  }, [user, mes, loadEntries]);

  // ── Empreendimento / VGV: gravam no NEGÓCIO real (fonte única), nunca no overlay ──
  const saveNegocioCampos = useCallback(async (
    row: PdnRow,
    patch: { vgv?: number; empreendimento?: string },
  ): Promise<boolean> => {
    if (!row.negocioId) {
      toast.error("Sem negócio vinculado — abra o lead para criar o negócio antes de editar VGV/empreendimento.");
      return false;
    }
    const ok = await syncNegocioVgvFromPdn(
      row,
      patch.vgv ?? null,
      patch.empreendimento !== undefined ? patch.empreendimento : null,
    );
    if (!ok) return false;
    toast.success("Negócio atualizado.");
    await loadDeals();
    return true;
  }, [loadDeals]);



  // ── Marcar queda — age NO PIPELINE (descarte real do lead), não no overlay ────
  const marcarQueda = useCallback(async (row: PdnRow, motivo: string) => {
    if (!row.pipelineLeadId && !row.negocioId) {
      toast.error("Sem lead vinculado — corrija a divergência antes de marcar queda.");
      return;
    }
    const ok = await discardLeadFromPdn(row, motivo, user?.id ?? null);
    if (!ok) return;
    if (row.pipelineLeadId) {
      try {
        await supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: row.pipelineLeadId,
          tipo: "pdn_risco",
          titulo: "PDN: negócio marcado como caiu",
          descricao: motivo || "Sem motivo informado",
          status: "concluida",
          created_by: user?.id ?? null,
        });
      } catch { /* não bloqueia a ação */ }
    }
    await Promise.all([loadDeals(), loadEntries()]);
  }, [user, loadDeals, loadEntries]);

  // ── Mudar etapa no PDN — escreve sempre no pipeline real ──────────────────────
  const mudarEtapa = useCallback(async (row: PdnRow, grupo: PdnDestino | "caidos", opts?: { motivo?: string }) => {
    if (grupo === "caidos") { await marcarQueda(row, opts?.motivo || ""); return; }
    if (!row.pipelineLeadId && !row.negocioId) {
      toast.error("Sem lead vinculado no pipeline — não é possível mover a etapa.");
      return;
    }
    const isPreVisita = grupo === "qualificacao" || grupo === "aquecimento";
    const result = await syncPipelineStageFromPdn(row, grupo, user?.id ?? null, opts);
    if (!result) return;
    // Alinha a nota do gestor com a nova etapa e garante o vínculo com o lead real.
    if (row.overrideId && !isPreVisita) {
      const patch: Record<string, unknown> = {
        situacao: grupo,
        updated_at: new Date().toISOString(),
      };
      if (result.pipelineLeadId && !row.pipelineLeadId) patch.pipeline_lead_id = result.pipelineLeadId;
      if (result.negocioId && !row.negocioId) patch.negocio_id = result.negocioId;
      const { error } = await supabase.from("pdn_entries").update(patch).eq("id", row.overrideId);
      if (error) console.warn("[usePdn] sincronizar pdn_entry falhou", error);
    }
    await Promise.all([loadDeals(), loadEntries()]);
  }, [marcarQueda, loadEntries, loadDeals, user?.id]);


  // ── Descartar (reengajável) via PDN → altera lead real ────────────────────────
  const descartarLead = useCallback(async (row: PdnRow, motivo: string) => {
    const ok = await discardLeadFromPdn(row, motivo, user?.id ?? null);
    if (!ok) return;
    await Promise.all([loadDeals(), loadEntries()]);
  }, [user?.id, loadDeals, loadEntries]);

  // ── Inativar definitivo via PDN → arquiva lead real ───────────────────────────
  const inativarLead = useCallback(async (row: PdnRow, motivo: string) => {
    const ok = await inactivateLeadFromPdn(row, motivo);
    if (!ok) return;
    await Promise.all([loadDeals(), loadEntries()]);
  }, [loadDeals, loadEntries]);



  // ── Avisar corretor (notificação no app) — não altera o pipeline ─────────────
  const avisarCorretor = useCallback(async (row: PdnRow, mensagem: string) => {
    if (!row.corretorAuthId) { toast.error("Sem corretor vinculado a este negócio."); return; }
    const etapaLabel = GRUPO_LABEL[row.grupo];
    const { error } = await supabase.rpc("criar_notificacao", {
      p_user_id: row.corretorAuthId,
      p_tipo: "pdn",
      p_categoria: "pdn_atualizacao",
      p_titulo: `Atualização do gestor: ${row.nome}`,
      p_mensagem: mensagem || `Atualize o pipeline de ${row.nome} para "${etapaLabel}".`,
      p_dados: {
        pipeline_lead_id: row.pipelineLeadId,
        pdn_lead_id: row.pipelineLeadId,
        etapa_sugerida: row.grupo,
        etapa_sugerida_label: etapaLabel,
        empreendimento: row.empreendimento,
      },
    });
    if (error) { toast.error("Erro ao avisar o corretor"); return; }
    await saveOverride(row, { avisadoEm: new Date().toISOString(), avisadoEtapa: row.grupo });
    toast.success("Corretor avisado no app.");
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

  // ── Possíveis duplicados: mesmo cliente do pipeline em mais de uma etapa ──────
  const duplicados = useMemo(() => {
    const map: Record<string, PdnRow[]> = {};
    for (const r of rows) {
      if (r.isManual || !r.pipelineLeadId) continue;
      const key = `${r.nome.toLowerCase().trim()}|${r.corretor.toLowerCase().trim()}`;
      (map[key] ||= []).push(r);
    }
    return Object.values(map)
      .filter(list => new Set(list.map(r => r.pipelineLeadId)).size > 1)
      .map(list => ({
        nome: list[0].nome,
        corretor: list[0].corretor,
        etapas: list.map(r => ({ id: r.id, etapa: GRUPO_LABEL[r.grupo], vgv: r.vgv })),
      }));
  }, [rows]);

  // ── Totais / resumo (não conta caídos no VGV/forecast) ───────────────────────
  const resumo = useMemo(() => {
    const byGrupo: Record<PdnGrupo, { count: number; vgv: number }> = {
      pos_visita: { count: 0, vgv: 0 },
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

  // Recarrega tudo: pipeline (últimos negócios por etapa) + overlay do gestor
  const refreshAll = useCallback(async () => {
    await Promise.all([loadDeals(), loadEntries()]);
  }, [loadDeals, loadEntries]);

  return {
    rows,
    hiddenRows,
    scopeAuthIds,
    resumo,
    duplicados,
    loading: loadingDeals || loadingEntries,
    refreshAll,
    saveOverride,
    marcarQueda,
    mudarEtapa,

    avisarCorretor,
    descartarLead,
    inativarLead,
    addManualRow,
    updateManualRow,
    deleteRow,
    reload: loadEntries,
  };
}
