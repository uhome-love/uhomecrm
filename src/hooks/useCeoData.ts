import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export type CeoPeriod = "dia" | "semana" | "mes" | "custom";

export interface CorretorAgg {
  corretor_id: string;
  corretor_nome: string;
  gerente_nome: string;
  gerente_id: string;
  meta_ligacoes: number; real_ligacoes: number;
  meta_visitas_marcadas: number; real_visitas_marcadas: number;
  meta_visitas_realizadas: number; real_visitas_realizadas: number;
  meta_propostas: number; real_propostas: number;
  meta_vgv_gerado: number; real_vgv_gerado: number;
  meta_vgv_assinado: number; real_vgv_assinado: number;
  score: number;
}

export interface GerenteAgg {
  gerente_id: string;
  gerente_nome: string;
  corretores: CorretorAgg[];
  totals: Omit<CorretorAgg, "corretor_id" | "corretor_nome" | "gerente_nome" | "gerente_id" | "score"> & { score: number };
}

export interface CompanyTotals {
  meta_ligacoes: number; real_ligacoes: number;
  meta_visitas_marcadas: number; real_visitas_marcadas: number;
  meta_visitas_realizadas: number; real_visitas_realizadas: number;
  meta_propostas: number; real_propostas: number;
  meta_vgv_gerado: number; real_vgv_gerado: number;
  meta_vgv_assinado: number; real_vgv_assinado: number;
}

const WEIGHTS = {
  ligacoes: 10,
  visitas_marcadas: 15,
  visitas_realizadas: 25,
  propostas: 25,
  vgv_assinado: 25,
};

function calcScore(r: { meta_ligacoes: number; real_ligacoes: number; meta_visitas_marcadas: number; real_visitas_marcadas: number; meta_visitas_realizadas: number; real_visitas_realizadas: number; meta_propostas: number; real_propostas: number; meta_vgv_assinado: number; real_vgv_assinado: number }) {
  const pct = (real: number, meta: number) => meta > 0 ? Math.min(real / meta, 1.5) : 0;
  const s =
    pct(r.real_ligacoes, r.meta_ligacoes) * WEIGHTS.ligacoes +
    pct(r.real_visitas_marcadas, r.meta_visitas_marcadas) * WEIGHTS.visitas_marcadas +
    pct(r.real_visitas_realizadas, r.meta_visitas_realizadas) * WEIGHTS.visitas_realizadas +
    pct(r.real_propostas, r.meta_propostas) * WEIGHTS.propostas +
    pct(r.real_vgv_assinado, r.meta_vgv_assinado) * WEIGHTS.vgv_assinado;
  return Math.round(s);
}

export function pct(real: number, meta: number) {
  return meta > 0 ? Math.round((real / meta) * 100) : 0;
}

