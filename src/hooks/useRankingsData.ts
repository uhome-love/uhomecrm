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

// ------- Helpers -------
function toIsoStart(d?: string) { return d ? `${d}T00:00:00-03:00` : undefined; }
function toIsoEnd(d?: string) { return d ? `${d}T23:59:59-03:00` : undefined; }

async function fetchCorretores(filters: RankingFilters): Promise<CorretorBase[]> {
  // Determine eligible user_ids via team_members (active). If equipe selected, filter by gerente.
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
  leads_recebidos: number;
  score: number;
}

async function fetchPresencasLeads(filters: RankingFilters, corretores: CorretorBase[]): Promise<PresencasLeadsRow[]> {
  const ids = corretores.map(c => c.user_id);
  if (ids.length === 0) return [];
  const start = filters.start;
  const end = filters.end;

  const credsQ = supabase
    .from("roleta_credenciamentos")
    .select("auth_user_id, data, janela, status")
    .eq("status", "aprovado")
    .in("auth_user_id", ids);
  if (start) credsQ.gte("data", start);
  if (end) credsQ.lte("data", end);

  const leadsQ = supabase
    .from("pipeline_leads")
    .select("corretor_id, created_at")
    .in("corretor_id", ids);
  if (start) leadsQ.gte("created_at", toIsoStart(start)!);
  if (end) leadsQ.lte("created_at", toIsoEnd(end)!);

  const [credsRes, leadsRes] = await Promise.all([credsQ, leadsQ]);
  const creds = credsRes.data || [];
  const leads = leadsRes.data || [];

  const rows: PresencasLeadsRow[] = corretores.map(c => {
    const myCreds = creds.filter(x => x.auth_user_id === c.user_id);
    let diurna = 0, noturna = 0, domingo = 0;
    myCreds.forEach(cr => {
      const d = new Date(cr.data + "T12:00:00-03:00");
      const isSunday = d.getDay() === 0;
      if (isSunday) domingo++;
      else if (cr.janela === "noturna") noturna++;
      else diurna++;
    });
    const leadsCount = leads.filter(l => l.corretor_id === c.user_id).length;
    const score = Math.round((diurna + noturna * 1.2 + domingo * 1.5) * 10 + leadsCount);
    return { ...c, presencas_diurna: diurna, presencas_noturna: noturna, presencas_domingo: domingo, leads_recebidos: leadsCount, score };
  });
  return rows.sort((a, b) => b.score - a.score);
}

// ====== 2. Pipeline de Leads ======
export interface PipelineLeadsRow extends CorretorBase {
  ativos: number;
  novo: number;
  contato: number;
  qualificado: number;
  visita_marcada: number;
  desatualizados: number;
  descartes: number;
  recebidos: number;
  negocios_criados: number;
  aproveitamento: number; // %
  score: number;
}

const STAGE_NOVO = ["d3843b2f-2fa1-4c31-9129-4eb0ed21f019"]; // Novo Lead
const STAGE_CONTATO = ["8e2a3285-70f9-438d-be2d-13b0bf4610c4"]; // Contato Iniciado
const STAGE_QUALIF = ["1ea43190-44c8-43ec-91b4-409b055b0e58"]; // Qualificação
const STAGE_VISITA_MARCADA = ["c9fcf0ad-dcab-4575-b91f-3f76610e4d44"]; // Visita Marcada
const STAGE_DESCARTE = ["1dd66c25-3848-4053-9f66-82e902989b4d"]; // Descarte

