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
          .from("team_members").select("id, nome, equipe, gerente_id, user_id, avatar_url")
          .eq("status", "ativo");
        teamMembersData = tm || [];
      } else if (scope === "gerente") {
        const { data: tm } = await supabase
          .from("team_members").select("id, nome, equipe, gerente_id, user_id, avatar_url")
          .eq("gerente_id", authUserId!)
          .eq("status", "ativo");
        teamMembersData = tm || [];
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
          .from("team_members").select("id, nome, equipe, gerente_id, user_id, avatar_url")
          .eq("user_id", authUserId!)
          .eq("status", "ativo");
        teamMembersData = tm || [];
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
      const prevPresQ = supabase.from("roleta_credenciamentos").select("corretor_id")
        .in("status", ["aprovado", "saiu"])
        .gte("data", pdStart).lte("data", pdEnd).limit(10000);
      // Scope by profile IDs for roleta
      const presQScoped = scopeProfileIds ? presQ.in("corretor_id", scopeProfileIds.length > 0 ? scopeProfileIds : ["__none__"]) : presQ;
      const prevPresQScoped = scopeProfileIds ? prevPresQ.in("corretor_id", scopeProfileIds.length > 0 ? scopeProfileIds : ["__none__"]) : prevPresQ;

      // Ligações (OA tentativas)
      let ligQ = supabase.from("oferta_ativa_tentativas").select("corretor_id, created_at").gte("created_at", s).lte("created_at", e).limit(10000);
      let prevLigQ = supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).gte("created_at", ps).lte("created_at", pe);
      ligQ = applyScope(ligQ, "corretor_id");
      prevLigQ = applyScope(prevLigQ, "corretor_id");

      // Leads recebidos
      let leadsQ = supabase.from("pipeline_leads").select("id, corretor_id, created_at").gte("created_at", s).lte("created_at", e).limit(10000);
      let prevLeadsQ = supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).gte("created_at", ps).lte("created_at", pe);
      leadsQ = applyScope(leadsQ, "corretor_id");
      prevLeadsQ = applyScope(prevLeadsQ, "corretor_id");

      // Leads ativos (current snapshot — not a period metric, but pipeline_leads not in descarte stages)
      const { data: stagesDef } = await supabase.from("pipeline_stages").select("id, tipo").eq("ativo", true).eq("pipeline_tipo", "leads");
      const descarteStageIds = (stagesDef || []).filter(s => s.tipo === "descarte").map(s => s.id);
      let leadsAtivosQ = supabase.from("pipeline_leads").select("id, corretor_id", { count: "exact", head: true });
      if (descarteStageIds.length > 0) {
        // Use not.in for filtering out descarte
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

      // Negócios
      let negQ = supabase.from("negocios").select("id, corretor_id, auth_user_id, vgv_estimado, vgv_final, fase, created_at").gte("created_at", s).lte("created_at", e).limit(10000);
      let prevNegQ = supabase.from("negocios").select("id, vgv_estimado, vgv_final, fase").gte("created_at", ps).lte("created_at", pe).limit(10000);
      // Negocios uses corretor_id (profile_id) and auth_user_id
      if (scopeProfileIds) {
        const orParts = [
          ...scopeProfileIds.map(id => `corretor_id.eq.${id}`),
          ...(scopeUserIds || []).map(id => `auth_user_id.eq.${id}`),
        ];
        if (orParts.length > 0) {
          negQ = negQ.or(orParts.join(","));
          prevNegQ = prevNegQ.or(orParts.join(","));
        }
      }

      const [
        { data: presData },
        { data: prevPresData },
        { data: ligData },
        { count: prevLigCount },
        { data: leadsData },
        { count: prevLeadsCount },
        { count: leadsAtivosCount },
        { data: visData },
        { count: prevVisMarcCount },
        { count: prevVisRealCount },
        { data: negData },
        { data: prevNegData },
      ] = await Promise.all([
        presQScoped,
        prevPresQScoped,
        ligQ,
        prevLigQ,
        leadsQ,
        prevLeadsQ,
        leadsAtivosQ,
        visMarcQ,
        prevVisMarcQ,
        prevVisRealQ,
        negQ,
        prevNegQ,
      ]);

      // ── Calculate KPIs ──

      // Presences: unique corretores per day
      const presSet = new Set<string>();
      (presData || []).forEach(p => presSet.add(`${p.corretor_id}-${p.data}`));
      const presCount = presSet.size;
      const prevPresSet = new Set<string>();
      (prevPresData || []).forEach(p => prevPresSet.add(p.corretor_id));
      const prevPresCount = prevPresSet.size;

      const ligCount = (ligData || []).length;
      const leadsCount = (leadsData || []).length;

      const visMarcCount = (visData || []).length;
      const visRealCount = (visData || []).filter(v => v.status === "realizada").length;

      const negCriados = (negData || []).length;
      const negGerados = (negData || []).filter(n => 
        ["proposta", "negociacao", "documentacao", "assinado", "vendido"].includes(n.fase || "")
      ).length;
      const negAssinados = (negData || []).filter(n => ["assinado", "vendido"].includes(n.fase || "")).length;
      const vgvTotal = (negData || []).filter(n => ["assinado", "vendido"].includes(n.fase || ""))
        .reduce((sum, n) => sum + Number(n.vgv_final || n.vgv_estimado || 0), 0);

      const prevNegCriados = (prevNegData || []).length;
      const prevNegGerados = (prevNegData || []).filter(n => 
        ["proposta", "negociacao", "documentacao", "assinado", "vendido"].includes(n.fase || "")
      ).length;
      const prevNegAssinados = (prevNegData || []).filter(n => ["assinado", "vendido"].includes(n.fase || "")).length;
      const prevVgv = (prevNegData || []).filter(n => ["assinado", "vendido"].includes(n.fase || ""))
        .reduce((sum, n) => sum + Number(n.vgv_final || n.vgv_estimado || 0), 0);

      const kpis: ExecutiveKpis = {
        presencas: { current: presCount, prev: prevPresCount, pctChange: pctChange(presCount, prevPresCount) },
        ligacoes: { current: ligCount, prev: prevLigCount ?? 0, pctChange: pctChange(ligCount, prevLigCount ?? 0) },
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
        const negociosAssinados = myNeg.filter(n => ["assinado", "vendido"].includes(n.fase || "")).length;
        const vgv = myNeg.filter(n => ["assinado", "vendido"].includes(n.fase || ""))
          .reduce((s, n) => s + Number(n.vgv_final || n.vgv_estimado || 0), 0);

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
      const dailyTrends: DailyTrend[] = days.map(day => {
        const dayStr = ds(day);
        const dayTs = dayStr + "T";
        return {
          dia: dayStr,
          diaLabel: format(day, "EEE dd/MM", { locale: ptBR }),
          ligacoes: (ligData || []).filter(l => l.created_at?.startsWith(dayTs)).length,
          leads: (leadsData || []).filter(l => l.created_at?.startsWith(dayTs)).length,
          visitas: (visData || []).filter(v => v.data_visita === dayStr && v.status === "realizada").length,
          negocios: (negData || []).filter(n => n.created_at?.startsWith(dayTs)).length,
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
