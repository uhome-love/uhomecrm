/**
 * useRelatorioExecutivo — Data hook for the executive dashboard
 * 
 * Supports weekly/monthly periods with role-based filtering:
 * - Admin/CEO: entire company
 * - Gerente: own team only
 * - Corretor: own data only
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  startOfWeek, endOfWeek, addWeeks, addMonths,
  startOfMonth, endOfMonth, format, eachDayOfInterval, getISOWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ──

export type PeriodMode = "semana" | "mes";

export interface PeriodRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;
  mode: PeriodMode;
}

export interface KpiValue {
  current: number;
  prev: number;
  pctChange: number;
}

export interface ExecutiveKpis {
  presencas: KpiValue;
  ligacoes: KpiValue;
  leadsRecebidos: KpiValue;
  leadsAtivos: KpiValue;
  visitasMarcadas: KpiValue;
  visitasRealizadas: KpiValue;
  negociosCriados: KpiValue;
  negociosGerados: KpiValue;
  negociosAssinados: KpiValue;
  vgvTotal: KpiValue & { currentRaw: number; prevRaw: number };
}

export interface CorretorRow {
  id: string;
  nome: string;
  equipe: string;
  equipeColor: string;
  avatar_url: string | null;
  presencas: number;
  ligacoes: number;
  leads: number;
  leadsAtivos: number;
  visitasMarcadas: number;
  visitasRealizadas: number;
  negociosCriados: number;
  negociosAssinados: number;
  vgv: number;
}

export interface TeamRow {
  equipe: string;
  gerenteId: string;
  color: string;
  corretores: CorretorRow[];
  totals: Omit<CorretorRow, "id" | "nome" | "equipe" | "equipeColor" | "avatar_url">;
}

export interface DailyTrend {
  dia: string;
  diaLabel: string;
  ligacoes: number;
  leads: number;
  visitas: number;
  negocios: number;
}

// ── Period Helpers ──

export function getPeriodRange(mode: PeriodMode, offset: number): PeriodRange {
  if (mode === "semana") {
    const ref = addWeeks(new Date(), offset);
    const start = startOfWeek(ref, { weekStartsOn: 1 });
    const end = endOfWeek(ref, { weekStartsOn: 1 });
    const prevStart = addWeeks(start, -1);
    const prevEnd = addWeeks(end, -1);
    const wn = getISOWeek(start);
    return {
      start, end, prevStart, prevEnd, mode,
      label: `Semana ${wn} · ${format(start, "dd/MM")} — ${format(end, "dd/MM/yyyy")}`,
    };
  }
  const ref = addMonths(new Date(), offset);
  const start = startOfMonth(ref);
  const end = endOfMonth(ref);
  const prevStart = startOfMonth(addMonths(ref, -1));
  const prevEnd = endOfMonth(addMonths(ref, -1));
  return {
    start, end, prevStart, prevEnd, mode,
    label: format(start, "MMMM yyyy", { locale: ptBR }).replace(/^./, s => s.toUpperCase()),
  };
}

function ds(d: Date) { return format(d, "yyyy-MM-dd"); }
function tsStart(d: Date) { return `${ds(d)}T00:00:00-03:00`; }
function tsEnd(d: Date) { return `${ds(d)}T23:59:59.999-03:00`; }

/** Paginated fetch to bypass Supabase 1000-row default limit */
async function fetchAllRows<T = any>(
  buildQuery: (from: number, to: number) => any,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1);
    if (error) { console.error("fetchAllRows error:", error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

const TEAM_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-pink-100 text-pink-800 border-pink-200",
];

function pctChange(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

// ── Scope resolution ──

export type UserScope = "admin" | "gerente" | "corretor";

export function useUserScope() {
  const { profile, authUserId } = useAuthUser();
  const cargo = profile?.cargo?.toLowerCase() || "";
  let scope: UserScope = "corretor";
  if (cargo === "admin" || cargo === "ceo" || cargo === "diretor") scope = "admin";
  else if (cargo === "gestor" || cargo === "gerente" || cargo === "coordenador") scope = "gerente";
  return { scope, authUserId, profileId: profile?.id || null, profile };
}

// ── Main data hook ──

export function useRelatorioExecutivo(period: PeriodRange) {
  const { scope, authUserId, profileId } = useUserScope();
  const key = `exec-report-${ds(period.start)}-${ds(period.end)}-${scope}-${authUserId}`;

  return useQuery({
    queryKey: [key],
    staleTime: 3 * 60_000,
    enabled: !!authUserId,
    queryFn: async () => {
      const s = tsStart(period.start);
      const e = tsEnd(period.end);
      const ps = tsStart(period.prevStart);
      const pe = tsEnd(period.prevEnd);
      const dStart = ds(period.start);
      const dEnd = ds(period.end);
      const pdStart = ds(period.prevStart);
      const pdEnd = ds(period.prevEnd);

      // 1) Resolve scope: get team_members in scope
      let scopeUserIds: string[] | null = null; // null = all (admin)
      let scopeProfileIds: string[] | null = null;
      let teamMembersData: any[] = [];

      if (scope === "admin") {
        const { data: tm } = await supabase
          .from("team_members").select("id, nome, equipe, gerente_id, user_id")
          .eq("status", "ativo");
        teamMembersData = (tm || []).map(m => ({ ...m, avatar_url: null }));
      } else if (scope === "gerente") {
        const { data: tm } = await supabase
          .from("team_members").select("id, nome, equipe, gerente_id, user_id")
          .eq("gerente_id", authUserId!)
          .eq("status", "ativo");
        teamMembersData = (tm || []).map(m => ({ ...m, avatar_url: null }));
        scopeUserIds = teamMembersData.map(m => m.user_id).filter(Boolean);
        // Resolve profile IDs for negocios
        if (scopeUserIds.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("id, user_id").in("user_id", scopeUserIds);
          scopeProfileIds = (profs || []).map(p => p.id);
        }
      } else {
        // Corretor: own data
        scopeUserIds = authUserId ? [authUserId] : [];
        scopeProfileIds = profileId ? [profileId] : [];
        // Get own team info
        const { data: tm } = await supabase
          .from("team_members").select("id, nome, equipe, gerente_id, user_id")
          .eq("user_id", authUserId!)
          .eq("status", "ativo");
        teamMembersData = (tm || []).map(m => ({ ...m, avatar_url: null }));
      }

      // Helper to apply scope filter
      const applyScope = (q: any, col: string) => {
        if (scopeUserIds) return q.in(col, scopeUserIds.length > 0 ? scopeUserIds : ["__none__"]);
        return q;
      };

      // 2) Parallel data fetches
      const days = eachDayOfInterval({ start: period.start, end: period.end > new Date() ? new Date() : period.end });

      // Presences: roleta_credenciamentos with status approved or left
      const presQ = supabase.from("roleta_credenciamentos").select("corretor_id, data")
        .in("status", ["aprovado", "saiu"])
        .gte("data", dStart).lte("data", dEnd).limit(10000);
      const prevPresQ = supabase.from("roleta_credenciamentos").select("corretor_id, data")
        .in("status", ["aprovado", "saiu"])
        .gte("data", pdStart).lte("data", pdEnd).limit(10000);
      // Scope by profile IDs for roleta
      const presQScoped = scopeProfileIds ? presQ.in("corretor_id", scopeProfileIds.length > 0 ? scopeProfileIds : ["__none__"]) : presQ;
      const prevPresQScoped = scopeProfileIds ? prevPresQ.in("corretor_id", scopeProfileIds.length > 0 ? scopeProfileIds : ["__none__"]) : prevPresQ;

      // Ligações — ALL sources: oferta_ativa_tentativas + pipeline_atividades (tipo=ligacao) + ai_calls
      // Previous period counts (head-only for performance)
      let prevLigOAQ = supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).gte("created_at", ps).lte("created_at", pe);
      prevLigOAQ = applyScope(prevLigOAQ, "corretor_id");
      let prevLigPAQ = supabase.from("pipeline_atividades" as any).select("id", { count: "exact", head: true }).eq("tipo", "ligacao").gte("created_at", ps).lte("created_at", pe);
      prevLigPAQ = applyScope(prevLigPAQ, "created_by");
      let prevLigAIQ = supabase.from("ai_calls").select("id", { count: "exact", head: true }).gte("created_at", ps).lte("created_at", pe);
      prevLigAIQ = applyScope(prevLigAIQ, "iniciado_por");

      // Leads recebidos — paginated to avoid 1000-row cap
      const leadsPromise = fetchAllRows<{ id: string; corretor_id: string; created_at: string }>((from, to) => {
        let q = supabase.from("pipeline_leads").select("id, corretor_id, created_at").gte("created_at", s).lte("created_at", e).range(from, to);
        if (scopeUserIds) q = q.in("corretor_id", scopeUserIds.length > 0 ? scopeUserIds : ["__none__"]);
        return q;
      });
      let prevLeadsQ = supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).gte("created_at", ps).lte("created_at", pe);
      prevLeadsQ = applyScope(prevLeadsQ, "corretor_id");

      // Leads ativos (current snapshot — not a period metric, but pipeline_leads not in descarte stages)
      const { data: stagesDef } = await supabase.from("pipeline_stages").select("id, tipo").eq("ativo", true).eq("pipeline_tipo", "leads");
      const descarteStageIds = (stagesDef || []).filter(s => s.tipo === "descarte").map(s => s.id);
      let leadsAtivosQ = supabase.from("pipeline_leads").select("id, corretor_id", { count: "exact", head: true });
      if (descarteStageIds.length > 0) {
        for (const did of descarteStageIds) {
          leadsAtivosQ = leadsAtivosQ.neq("stage_id", did);
        }
      }
      leadsAtivosQ = applyScope(leadsAtivosQ, "corretor_id");

      // Visitas
      let visMarcQ = supabase.from("visitas").select("corretor_id, data_visita, status").gte("data_visita", dStart).lte("data_visita", dEnd).limit(10000);
      let prevVisMarcQ = supabase.from("visitas").select("id", { count: "exact", head: true }).gte("data_visita", pdStart).lte("data_visita", pdEnd);
      let prevVisRealQ = supabase.from("visitas").select("id", { count: "exact", head: true }).eq("status", "realizada").gte("data_visita", pdStart).lte("data_visita", pdEnd);
      visMarcQ = applyScope(visMarcQ, "corretor_id");
      prevVisMarcQ = applyScope(prevVisMarcQ, "corretor_id");
      prevVisRealQ = applyScope(prevVisRealQ, "corretor_id");

      // Negócios criados (by created_at)
      let negQ = supabase.from("negocios").select("id, corretor_id, auth_user_id, vgv_estimado, vgv_final, fase, created_at, data_assinatura, lead_id").gte("created_at", s).lte("created_at", e).limit(10000);
      let prevNegQ = supabase.from("negocios").select("id, vgv_estimado, vgv_final, fase, data_assinatura").gte("created_at", ps).lte("created_at", pe).limit(10000);

      // Negócios assinados (by data_assinatura within period)
      let negAssinadosQ = supabase.from("negocios").select("id, corretor_id, auth_user_id, vgv_estimado, vgv_final, fase, data_assinatura, lead_id")
        .in("fase", ["assinado", "vendido"])
        .gte("data_assinatura", dStart).lte("data_assinatura", dEnd).limit(10000);
      let prevNegAssinadosQ = supabase.from("negocios").select("id, vgv_estimado, vgv_final, fase, data_assinatura")
        .in("fase", ["assinado", "vendido"])
        .gte("data_assinatura", pdStart).lte("data_assinatura", pdEnd).limit(10000);

      // Negocios uses corretor_id (profile_id) and auth_user_id
      if (scopeProfileIds) {
        const orParts = [
          ...scopeProfileIds.map(id => `corretor_id.eq.${id}`),
          ...(scopeUserIds || []).map(id => `auth_user_id.eq.${id}`),
        ];
        if (orParts.length > 0) {
          negQ = negQ.or(orParts.join(","));
          prevNegQ = prevNegQ.or(orParts.join(","));
          negAssinadosQ = negAssinadosQ.or(orParts.join(","));
          prevNegAssinadosQ = prevNegAssinadosQ.or(orParts.join(","));
        }
      }

      // Fetch ligações from ALL sources: oferta_ativa + pipeline_atividades + ai_calls
      const ligOAPromise = fetchAllRows<{ corretor_id: string; created_at: string }>((from, to) => {
        let q = supabase.from("oferta_ativa_tentativas").select("corretor_id, created_at").gte("created_at", s).lte("created_at", e).range(from, to);
        if (scopeUserIds) q = q.in("corretor_id", scopeUserIds.length > 0 ? scopeUserIds : ["__none__"]);
        return q;
      });
      const ligPAPromise = fetchAllRows<{ created_by: string; created_at: string }>((from, to) => {
        let q = (supabase.from("pipeline_atividades" as any).select("created_by, created_at") as any).eq("tipo", "ligacao").gte("created_at", s).lte("created_at", e).range(from, to);
        if (scopeUserIds) q = q.in("created_by", scopeUserIds.length > 0 ? scopeUserIds : ["__none__"]);
        return q;
      });
      const ligAIPromise = fetchAllRows<{ iniciado_por: string; created_at: string }>((from, to) => {
        let q = supabase.from("ai_calls").select("iniciado_por, created_at").gte("created_at", s).lte("created_at", e).range(from, to);
        if (scopeUserIds) q = q.in("iniciado_por", scopeUserIds.length > 0 ? scopeUserIds : ["__none__"]);
        return q;
      });

      // Fetch active partnerships for VGV splitting
      const parceriasPromise = supabase.from("pipeline_parcerias" as any)
        .select("pipeline_lead_id, corretor_principal_id, corretor_parceiro_id, divisao_principal, divisao_parceiro, status")
        .eq("status", "ativa");

      const [
        { data: presData },
        { data: prevPresData },
        { count: prevLigOACount },
        { count: prevLigPACount },
        { count: prevLigAICount },
        leadsData,
        { count: prevLeadsCount },
        { count: leadsAtivosCount },
        { data: visData },
        { count: prevVisMarcCount },
        { count: prevVisRealCount },
        { data: negData },
        { data: prevNegData },
        { data: negAssinadosData },
        { data: prevNegAssinadosData },
        ligOAData,
        ligPAData,
        ligAIData,
        { data: parceriasData },
      ] = await Promise.all([
        presQScoped,
        prevPresQScoped,
        prevLigOAQ,
        prevLigPAQ,
        prevLigAIQ,
        leadsPromise,
        prevLeadsQ,
        leadsAtivosQ,
        visMarcQ,
        prevVisMarcQ,
        prevVisRealQ,
        negQ,
        prevNegQ,
        negAssinadosQ,
        prevNegAssinadosQ,
        ligOAPromise,
        ligPAPromise,
        ligAIPromise,
        parceriasPromise,
      ]);

      // Merge all call sources into unified ligData with normalized corretor_id
      const ligData: { corretor_id: string; created_at: string }[] = [
        ...(ligOAData || []),
        ...(ligPAData || []).map(l => ({ corretor_id: (l as any).created_by, created_at: l.created_at })),
        ...(ligAIData || []).map(l => ({ corretor_id: (l as any).iniciado_por, created_at: l.created_at })),
      ];

      // ── Calculate KPIs ──

      // Presences: unique corretores per day (max 1 per corretor per day)
      const presSet = new Set<string>();
      (presData || []).forEach(p => presSet.add(`${p.corretor_id}-${p.data}`));
      const presCount = presSet.size;
      // Previous period: also deduplicate by corretor+day
      const prevPresSet = new Set<string>();
      (prevPresData || []).forEach(p => prevPresSet.add(`${p.corretor_id}-${(p as any).data}`));
      const prevPresCount = prevPresSet.size;

      const ligCount = ligData.length;
      const prevLigCount = (prevLigOACount ?? 0) + (prevLigPACount ?? 0) + (prevLigAICount ?? 0);
      const leadsCount = (leadsData || []).length;

      const visMarcCount = (visData || []).length;
      const visRealCount = (visData || []).filter(v => v.status === "realizada").length;

      const negCriados = (negData || []).length;
      const negGerados = (negData || []).filter(n => 
        ["proposta", "negociacao", "documentacao", "assinado", "vendido"].includes(n.fase || "")
      ).length;
      // Assinados & VGV: use data_assinatura-based queries
      const negAssinados = (negAssinadosData || []).length;
      const vgvTotal = (negAssinadosData || [])
        .reduce((sum, n) => sum + Number(n.vgv_final || n.vgv_estimado || 0), 0);

      const prevNegCriados = (prevNegData || []).length;
      const prevNegGerados = (prevNegData || []).filter(n => 
        ["proposta", "negociacao", "documentacao", "assinado", "vendido"].includes(n.fase || "")
      ).length;
      const prevNegAssinados = (prevNegAssinadosData || []).length;
      const prevVgv = (prevNegAssinadosData || [])
        .reduce((sum, n) => sum + Number(n.vgv_final || n.vgv_estimado || 0), 0);

      const kpis: ExecutiveKpis = {
        presencas: { current: presCount, prev: prevPresCount, pctChange: pctChange(presCount, prevPresCount) },
        ligacoes: { current: ligCount, prev: prevLigCount, pctChange: pctChange(ligCount, prevLigCount) },
        leadsRecebidos: { current: leadsCount, prev: prevLeadsCount ?? 0, pctChange: pctChange(leadsCount, prevLeadsCount ?? 0) },
        leadsAtivos: { current: leadsAtivosCount ?? 0, prev: 0, pctChange: 0 },
        visitasMarcadas: { current: visMarcCount, prev: prevVisMarcCount ?? 0, pctChange: pctChange(visMarcCount, prevVisMarcCount ?? 0) },
        visitasRealizadas: { current: visRealCount, prev: prevVisRealCount ?? 0, pctChange: pctChange(visRealCount, prevVisRealCount ?? 0) },
        negociosCriados: { current: negCriados, prev: prevNegCriados, pctChange: pctChange(negCriados, prevNegCriados) },
        negociosGerados: { current: negGerados, prev: prevNegGerados, pctChange: pctChange(negGerados, prevNegGerados) },
        negociosAssinados: { current: negAssinados, prev: prevNegAssinados, pctChange: pctChange(negAssinados, prevNegAssinados) },
        vgvTotal: { current: vgvTotal, prev: prevVgv, pctChange: pctChange(vgvTotal, prevVgv), currentRaw: vgvTotal, prevRaw: prevVgv },
      };

      // ── Corretor-level breakdown ──
      // Resolve profile→user mapping for negocios
      const allUserIds = teamMembersData.map(m => m.user_id).filter(Boolean);
      let profileToUser: Record<string, string> = {};
      let userToProfile: Record<string, string> = {};
      if (allUserIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, user_id").in("user_id", allUserIds);
        (profs || []).forEach(p => {
          if (p.user_id) {
            profileToUser[p.id] = p.user_id;
            userToProfile[p.user_id] = p.id;
          }
        });
      }

      // Build equipe color map
      const equipes = [...new Set(teamMembersData.map(m => m.equipe || "Sem equipe"))];
      const equipeColorMap: Record<string, string> = {};
      equipes.forEach((eq, i) => { equipeColorMap[eq] = TEAM_COLORS[i % TEAM_COLORS.length]; });

      // Presence per profile
      const presPerProfile: Record<string, Set<string>> = {};
      (presData || []).forEach(p => {
        if (!presPerProfile[p.corretor_id]) presPerProfile[p.corretor_id] = new Set();
        presPerProfile[p.corretor_id].add(p.data);
      });

      // Build partnership maps for VGV splitting
      // Map: negocio lead_id → partnership info
      const parceriaByLeadId: Record<string, { principal: string; parceiro: string; divPrincipal: number; divParceiro: number }> = {};
      // Map: principal user_id → list of partner user_ids (for negocios without lead_id)
      const parceriaByPrincipal: Record<string, { parceiro: string; leadId: string; divPrincipal: number; divParceiro: number }[]> = {};
      (parceriasData || []).forEach((p: any) => {
        if (p.pipeline_lead_id) {
          parceriaByLeadId[p.pipeline_lead_id] = {
            principal: p.corretor_principal_id,
            parceiro: p.corretor_parceiro_id,
            divPrincipal: p.divisao_principal || 50,
            divParceiro: p.divisao_parceiro || 50,
          };
        }
        if (p.corretor_principal_id) {
          if (!parceriaByPrincipal[p.corretor_principal_id]) parceriaByPrincipal[p.corretor_principal_id] = [];
          parceriaByPrincipal[p.corretor_principal_id].push({
            parceiro: p.corretor_parceiro_id,
            leadId: p.pipeline_lead_id,
            divPrincipal: p.divisao_principal || 50,
            divParceiro: p.divisao_parceiro || 50,
          });
        }
      });

      // Pre-compute VGV with partnership splits for each negocio assinado
      // Returns { userId → { vgv: number, count: number } } including partner attributions
      const vgvByUser: Record<string, { vgv: number; count: number }> = {};
      const addVgv = (uid: string, amount: number, count: number) => {
        if (!uid) return;
        if (!vgvByUser[uid]) vgvByUser[uid] = { vgv: 0, count: 0 };
        vgvByUser[uid].vgv += amount;
        vgvByUser[uid].count += count;
      };

      (negAssinadosData || []).forEach(n => {
        const fullVgv = Number(n.vgv_final || n.vgv_estimado || 0);
        const ownerUid = (n as any).auth_user_id || "";
        const ownerPid = (n as any).corretor_id || "";
        const leadId = (n as any).lead_id || "";

        // Check if this negocio has a partnership via lead_id
        const parceria = leadId ? parceriaByLeadId[leadId] : null;

        if (parceria) {
          // Split VGV according to partnership percentages
          const principalVgv = fullVgv * (parceria.divPrincipal / 100);
          const parceiroVgv = fullVgv * (parceria.divParceiro / 100);
          addVgv(parceria.principal, principalVgv, 1);
          addVgv(parceria.parceiro, parceiroVgv, 1);
        } else {
          // No partnership — full VGV to owner
          addVgv(ownerUid, fullVgv, 1);
        }
      });

      const corretores: CorretorRow[] = teamMembersData.map(m => {
        const uid = m.user_id || "";
        const pid = userToProfile[uid] || "";
        const eq = m.equipe || "Sem equipe";

        const ligacoes = (ligData || []).filter(l => l.corretor_id === uid).length;
        const leads = (leadsData || []).filter(l => l.corretor_id === uid).length;

        // Leads ativos is a snapshot — we'd need per-corretor query, skip for perf
        const leadsAtivos = 0; // TODO: per-corretor snapshot if needed

        const myVis = (visData || []).filter(v => v.corretor_id === uid);
        const visitasMarcadas = myVis.length;
        const visitasRealizadas = myVis.filter(v => v.status === "realizada").length;

        const myNeg = (negData || []).filter(n => n.corretor_id === pid || n.auth_user_id === uid);
        const negociosCriados = myNeg.length;
        // Assinados & VGV: use partnership-aware calculation
        const partnerData = vgvByUser[uid];
        const negociosAssinados = partnerData?.count || 0;
        const vgv = partnerData?.vgv || 0;

        const presencas = presPerProfile[pid]?.size || 0;

        return {
          id: m.id,
          nome: m.nome || "Corretor",
          equipe: eq,
          equipeColor: equipeColorMap[eq],
          avatar_url: m.avatar_url || null,
          presencas, ligacoes, leads, leadsAtivos,
          visitasMarcadas, visitasRealizadas,
          negociosCriados, negociosAssinados, vgv,
        };
      });

      // ── Team breakdown ──
      const teamMap: Record<string, TeamRow> = {};
      const gerenteMap: Record<string, string> = {};
      teamMembersData.forEach(m => {
        const eq = m.equipe || "Sem equipe";
        gerenteMap[eq] = m.gerente_id || "";
      });

      corretores.forEach(c => {
        if (!teamMap[c.equipe]) {
          teamMap[c.equipe] = {
            equipe: c.equipe,
            gerenteId: gerenteMap[c.equipe] || "",
            color: c.equipeColor,
            corretores: [],
            totals: { presencas: 0, ligacoes: 0, leads: 0, leadsAtivos: 0, visitasMarcadas: 0, visitasRealizadas: 0, negociosCriados: 0, negociosAssinados: 0, vgv: 0 },
          };
        }
        const t = teamMap[c.equipe];
        t.corretores.push(c);
        t.totals.presencas += c.presencas;
        t.totals.ligacoes += c.ligacoes;
        t.totals.leads += c.leads;
        t.totals.visitasMarcadas += c.visitasMarcadas;
        t.totals.visitasRealizadas += c.visitasRealizadas;
        t.totals.negociosCriados += c.negociosCriados;
        t.totals.negociosAssinados += c.negociosAssinados;
        t.totals.vgv += c.vgv;
      });

      const teams = Object.values(teamMap).sort((a, b) => b.totals.vgv - a.totals.vgv);

      // ── Daily trends ──
      // Use BRT-aware boundaries so late-night events (21h-23h59 BRT) aren't shifted to the next day
      const dailyTrends: DailyTrend[] = days.map(day => {
        const dayStr = ds(day);
        const dayStartUtc = new Date(`${dayStr}T00:00:00-03:00`).toISOString();
        const dayEndUtc = new Date(`${dayStr}T23:59:59.999-03:00`).toISOString();
        const inDay = (ts: string | null) => ts != null && ts >= dayStartUtc && ts <= dayEndUtc;
        return {
          dia: dayStr,
          diaLabel: format(day, "EEE dd/MM", { locale: ptBR }),
          ligacoes: (ligData || []).filter(l => inDay(l.created_at)).length,
          leads: (leadsData || []).filter(l => inDay(l.created_at)).length,
          visitas: (visData || []).filter(v => v.data_visita === dayStr && v.status === "realizada").length,
          negocios: (negData || []).filter(n => inDay(n.created_at)).length,
        };
      });

      return {
        kpis,
        corretores: corretores.sort((a, b) => b.vgv - a.vgv),
        teams,
        dailyTrends,
        scope,
        periodLabel: period.label,
      };
    },
  });
}
