import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RankingFilters {
  start?: string; // YYYY-MM-DD inclusive
  end?: string;   // YYYY-MM-DD inclusive
  equipeId?: string; // gerente auth_user_id
  corretorId?: string; // optional highlight
}

export interface CorretorBase {
  user_id: string;
  nome: string;
  gerente_id?: string | null;
  gerente_nome?: string | null;
}

// ------- Helpers (BRT timezone) -------
function toIsoStart(d?: string) { return d ? `${d}T00:00:00-03:00` : undefined; }
function toIsoEnd(d?: string) { return d ? `${d}T23:59:59-03:00` : undefined; }

/** Pagina automaticamente para evitar o limite default de 1000 do PostgREST. */
async function fetchAllPaged<T = any>(buildQuery: () => any, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  // Hard cap defensivo (50k linhas)
  for (let i = 0; i < 50; i++) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data || []) as T[];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function fetchCorretores(filters: RankingFilters): Promise<CorretorBase[]> {
  let q = supabase.from("team_members").select("user_id, gerente_id").eq("status", "ativo");
  if (filters.equipeId) q = q.eq("gerente_id", filters.equipeId);
  const { data: tm } = await q;
  const userIds = [...new Set((tm || []).map(t => t.user_id).filter(Boolean) as string[])];
  const gerenteIds = [...new Set((tm || []).map(t => t.gerente_id).filter(Boolean) as string[])];
  if (userIds.length === 0) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, nome")
    .in("user_id", [...userIds, ...gerenteIds]);
  const nameMap = new Map<string, string>((profs || []).map(p => [p.user_id as string, (p.nome as string) || "—"]));
  return userIds.map(uid => {
    const link = (tm || []).find(t => t.user_id === uid);
    return {
      user_id: uid,
      nome: nameMap.get(uid) || "—",
      gerente_id: link?.gerente_id || null,
      gerente_nome: link?.gerente_id ? (nameMap.get(link.gerente_id) || null) : null,
    } as CorretorBase;
  });
}

// ====== 1. Presenças & Leads ======
export interface PresencasLeadsRow extends CorretorBase {
  presencas_diurna: number;
  presencas_noturna: number;
  presencas_domingo: number;
  presencas_total: number;
  leads_recebidos: number;
}

async function fetchPresencasLeads(filters: RankingFilters, corretores: CorretorBase[]): Promise<PresencasLeadsRow[]> {
  const ids = corretores.map(c => c.user_id);
  if (ids.length === 0) return [];
  const start = filters.start;
  const end = filters.end;

  const [creds, leads] = await Promise.all([
    fetchAllPaged<{ auth_user_id: string; data: string; janela: string }>(() => {
      let q = supabase
        .from("roleta_credenciamentos")
        .select("auth_user_id, data, janela, status")
        .eq("status", "aprovado")
        .in("auth_user_id", ids);
      if (start) q = q.gte("data", start);
      if (end) q = q.lte("data", end);
      return q;
    }),
    fetchAllPaged<{ corretor_id: string; created_at: string }>(() => {
      let q = supabase
        .from("pipeline_leads")
        .select("corretor_id, created_at")
        .in("corretor_id", ids);
      if (start) q = q.gte("created_at", toIsoStart(start)!);
      if (end) q = q.lte("created_at", toIsoEnd(end)!);
      return q;
    }),
  ]);

  const rows: PresencasLeadsRow[] = corretores.map(c => {
    const myCreds = creds.filter(x => x.auth_user_id === c.user_id);
    let diurna = 0, noturna = 0, domingo = 0;
    myCreds.forEach(cr => {
      // BRT date
      const d = new Date((cr.data as string) + "T12:00:00-03:00");
      const isSunday = d.getDay() === 0;
      if (isSunday) domingo++;
      else if (cr.janela === "noturna") noturna++;
      else diurna++; // manha, tarde, dia_todo
    });
    const leadsCount = leads.filter(l => l.corretor_id === c.user_id).length;
    return {
      ...c,
      presencas_diurna: diurna,
      presencas_noturna: noturna,
      presencas_domingo: domingo,
      presencas_total: diurna + noturna + domingo,
      leads_recebidos: leadsCount,
    };
  });
  // Order: leads DESC, total presenças DESC
  return rows.sort((a, b) => b.leads_recebidos - a.leads_recebidos || b.presencas_total - a.presencas_total);
}

