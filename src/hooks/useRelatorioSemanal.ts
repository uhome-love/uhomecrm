import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, addWeeks, format, eachDayOfInterval, getISOWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface WeekRange {
  start: Date;
  end: Date;
  label: string;
  weekNumber: number;
}

export function getWeekRange(weekOffset: number): WeekRange {
  const ref = addWeeks(new Date(), weekOffset);
  const start = startOfWeek(ref, { weekStartsOn: 1 });
  const end = endOfWeek(ref, { weekStartsOn: 1 });
  const weekNumber = getISOWeek(start);
  const label = `Semana ${weekNumber} · ${format(start, "dd/MM")} — ${format(end, "dd/MM/yyyy")}`;
  return { start, end, label, weekNumber };
}

function iso(d: Date) { return d.toISOString(); }
function dateStr(d: Date) { return format(d, "yyyy-MM-dd"); }

// ── KPIs ──
export function useWeeklyKpis(week: WeekRange) {
  const s = iso(week.start);
  const e = iso(week.end);
  const ds = dateStr(week.start);
  const de = dateStr(week.end);

  const prev = getWeekRange(-1 + Math.round((week.start.getTime() - startOfWeek(new Date(), { weekStartsOn: 1 }).getTime()) / (7 * 86400000)));

  return useQuery({
    queryKey: ["weekly-kpis", ds, de],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // Previous week for comparison
      const ps = iso(addWeeks(week.start, -1));
      const pe = iso(addWeeks(week.end, -1));
      const pds = dateStr(addWeeks(week.start, -1));
      const pde = dateStr(addWeeks(week.end, -1));

      const [
        { count: novosLeads },
        { count: prevNovosLeads },
        { count: aproveitadosOA },
        { count: prevAproveitadosOA },
        { count: avancosCount },
        { count: prevAvancosCount },
        { count: visitasRealizadas },
        { count: prevVisitasRealizadas },
        { count: negociosAbertos },
        { count: prevNegociosAbertos },
        { data: assinados },
        { data: prevAssinados },
      ] = await Promise.all([
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).gte("created_at", s).lte("created_at", e),
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).gte("created_at", ps).lte("created_at", pe),
        supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).eq("resultado", "com_interesse").gte("created_at", s).lte("created_at", e),
        supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).eq("resultado", "com_interesse").gte("created_at", ps).lte("created_at", pe),
        supabase.from("pipeline_historico").select("id", { count: "exact", head: true }).gte("created_at", s).lte("created_at", e),
        supabase.from("pipeline_historico").select("id", { count: "exact", head: true }).gte("created_at", ps).lte("created_at", pe),
        supabase.from("visitas").select("id", { count: "exact", head: true }).eq("status", "realizada").gte("data_visita", ds).lte("data_visita", de),
        supabase.from("visitas").select("id", { count: "exact", head: true }).eq("status", "realizada").gte("data_visita", pds).lte("data_visita", pde),
        supabase.from("negocios").select("id", { count: "exact", head: true }).gte("updated_at", s).lte("updated_at", e),
        supabase.from("negocios").select("id", { count: "exact", head: true }).gte("updated_at", ps).lte("updated_at", pe),
        supabase.from("negocios").select("id, vgv_final").in("fase", ["assinado", "vendido"]).gte("data_assinatura", ds).lte("data_assinatura", de),
        supabase.from("negocios").select("id, vgv_final").in("fase", ["assinado", "vendido"]).gte("data_assinatura", pds).lte("data_assinatura", pde),
      ]);

      const vgvAssinado = (assinados || []).reduce((sum, n) => sum + (n.vgv_final || 0), 0);
      const prevVgvAssinado = (prevAssinados || []).reduce((sum, n) => sum + (n.vgv_final || 0), 0);

      return {
        novosLeads: { current: novosLeads ?? 0, prev: prevNovosLeads ?? 0 },
        aproveitadosOA: { current: aproveitadosOA ?? 0, prev: prevAproveitadosOA ?? 0 },
        avancosPipeline: { current: avancosCount ?? 0, prev: prevAvancosCount ?? 0 },
        visitasRealizadas: { current: visitasRealizadas ?? 0, prev: prevVisitasRealizadas ?? 0 },
        negociosAbertos: { current: negociosAbertos ?? 0, prev: prevNegociosAbertos ?? 0 },
        assinados: { current: (assinados || []).length, prev: (prevAssinados || []).length, vgv: vgvAssinado, prevVgv: prevVgvAssinado },
      };
    },
  });
}