export function useCeoData(period: CeoPeriod, customStart?: string, customEnd?: string, filterGerenteId?: string) {
  const [gerentes, setGerentes] = useState<GerenteAgg[]>([]);
  const [companyTotals, setCompanyTotals] = useState<CompanyTotals>({
    meta_ligacoes: 0, real_ligacoes: 0, meta_visitas_marcadas: 0, real_visitas_marcadas: 0,
    meta_visitas_realizadas: 0, real_visitas_realizadas: 0, meta_propostas: 0, real_propostas: 0,
    meta_vgv_gerado: 0, real_vgv_gerado: 0, meta_vgv_assinado: 0, real_vgv_assinado: 0,
  });
  const [loading, setLoading] = useState(true);
  const [prevWeekTotals, setPrevWeekTotals] = useState<CompanyTotals | null>(null);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === "dia") return { start: format(now, "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
    if (period === "semana") return { start: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), end: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    if (period === "mes") return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
    return { start: customStart || format(now, "yyyy-MM-dd"), end: customEnd || format(now, "yyyy-MM-dd") };
  }, [period, customStart, customEnd]);

  const load = useCallback(async () => {
    setLoading(true);

    // Get all profiles with cargo=gerente or gestor role
    const { data: profiles } = await supabase.from("profiles").select("user_id, nome");
    const { data: gerenteRoles } = await supabase.from("user_roles").select("user_id").in("role", ["gestor", "admin"]);
    const gerenteUserIds = new Set((gerenteRoles || []).map(r => r.user_id));

    // Get all checkpoints in range (admin sees all)
    let cpQuery = supabase.from("checkpoints").select("id, data, gerente_id").gte("data", dateRange.start).lte("data", dateRange.end);
    if (filterGerenteId) cpQuery = cpQuery.eq("gerente_id", filterGerenteId);
    const { data: cps } = await cpQuery;

    const cpIds = (cps || []).map(c => c.id);
    const gerenteIdsFromCps = [...new Set((cps || []).map(c => c.gerente_id))];
    
    // Even with no checkpoints, still load PDN data
    // Get gerente IDs from either checkpoints or the filter
    let gerenteIds: string[] = gerenteIdsFromCps;
    if (gerenteIds.length === 0 && filterGerenteId) {
      gerenteIds = [filterGerenteId];
    } else if (gerenteIds.length === 0) {
      // Get all gestores
      const gestorIds = Array.from(gerenteUserIds);
      gerenteIds = gestorIds;
    }
    
    if (gerenteIds.length === 0) { setGerentes([]); setLoading(false); return; }
    const cpMap = new Map((cps || []).map(c => [c.id, c]));

    // Get all lines (without VGV - VGV comes from PDN)
    const { data: lines } = cpIds.length > 0
      ? await supabase.from("checkpoint_lines").select("*").in("checkpoint_id", cpIds)
      : { data: [] };

    // Get all team members for relevant gerentes
    const gerenteIdsAll = [...new Set([...gerenteIds])];
    const { data: allTeam } = await supabase.from("team_members").select("id, nome, gerente_id").in("gerente_id", gerenteIdsAll);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.nome]));
    const teamMap = new Map((allTeam || []).map(t => [t.id, t]));

    // Aggregate per corretor per gerente
    const gerenteMap = new Map<string, GerenteAgg>();
    for (const gId of gerenteIdsAll) {
      gerenteMap.set(gId, {
        gerente_id: gId,
        gerente_nome: profileMap.get(gId) || "Gerente",
        corretores: [],
        totals: { meta_ligacoes: 0, real_ligacoes: 0, meta_visitas_marcadas: 0, real_visitas_marcadas: 0, meta_visitas_realizadas: 0, real_visitas_realizadas: 0, meta_propostas: 0, real_propostas: 0, meta_vgv_gerado: 0, real_vgv_gerado: 0, meta_vgv_assinado: 0, real_vgv_assinado: 0, score: 0 },
      });
    }

    // Agg per corretor (checkpoint data: ligações, visitas, propostas — NO VGV)
    const corretorAggMap = new Map<string, CorretorAgg>();

    for (const t of (allTeam || [])) {
      corretorAggMap.set(t.id, {
        corretor_id: t.id, corretor_nome: t.nome, gerente_id: t.gerente_id, gerente_nome: profileMap.get(t.gerente_id) || "Gerente",
        meta_ligacoes: 0, real_ligacoes: 0, meta_visitas_marcadas: 0, real_visitas_marcadas: 0,
        meta_visitas_realizadas: 0, real_visitas_realizadas: 0, meta_propostas: 0, real_propostas: 0,
        meta_vgv_gerado: 0, real_vgv_gerado: 0, meta_vgv_assinado: 0, real_vgv_assinado: 0, score: 0,
      });
    }

    for (const l of (lines || [])) {
      const agg = corretorAggMap.get(l.corretor_id);
      if (!agg) continue;
      agg.meta_ligacoes += l.meta_ligacoes ?? 0;
      agg.real_ligacoes += l.real_ligacoes ?? 0;
      agg.meta_visitas_marcadas += l.meta_visitas_marcadas ?? 0;
      agg.real_visitas_marcadas += l.real_visitas_marcadas ?? 0;
      agg.meta_visitas_realizadas += l.meta_visitas_realizadas ?? 0;
      agg.real_visitas_realizadas += l.real_visitas_realizadas ?? 0;
      agg.meta_propostas += l.meta_propostas ?? 0;
      agg.real_propostas += l.real_propostas ?? 0;
    }

    // VGV from PDN (source of truth) - by gerente
    const mesKey = dateRange.start.slice(0, 7);
    let pdnQuery = supabase.from("pdn_entries").select("gerente_id, corretor, vgv, situacao").eq("mes", mesKey);
    if (filterGerenteId) pdnQuery = pdnQuery.eq("gerente_id", filterGerenteId);
    const { data: pdns } = await pdnQuery;

    // Build VGV per gerente from PDN
    const vgvByGerente = new Map<string, { gerado: number; assinado: number }>();
    for (const p of (pdns || [])) {
      const curr = vgvByGerente.get(p.gerente_id) || { gerado: 0, assinado: 0 };
      if (p.situacao === "gerado") curr.gerado += Number(p.vgv || 0);
      if (p.situacao === "assinado") curr.assinado += Number(p.vgv || 0);
      vgvByGerente.set(p.gerente_id, curr);

      // Also try to assign VGV to corretor by name match
      if (p.corretor) {
        for (const [, agg] of corretorAggMap) {
          if (agg.corretor_nome === p.corretor && agg.gerente_id === p.gerente_id) {
            if (p.situacao === "gerado") agg.real_vgv_gerado += Number(p.vgv || 0);
            if (p.situacao === "assinado") agg.real_vgv_assinado += Number(p.vgv || 0);
          }
        }
      }
    }

    // Get CEO metas for VGV meta values
    const { data: ceoMetas } = await supabase.from("ceo_metas_mensais").select("gerente_id, meta_vgv_assinado").eq("mes", mesKey).in("gerente_id", gerenteIdsAll);
    const metaVgvMap = new Map((ceoMetas || []).map((m: any) => [m.gerente_id, Number(m.meta_vgv_assinado || 0)]));

    // Set VGV totals on gerente level from PDN
    for (const gId of gerenteIdsAll) {
      const vgv = vgvByGerente.get(gId) || { gerado: 0, assinado: 0 };
      const g = gerenteMap.get(gId);
      if (g) {
        g.totals.real_vgv_gerado = vgv.gerado;
        g.totals.real_vgv_assinado = vgv.assinado;
        g.totals.meta_vgv_assinado = metaVgvMap.get(gId) || 0;
      }
    }

    // Calc scores and assign to gerentes
    for (const [, agg] of corretorAggMap) {
      agg.score = calcScore(agg);
      const g = gerenteMap.get(agg.gerente_id);
      if (g) {
        g.corretores.push(agg);
        g.totals.meta_ligacoes += agg.meta_ligacoes; g.totals.real_ligacoes += agg.real_ligacoes;
        g.totals.meta_visitas_marcadas += agg.meta_visitas_marcadas; g.totals.real_visitas_marcadas += agg.real_visitas_marcadas;
        g.totals.meta_visitas_realizadas += agg.meta_visitas_realizadas; g.totals.real_visitas_realizadas += agg.real_visitas_realizadas;
        g.totals.meta_propostas += agg.meta_propostas; g.totals.real_propostas += agg.real_propostas;
        // VGV already set from PDN at gerente level — don't accumulate from corretores
      }
    }

    for (const [, g] of gerenteMap) {
      g.totals.score = calcScore(g.totals as any);
    }

    const gerentesArr = Array.from(gerenteMap.values()).sort((a, b) => b.totals.score - a.totals.score);
    setGerentes(gerentesArr);

    // Company totals
    const ct: CompanyTotals = { meta_ligacoes: 0, real_ligacoes: 0, meta_visitas_marcadas: 0, real_visitas_marcadas: 0, meta_visitas_realizadas: 0, real_visitas_realizadas: 0, meta_propostas: 0, real_propostas: 0, meta_vgv_gerado: 0, real_vgv_gerado: 0, meta_vgv_assinado: 0, real_vgv_assinado: 0 };
    for (const g of gerentesArr) {
      ct.meta_ligacoes += g.totals.meta_ligacoes; ct.real_ligacoes += g.totals.real_ligacoes;
      ct.meta_visitas_marcadas += g.totals.meta_visitas_marcadas; ct.real_visitas_marcadas += g.totals.real_visitas_marcadas;
      ct.meta_visitas_realizadas += g.totals.meta_visitas_realizadas; ct.real_visitas_realizadas += g.totals.real_visitas_realizadas;
      ct.meta_propostas += g.totals.meta_propostas; ct.real_propostas += g.totals.real_propostas;
      ct.meta_vgv_gerado += g.totals.meta_vgv_gerado; ct.real_vgv_gerado += g.totals.real_vgv_gerado;
      ct.meta_vgv_assinado += g.totals.meta_vgv_assinado; ct.real_vgv_assinado += g.totals.real_vgv_assinado;
    }
    setCompanyTotals(ct);
    setLoading(false);
  }, [dateRange, filterGerenteId]);

  useEffect(() => { load(); }, [load]);

  const allCorretores = useMemo(() => gerentes.flatMap(g => g.corretores).sort((a, b) => b.score - a.score), [gerentes]);

  return { gerentes, companyTotals, allCorretores, loading, dateRange, reload: load };
}