// ====== 2. Pipeline de Leads ======
export interface PipelineLeadsRow extends CorretorBase {
  ativos: number;             // snapshot atual: leads não arquivados, fora de Descarte
  recebidos_periodo: number;  // leads recebidos no período (data_lead)
  virou_visita: number;       // dos recebidos, quantos chegaram em visita+ (Visita Marcada em diante)
  virou_negocio: number;      // dos recebidos, quantos chegaram em Negócio Criado em diante
  conversao_pct: number;      // virou_visita / recebidos_periodo * 100
  sla_atrasado: number;       // leads ativos sem ação há >48h
}

// Stage UUIDs (referência: pipeline_stages do banco)
const STAGE_DESCARTE = ["1dd66c25-3848-4053-9f66-82e902989b4d"];

// Visita+ : Visita Marcada, Visita, Visita Realizada, Pós-Visita, Proposta,
// Negócio Criado, Negociação, Venda, Contrato Gerado
const STAGES_VISITA_OU_ALEM = [
  "c9fcf0ad-dcab-4575-b91f-3f76610e4d44", // Visita Marcada
  "a857139f-c419-4e37-ae17-5f5e70b21172", // Visita
  "5ad4f4aa-b66f-4dc2-ac90-97c55e846a14", // Visita Realizada
  "d932fb49-419c-4fda-bae1-9ef06ee2d033", // Pós-Visita
  "de6cee2f-8dda-4e60-a4e2-6b7f21aeae96", // Proposta
  "a8a1a867-5b0c-414e-9532-8873c4ca5a0f", // Negócio Criado
  "213e9ca3-0cb3-4893-979d-25f7e2e9cfa1", // Negociação
  "2d7739eb-1787-4ad6-887a-7a4a32dcfc05", // Venda
  "8c1eed68-4526-479f-9bb4-b8e70bee1416", // Contrato Gerado
];

// Negócio+ : Proposta em diante (lead "real" de negócio)
const STAGES_NEGOCIO_OU_ALEM = [
  "de6cee2f-8dda-4e60-a4e2-6b7f21aeae96", // Proposta
  "a8a1a867-5b0c-414e-9532-8873c4ca5a0f", // Negócio Criado
  "213e9ca3-0cb3-4893-979d-25f7e2e9cfa1", // Negociação
  "2d7739eb-1787-4ad6-887a-7a4a32dcfc05", // Venda
  "8c1eed68-4526-479f-9bb4-b8e70bee1416", // Contrato Gerado
];

async function fetchPipelineLeads(filters: RankingFilters, corretores: CorretorBase[]): Promise<PipelineLeadsRow[]> {
  const ids = corretores.map(c => c.user_id);
  if (ids.length === 0) return [];

  // 1) Snapshot atual (ativos + SLA)
  const active = await fetchAllPaged<{ corretor_id: string; stage_id: string; ultima_acao_at: string | null }>(() =>
    supabase
      .from("pipeline_leads")
      .select("corretor_id, stage_id, ultima_acao_at")
      .in("corretor_id", ids)
      .eq("arquivado", false)
  );

  // 2) Período: leads recebidos no intervalo selecionado (conversão real)
  const periodLeads = await fetchAllPaged<{ corretor_id: string; stage_id: string }>(() => {
    let q = supabase
      .from("pipeline_leads")
      .select("corretor_id, stage_id, created_at")
      .in("corretor_id", ids);
    if (filters.start) q = q.gte("created_at", toIsoStart(filters.start)!);
    if (filters.end) q = q.lte("created_at", toIsoEnd(filters.end)!);
    return q;
  });

  const now = Date.now();
  const STALE_MS = 48 * 60 * 60 * 1000;

  const rows: PipelineLeadsRow[] = corretores.map(c => {
    const mineActive = active.filter(l => l.corretor_id === c.user_id && !STAGE_DESCARTE.includes(l.stage_id));
    const ativos = mineActive.length;
    const sla_atrasado = mineActive.filter(l => {
      const t = l.ultima_acao_at ? new Date(l.ultima_acao_at).getTime() : 0;
      return now - t > STALE_MS;
    }).length;

    const minePeriod = periodLeads.filter(l => l.corretor_id === c.user_id);
    const recebidos_periodo = minePeriod.length;
    const virou_visita = minePeriod.filter(l => STAGES_VISITA_OU_ALEM.includes(l.stage_id)).length;
    const virou_negocio = minePeriod.filter(l => STAGES_NEGOCIO_OU_ALEM.includes(l.stage_id)).length;
    const conversao_pct = recebidos_periodo > 0 ? (virou_visita / recebidos_periodo) * 100 : 0;

    return { ...c, ativos, recebidos_periodo, virou_visita, virou_negocio, conversao_pct, sla_atrasado };
  });

  // Order: conversão DESC → virou_negocio DESC → virou_visita DESC → sla_atrasado ASC
  return rows.sort((a, b) =>
    b.conversao_pct - a.conversao_pct ||
    b.virou_negocio - a.virou_negocio ||
    b.virou_visita - a.virou_visita ||
    a.sla_atrasado - b.sla_atrasado
  );
}