// ── Leads by Origin ──
export function useLeadsByOrigin(week: WeekRange) {
  return useQuery({
    queryKey: ["weekly-leads-origin", dateStr(week.start)],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_leads").select("origem").gte("created_at", iso(week.start)).lte("created_at", iso(week.end));
      const map: Record<string, number> = {};
      (data || []).forEach(l => {
        const o = l.origem || "Outros";
        map[o] = (map[o] || 0) + 1;
      });
      return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
    },
  });
}

// ── Leads by Empreendimento ──
export function useLeadsByEmpreendimento(week: WeekRange) {
  return useQuery({
    queryKey: ["weekly-leads-emp", dateStr(week.start)],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_leads").select("empreendimento").gte("created_at", iso(week.start)).lte("created_at", iso(week.end));
      const map: Record<string, number> = {};
      (data || []).forEach(l => {
        const emp = l.empreendimento || "Sem empreendimento";
        map[emp] = (map[emp] || 0) + 1;
      });
      return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
    },
  });
}

// ── Funnel ──
export function useFunnelData(week: WeekRange) {
  return useQuery({
    queryKey: ["weekly-funnel", dateStr(week.start)],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [{ data: stages }, { data: leads }] = await Promise.all([
        supabase.from("pipeline_stages").select("id, nome, ordem").eq("ativo", true).eq("pipeline_tipo", "leads").order("ordem"),
        supabase.from("pipeline_leads").select("stage_id"),
      ]);
      if (!stages) return [];
      const countMap: Record<string, number> = {};
      (leads || []).forEach(l => { countMap[l.stage_id] = (countMap[l.stage_id] || 0) + 1; });
      return stages.map((s, i) => {
        const count = countMap[s.id] || 0;
        const nextCount = i < stages.length - 1 ? (countMap[stages[i + 1].id] || 0) : 0;
        const conversionRate = count > 0 ? Math.round((nextCount / count) * 100) : 0;
        return { id: s.id, nome: s.nome, ordem: s.ordem, count, conversionRate };
      });
    },
  });
}

// ── Visits by day ──
export function useVisitsByDay(week: WeekRange) {
  return useQuery({
    queryKey: ["weekly-visits-day", dateStr(week.start)],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const ds = dateStr(week.start);
      const de = dateStr(week.end);
      const { data } = await supabase.from("visitas").select("data_visita, status").gte("data_visita", ds).lte("data_visita", de);
      const days = eachDayOfInterval({ start: week.start, end: week.end });
      return days.map(day => {
        const dayStr = dateStr(day);
        const dayVisits = (data || []).filter(v => v.data_visita === dayStr);
        const marcadas = dayVisits.length;
        const confirmadas = dayVisits.filter(v => v.status === "confirmada" || v.status === "realizada").length;
        const realizadas = dayVisits.filter(v => v.status === "realizada").length;
        const noShow = dayVisits.filter(v => v.status === "no_show").length;
        const canceladas = dayVisits.filter(v => v.status === "cancelada").length;
        const taxa = marcadas > 0 ? Math.round((realizadas / marcadas) * 100) : 0;
        return {
          dia: format(day, "EEE dd/MM", { locale: ptBR }),
          diaShort: format(day, "EEEE", { locale: ptBR }),
          marcadas, confirmadas, realizadas, noShow, canceladas, taxa,
        };
      });
    },
  });
}

// ── Deals ──
export function useWeeklyDeals(week: WeekRange) {
  const ds = dateStr(week.start);
  const de = dateStr(week.end);
  return useQuery({
    queryKey: ["weekly-deals", ds],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: allDeals } = await supabase.from("negocios").select("id, fase, vgv_estimado, vgv_final, nome_cliente, empreendimento, corretor_id, data_assinatura");
      const fases = ["proposta", "negociacao", "documentacao", "assinado", "vendido"];
      const pipeline = fases.map(f => {
        const deals = (allDeals || []).filter(d => d.fase === f);
        const vgv = deals.reduce((s, d) => s + (d.vgv_final || d.vgv_estimado || 0), 0);
        return { fase: f, count: deals.length, vgv };
      });

      const assinados = (allDeals || []).filter(d => ["assinado", "vendido"].includes(d.fase || "") && d.data_assinatura && d.data_assinatura >= ds && d.data_assinatura <= de)
        .sort((a, b) => (b.vgv_final || 0) - (a.vgv_final || 0));

      // Resolve corretor names
      const corretorIds = [...new Set(assinados.map(d => d.corretor_id).filter(Boolean))];
      let corretorMap: Record<string, string> = {};
      if (corretorIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, nome").in("id", corretorIds as string[]);
        (profiles || []).forEach(p => { corretorMap[p.id] = p.nome; });
      }

      return {
        pipeline,
        assinados: assinados.map(d => ({
          ...d,
          corretor_nome: corretorMap[d.corretor_id || ""] || "—",
        })),
      };
    },
  });
}

