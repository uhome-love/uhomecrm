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
  ativos: number;
  novo: number;
  contato: number;
  qualificado: number;
  visita_marcada: number;
  desatualizados: number;
}

const STAGE_NOVO = ["d3843b2f-2fa1-4c31-9129-4eb0ed21f019"];
const STAGE_CONTATO = ["8e2a3285-70f9-438d-be2d-13b0bf4610c4"];
const STAGE_QUALIF = ["1ea43190-44c8-43ec-91b4-409b055b0e58"];
const STAGE_VISITA_MARCADA = ["c9fcf0ad-dcab-4575-b91f-3f76610e4d44"];
const STAGE_DESCARTE = ["1dd66c25-3848-4053-9f66-82e902989b4d"];

async function fetchPipelineLeads(_filters: RankingFilters, corretores: CorretorBase[]): Promise<PipelineLeadsRow[]> {
  const ids = corretores.map(c => c.user_id);
  if (ids.length === 0) return [];

  // Snapshot atual (não filtra por período — pipeline é estado corrente)
  const active = await fetchAllPaged<{ corretor_id: string; stage_id: string; ultima_acao_at: string | null }>(() =>
    supabase
      .from("pipeline_leads")
      .select("corretor_id, stage_id, ultima_acao_at")
      .in("corretor_id", ids)
      .eq("arquivado", false)
  );

  const now = Date.now();
  const STALE_MS = 48 * 60 * 60 * 1000;

  const rows: PipelineLeadsRow[] = corretores.map(c => {
    const mine = active.filter(l => l.corretor_id === c.user_id && !STAGE_DESCARTE.includes(l.stage_id));
    const ativos = mine.length;
    const novo = mine.filter(l => STAGE_NOVO.includes(l.stage_id)).length;
    const contato = mine.filter(l => STAGE_CONTATO.includes(l.stage_id)).length;
    const qualificado = mine.filter(l => STAGE_QUALIF.includes(l.stage_id)).length;
    const visita_marcada = mine.filter(l => STAGE_VISITA_MARCADA.includes(l.stage_id)).length;
    const desatualizados = mine.filter(l => {
      const t = l.ultima_acao_at ? new Date(l.ultima_acao_at).getTime() : 0;
      return now - t > STALE_MS;
    }).length;
    return { ...c, ativos, novo, contato, qualificado, visita_marcada, desatualizados };
  });
  // Order: ativos DESC, desatualizados ASC (menos = melhor)
  return rows.sort((a, b) => b.ativos - a.ativos || a.desatualizados - b.desatualizados);
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

  // Criados no período (created_at)
  let createdQ = supabase
    .from("negocios")
    .select("auth_user_id, created_at")
    .in("auth_user_id", ids);
  if (start) createdQ = createdQ.gte("created_at", toIsoStart(start)!);
  if (end) createdQ = createdQ.lte("created_at", toIsoEnd(end)!);

  // Caídos (distrato) no período — usa fase_changed_at
  let distratoQ = supabase
    .from("negocios")
    .select("auth_user_id, fase_changed_at, fase")
    .in("auth_user_id", ids)
    .eq("fase", "distrato");
  if (start) distratoQ = distratoQ.gte("fase_changed_at", toIsoStart(start)!);
  if (end) distratoQ = distratoQ.lte("fase_changed_at", toIsoEnd(end)!);

  // Assinados (vendido) — usa data_assinatura (canônico)
  let signedQ = supabase
    .from("negocios")
    .select("auth_user_id, vgv_final, vgv_estimado, data_assinatura, fase")
    .in("auth_user_id", ids)
    .eq("fase", "vendido");
  if (start) signedQ = signedQ.gte("data_assinatura", start);
  if (end) signedQ = signedQ.lte("data_assinatura", end);

  const [cR, dR, sR] = await Promise.all([createdQ, distratoQ, signedQ]);
  const created = cR.data || [];
  const distrato = dR.data || [];
  const signed = sR.data || [];

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

// ====== Public hook ======
export type RankingType = "presencas" | "pipeline" | "visitas" | "negocios";

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
  const [presencas, pipeline, visitas, negocios] = await Promise.all([
    fetchPresencasLeads(filters, corretores),
    fetchPipelineLeads(filters, corretores),
    fetchVisitas(filters, corretores),
    fetchNegocios(filters, corretores),
  ]);
  return { presencas, pipeline, visitas, negocios };
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