// ====== 3. Visitas ======
export interface VisitasRow extends CorretorBase {
  criadas: number;
  realizadas: number;
  marcadas: number;
  no_show: number;
}

async function fetchVisitas(filters: RankingFilters, corretores: CorretorBase[]): Promise<VisitasRow[]> {
  const ids = corretores.map(c => c.user_id);
  if (ids.length === 0) return [];
  const list = await fetchAllPaged<{ corretor_id: string; status: string; data_visita: string }>(() => {
    let q = supabase
      .from("visitas")
      .select("corretor_id, status, data_visita")
      .in("corretor_id", ids);
    if (filters.start) q = q.gte("data_visita", filters.start);
    if (filters.end) q = q.lte("data_visita", filters.end);
    return q;
  });
  const rows: VisitasRow[] = corretores.map(c => {
    const mine = list.filter(v => v.corretor_id === c.user_id);
    const criadas = mine.length;
    const realizadas = mine.filter(v => v.status === "realizada").length;
    const marcadas = mine.filter(v => v.status === "marcada" || v.status === "reagendada").length;
    const no_show = mine.filter(v => v.status === "no_show").length;
    return { ...c, criadas, realizadas, marcadas, no_show };
  });
  // Order: realizadas DESC, criadas DESC
  return rows.sort((a, b) => b.realizadas - a.realizadas || b.criadas - a.criadas);
}

// ====== 4. Negócios ======
export interface NegociosRow extends CorretorBase {
  criados: number;
  caidos: number;
  assinados: number;
  vgv_assinado: number;
}

async function fetchNegocios(filters: RankingFilters, corretores: CorretorBase[]): Promise<NegociosRow[]> {
  const ids = corretores.map(c => c.user_id);
  if (ids.length === 0) return [];
  const start = filters.start;
  const end = filters.end;

  // IMPORTANTE: negocios.corretor_id referencia profiles.id (não auth.users.id).
  // A coluna canônica para vincular ao usuário é negocios.auth_user_id.

  const [created, distrato, signed] = await Promise.all([
    fetchAllPaged<{ auth_user_id: string; created_at: string }>(() => {
      let q = supabase.from("negocios").select("auth_user_id, created_at").in("auth_user_id", ids);
      if (start) q = q.gte("created_at", toIsoStart(start)!);
      if (end) q = q.lte("created_at", toIsoEnd(end)!);
      return q;
    }),
    fetchAllPaged<{ auth_user_id: string; fase_changed_at: string }>(() => {
      let q = supabase.from("negocios").select("auth_user_id, fase_changed_at, fase").in("auth_user_id", ids).eq("fase", "distrato");
      if (start) q = q.gte("fase_changed_at", toIsoStart(start)!);
      if (end) q = q.lte("fase_changed_at", toIsoEnd(end)!);
      return q;
    }),
    fetchAllPaged<{ auth_user_id: string; vgv_final: number | null; vgv_estimado: number | null; data_assinatura: string }>(() => {
      let q = supabase.from("negocios").select("auth_user_id, vgv_final, vgv_estimado, data_assinatura, fase").in("auth_user_id", ids).eq("fase", "vendido");
      if (start) q = q.gte("data_assinatura", start);
      if (end) q = q.lte("data_assinatura", end);
      return q;
    }),
  ]);

  const rows: NegociosRow[] = corretores.map(c => {
    const criados = created.filter(n => n.auth_user_id === c.user_id).length;
    const caidos = distrato.filter(n => n.auth_user_id === c.user_id).length;
    const mySigned = signed.filter(n => n.auth_user_id === c.user_id);
    const assinados = mySigned.length;
    const vgv_assinado = mySigned.reduce((s, n: any) => s + Number(n.vgv_final ?? n.vgv_estimado ?? 0), 0);
    return { ...c, criados, caidos, assinados, vgv_assinado };
  });
  // Order: VGV DESC, assinados DESC
  return rows.sort((a, b) => b.vgv_assinado - a.vgv_assinado || b.assinados - a.assinados);
}