// ── Rankings ──
export function useWeeklyRankings(week: WeekRange) {
  const s = iso(week.start);
  const e = iso(week.end);
  const ds = dateStr(week.start);
  const de = dateStr(week.end);

  return useQuery({
    queryKey: ["weekly-rankings", ds],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // Fetch team members + profiles
      const [{ data: members }, { data: tentativas }, { data: historico }, { data: visitas }, { data: negociosData }] = await Promise.all([
        supabase.from("team_members").select("id, nome, equipe, gerente_id, user_id").eq("status", "ativo"),
        supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado").gte("created_at", s).lte("created_at", e),
        supabase.from("pipeline_historico").select("movido_por").gte("created_at", s).lte("created_at", e),
        supabase.from("visitas").select("corretor_id, status").gte("data_visita", ds).lte("data_visita", de),
        supabase.from("negocios").select("corretor_id, vgv_final, fase, data_assinatura").in("fase", ["assinado", "vendido"]).gte("data_assinatura", ds).lte("data_assinatura", de),
      ]);

      const corretores = (members || []).map(m => {
        const userId = m.user_id || m.id;
        const aproveitados = (tentativas || []).filter(t => t.corretor_id === userId && t.resultado === "com_interesse").length;
        const avancos = (historico || []).filter(h => h.movido_por === userId).length;
        const myVisitas = (visitas || []).filter(v => v.corretor_id === userId);
        const visitasMarcadas = myVisitas.length;
        const visitasRealizadas = myVisitas.filter(v => v.status === "realizada").length;
        const taxaVisitas = visitasMarcadas >= 3 ? Math.round((visitasRealizadas / visitasMarcadas) * 100) : 0;
        const vgv = (negociosData || []).filter(n => n.corretor_id === userId).reduce((s, n) => s + (n.vgv_final || 0), 0);
        const score = (aproveitados * 0.2) + (avancos * 0.3) + (vgv / 100000 * 0.4) + (taxaVisitas * 0.001 * 0.1);
        return { id: m.id, nome: m.nome, equipe: m.equipe || "—", aproveitados, avancos, visitasMarcadas, visitasRealizadas, taxaVisitas, vgv, score };
      });

      // Top 3 per category
      const topProspeccao = [...corretores].sort((a, b) => b.aproveitados - a.aproveitados).slice(0, 3);
      const topGestao = [...corretores].sort((a, b) => b.avancos - a.avancos).slice(0, 3);
      const topVisitas = [...corretores].filter(c => c.visitasMarcadas >= 3).sort((a, b) => b.taxaVisitas - a.taxaVisitas).slice(0, 3);
      const topVendas = [...corretores].sort((a, b) => b.vgv - a.vgv).slice(0, 3);

      // Team aggregation
      const teamMap: Record<string, { equipe: string; leads: number; aproveitados: number; visitasRealizadas: number; assinados: number; vgv: number; score: number }> = {};
      corretores.forEach(c => {
        if (!teamMap[c.equipe]) teamMap[c.equipe] = { equipe: c.equipe, leads: 0, aproveitados: 0, visitasRealizadas: 0, assinados: 0, vgv: 0, score: 0 };
        teamMap[c.equipe].aproveitados += c.aproveitados;
        teamMap[c.equipe].visitasRealizadas += c.visitasRealizadas;
        teamMap[c.equipe].vgv += c.vgv;
        teamMap[c.equipe].score += c.score;
      });
      const teams = Object.values(teamMap).sort((a, b) => b.score - a.score);

      const top10 = [...corretores].sort((a, b) => b.score - a.score).slice(0, 10);

      return { topProspeccao, topGestao, topVisitas, topVendas, teams, top10 };
    },
  });
}