async function fetchPipelineLeads(filters: RankingFilters, corretores: CorretorBase[]): Promise<PipelineLeadsRow[]> {
  const ids = corretores.map(c => c.user_id);
  if (ids.length === 0) return [];
  const start = filters.start;
  const end = filters.end;

  // Active leads (current snapshot, not archived, not in descarte)
  const activeQ = supabase
    .from("pipeline_leads")
    .select("corretor_id, stage_id, ultima_acao_at, motivo_descarte, created_at, negocio_id")
    .in("corretor_id", ids)
    .eq("arquivado", false);

  // Received in period
  const receivedQ = supabase
    .from("pipeline_leads")
    .select("corretor_id, motivo_descarte, negocio_id, updated_at")
    .in("corretor_id", ids);
  if (start) receivedQ.gte("created_at", toIsoStart(start)!);
  if (end) receivedQ.lte("created_at", toIsoEnd(end)!);

  const [activeRes, recRes] = await Promise.all([activeQ, receivedQ]);
  const active = activeRes.data || [];
  const received = recRes.data || [];

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
    const myReceived = received.filter(l => l.corretor_id === c.user_id);
    const recebidos = myReceived.length;
    const descartes = myReceived.filter(l => !!l.motivo_descarte).length;
    const negocios_criados = myReceived.filter(l => !!l.negocio_id).length;
    const aproveitamento = recebidos > 0 ? Math.round((negocios_criados / recebidos) * 1000) / 10 : 0;
    const score = Math.round(aproveitamento * 5 + ativos * 2 - desatualizados * 3 - descartes * 1);
    return { ...c, ativos, novo, contato, qualificado, visita_marcada, desatualizados, descartes, recebidos, negocios_criados, aproveitamento, score };
  });
  return rows.sort((a, b) => b.score - a.score);
}

// ====== 3. Visitas ======
export interface VisitasRow extends CorretorBase {
  criadas: number;
  realizadas: number;
  no_show: number;
  score: number;
}

async function fetchVisitas(filters: RankingFilters, corretores: CorretorBase[]): Promise<VisitasRow[]> {
  const ids = corretores.map(c => c.user_id);
  if (ids.length === 0) return [];
  const q = supabase
    .from("visitas")
    .select("corretor_id, status, data_visita")
    .in("corretor_id", ids);
  if (filters.start) q.gte("data_visita", filters.start);
  if (filters.end) q.lte("data_visita", filters.end);
  const { data } = await q;
  const list = data || [];
  const rows: VisitasRow[] = corretores.map(c => {
    const mine = list.filter(v => v.corretor_id === c.user_id);
    const criadas = mine.length;
    const realizadas = mine.filter(v => v.status === "realizada").length;
    const no_show = mine.filter(v => v.status === "no_show").length;
    const score = criadas * 1 + realizadas * 2;
    return { ...c, criadas, realizadas, no_show, score };
  });
  return rows.sort((a, b) => b.score - a.score);
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

  // Created in period
  const createdQ = supabase
    .from("negocios")
    .select("corretor_id, created_at")
    .in("corretor_id", ids);
  if (start) createdQ.gte("created_at", toIsoStart(start)!);
  if (end) createdQ.lte("created_at", toIsoEnd(end)!);

  // Distratos in period (use updated_at as proxy)
  const distratoQ = supabase
    .from("negocios")
    .select("corretor_id, updated_at, fase")
    .in("corretor_id", ids)
    .eq("fase", "distrato");
  if (start) distratoQ.gte("updated_at", toIsoStart(start)!);
  if (end) distratoQ.lte("updated_at", toIsoEnd(end)!);

  // Signed: data_assinatura in period
  const signedQ = supabase
    .from("negocios")
    .select("corretor_id, vgv_final, data_assinatura, fase")
    .in("corretor_id", ids)
    .eq("fase", "vendido");
  if (start) signedQ.gte("data_assinatura", start);
  if (end) signedQ.lte("data_assinatura", end);

  const [cR, dR, sR] = await Promise.all([createdQ, distratoQ, signedQ]);
  const created = cR.data || [];
  const distrato = dR.data || [];
  const signed = sR.data || [];

  const rows: NegociosRow[] = corretores.map(c => {
    const criados = created.filter(n => n.corretor_id === c.user_id).length;
    const caidos = distrato.filter(n => n.corretor_id === c.user_id).length;
    const mySigned = signed.filter(n => n.corretor_id === c.user_id);
    const assinados = mySigned.length;
    const vgv_assinado = mySigned.reduce((s, n) => s + Number(n.vgv_final || 0), 0);
    return { ...c, criados, caidos, assinados, vgv_assinado };
  });
  return rows.sort((a, b) => b.vgv_assinado - a.vgv_assinado);
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