// ====== 5. Oferta Ativa ======
export interface OfertaAtivaRow extends CorretorBase {
  tentativas: number;
  aproveitados: number;
  conversao_pct: number;
  score: number; // média normalizada (0-100) entre tentativas e conversão
}

async function fetchOfertaAtiva(filters: RankingFilters, corretores: CorretorBase[]): Promise<OfertaAtivaRow[]> {
  const ids = corretores.map(c => c.user_id);
  if (ids.length === 0) return [];

  const tentativas = await fetchAllPaged<{ corretor_id: string; resultado: string }>(() => {
    let q = supabase
      .from("oferta_ativa_tentativas")
      .select("corretor_id, resultado, created_at")
      .in("corretor_id", ids);
    if (filters.start) q = q.gte("created_at", toIsoStart(filters.start)!);
    if (filters.end) q = q.lte("created_at", toIsoEnd(filters.end)!);
    return q;
  });

  const base = corretores.map(c => {
    const mine = tentativas.filter(t => t.corretor_id === c.user_id);
    const total = mine.length;
    const aproveitados = mine.filter(t => t.resultado === "com_interesse").length;
    const conversao_pct = total > 0 ? (aproveitados / total) * 100 : 0;
    return { ...c, tentativas: total, aproveitados, conversao_pct };
  });

  // Score = média normalizada (0-100) entre VOLUME de tentativas e VOLUME de aproveitados.
  // Conversão fica como informativo, mas não entra no ranking — assim quem ligou pouco
  // não fica em cima de quem trabalhou de verdade.
  const maxTent = Math.max(1, ...base.map(b => b.tentativas));
  const maxAprov = Math.max(1, ...base.map(b => b.aproveitados));
  const rows: OfertaAtivaRow[] = base.map(b => {
    const tentNorm = (b.tentativas / maxTent) * 100;
    const aprovNorm = (b.aproveitados / maxAprov) * 100;
    const score = (tentNorm + aprovNorm) / 2;
    return { ...b, score };
  });

  return rows.sort((a, b) =>
    b.tentativas - a.tentativas ||
    b.aproveitados - a.aproveitados ||
    b.conversao_pct - a.conversao_pct
  );
}

// ====== Public hook ======
export type RankingType = "presencas" | "pipeline" | "visitas" | "negocios" | "oferta_ativa";

export function useRankingData<T>(type: RankingType, filters: RankingFilters) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const key = `${type}|${filters.start}|${filters.end}|${filters.equipeId || ""}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const corretores = await fetchCorretores(filters);
      let result: any[] = [];
      if (type === "presencas") result = await fetchPresencasLeads(filters, corretores);
      else if (type === "pipeline") result = await fetchPipelineLeads(filters, corretores);
      else if (type === "visitas") result = await fetchVisitas(filters, corretores);
      else if (type === "negocios") result = await fetchNegocios(filters, corretores);
      else if (type === "oferta_ativa") result = await fetchOfertaAtiva(filters, corretores);
      if (!cancelled) {
        setData(result as T[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading };
}

export async function fetchAllRankings(filters: RankingFilters) {
  const corretores = await fetchCorretores(filters);
  const [presencas, pipeline, visitas, negocios, oferta_ativa] = await Promise.all([
    fetchPresencasLeads(filters, corretores),
    fetchPipelineLeads(filters, corretores),
    fetchVisitas(filters, corretores),
    fetchNegocios(filters, corretores),
    fetchOfertaAtiva(filters, corretores),
  ]);
  return { presencas, pipeline, visitas, negocios, oferta_ativa };
}

export async function fetchEquipes(): Promise<{ user_id: string; nome: string }[]> {
  const { data: members } = await supabase
    .from("team_members")
    .select("gerente_id")
    .eq("status", "ativo")
    .not("gerente_id", "is", null);
  const ids = [...new Set((members || []).map(m => m.gerente_id).filter(Boolean) as string[])];
  if (ids.length === 0) return [];
  const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids);
  return (profs || [])
    .filter(p => p.user_id)
    .map(p => ({ user_id: p.user_id as string, nome: p.nome || "—" }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}
