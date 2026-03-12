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
    const { data: gerenteRoles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
    const gerenteUserIds = new Set((gerenteRoles || []).map(r => r.user_id));

    // Get all checkpoints in range (admin sees all)
    let cpQuery = supabase.from("checkpoints").select("id, data, gerente_id").gte("data", dateRange.start).lte("data", dateRange.end);
    if (filterGerenteId) cpQuery = cpQuery.eq("gerente_id", filterGerenteId);
    const { data: cps } = await cpQuery;

    const cpIds = (cps || []).map(c => c.id);
    // Only include gerente_ids that actually have the 'gestor' role (exclude admin-only like CEO)
    const gerenteIdsFromCps = [...new Set((cps || []).map(c => c.gerente_id))].filter(id => gerenteUserIds.has(id));
    
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
    const { data: allTeam } = await supabase.from("team_members").select("id, user_id, nome, gerente_id").in("gerente_id", gerenteIdsAll);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.nome]));
    const teamMap = new Map((allTeam || []).map(t => [t.id, t]));
    // Map team_members.id → user_id for ID resolution
    const teamIdToUserId = new Map((allTeam || []).filter(t => t.user_id).map(t => [t.id, t.user_id!]));
    const userIdToTeamId = new Map((allTeam || []).filter(t => t.user_id).map(t => [t.user_id!, t.id]));

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

    // Agg per corretor — USE user_id as canonical corretor_id (not team_members.id)
    const corretorAggMap = new Map<string, CorretorAgg>();

    for (const t of (allTeam || [])) {
      const canonicalId = t.user_id || t.id; // Prefer auth.user_id
      corretorAggMap.set(canonicalId, {
        corretor_id: canonicalId, corretor_nome: t.nome, gerente_id: t.gerente_id, gerente_nome: profileMap.get(t.gerente_id) || "Gerente",
        meta_ligacoes: 0, real_ligacoes: 0, meta_visitas_marcadas: 0, real_visitas_marcadas: 0,
        meta_visitas_realizadas: 0, real_visitas_realizadas: 0, meta_propostas: 0, real_propostas: 0,
        meta_vgv_gerado: 0, real_vgv_gerado: 0, meta_vgv_assinado: 0, real_vgv_assinado: 0, score: 0,
      });
    }

    for (const l of (lines || [])) {
      // checkpoint_lines.corretor_id = team_members.id, resolve to user_id
      const userId = teamIdToUserId.get(l.corretor_id) || l.corretor_id;
      const agg = corretorAggMap.get(userId);
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

    // VGV from negocios (source of truth) — use data_assinatura for assinado/vendido, created_at for others
    const mesKey = dateRange.start.slice(0, 7);
    
    // Fetch assinado+vendido deals by data_assinatura (source of truth for VGV)
    let negAssinadoQuery = supabase.from("negocios").select("id, gerente_id, corretor_id, vgv_estimado, vgv_final, fase, nome_cliente, pipeline_lead_id")
      .in("fase", ["assinado", "vendido"])
      .gte("data_assinatura", dateRange.start)
      .lte("data_assinatura", dateRange.end);
    if (filterGerenteId) negAssinadoQuery = negAssinadoQuery.eq("gerente_id", filterGerenteId);
    
    // Fetch proposal/negotiation deals by created_at
    let negPropostaQuery = supabase.from("negocios").select("id, gerente_id, corretor_id, vgv_estimado, vgv_final, fase, nome_cliente, pipeline_lead_id")
      .in("fase", ["proposta", "negociacao", "documentacao"])
      .gte("created_at", `${mesKey}-01`)
      .lt("created_at", `${mesKey}-32`);
    if (filterGerenteId) negPropostaQuery = negPropostaQuery.eq("gerente_id", filterGerenteId);
    
    const [{ data: pdnsAssinado }, { data: pdnsProposta }] = await Promise.all([negAssinadoQuery, negPropostaQuery]);
    const pdns = [...(pdnsAssinado || []), ...(pdnsProposta || [])];

    // Load partnerships for split VGV calculation
    const pipelineLeadIdsForParcerias = pdns.map(p => p.pipeline_lead_id).filter(Boolean) as string[];
    let parceriaMap = new Map<string, { principal_id: string; parceiro_id: string; divisao_principal: number; divisao_parceiro: number }>();
    if (pipelineLeadIdsForParcerias.length > 0) {
      const { data: parcerias } = await supabase.from("pipeline_parcerias")
        .select("pipeline_lead_id, corretor_principal_id, corretor_parceiro_id, divisao_principal, divisao_parceiro")
        .eq("status", "ativa")
        .in("pipeline_lead_id", pipelineLeadIdsForParcerias);
      (parcerias || []).forEach(p => {
        parceriaMap.set(p.pipeline_lead_id, {
          principal_id: p.corretor_principal_id,
          parceiro_id: p.corretor_parceiro_id,
          divisao_principal: p.divisao_principal || 50,
          divisao_parceiro: p.divisao_parceiro || 50,
        });
      });
    }

    // Build mapping: profiles.id → team_members.id via user_id
    const negCorretorIds = [...new Set((pdns || []).map(p => p.corretor_id).filter(Boolean))] as string[];
    // Also include partnership user IDs for profile resolution
    const parceriaUserIds = [...parceriaMap.values()].flatMap(p => [p.principal_id, p.parceiro_id]);
    const allCorretorIdsForProfiles = [...new Set([...negCorretorIds, ...parceriaUserIds])];
    
    // Build mapping: profiles.id → auth.user_id for VGV assignment to canonical corretor ID
    const profileIdToAuthId = new Map<string, string>();
    // Also build auth.user_id → profiles.id for partnership resolution
    const authIdToProfileId = new Map<string, string>();
    
    if (allCorretorIdsForProfiles.length > 0) {
      // Query by both id and user_id to handle both profile IDs and auth user IDs
      const { data: cProfiles } = await supabase.from("profiles").select("id, user_id").in("id", allCorretorIdsForProfiles);
      (cProfiles || []).forEach(p => {
        if (p.user_id) {
          profileIdToAuthId.set(p.id, p.user_id);
          authIdToProfileId.set(p.user_id, p.id);
        }
      });
      // Also check by user_id for partnership IDs that might be auth user IDs
      const missingIds = allCorretorIdsForProfiles.filter(id => !profileIdToAuthId.has(id));
      if (missingIds.length > 0) {
        const { data: cProfiles2 } = await supabase.from("profiles").select("id, user_id").in("user_id", missingIds);
        (cProfiles2 || []).forEach(p => {
          if (p.user_id) {
            profileIdToAuthId.set(p.id, p.user_id);
            authIdToProfileId.set(p.user_id, p.id);
          }
        });
      }
    }

    // Helper to resolve any ID (profile or auth) to canonical auth user_id
    const resolveToAuthId = (id: string): string | null => {
      // If it's a profile.id, map to auth user_id
      if (profileIdToAuthId.has(id)) return profileIdToAuthId.get(id)!;
      // If it's already an auth user_id (check if it maps to a corretor in our map)
      if (corretorAggMap.has(id)) return id;
      return null;
    };

    // Build VGV + Propostas per gerente from negocios (single source of truth)
    const pdnByGerente = new Map<string, { gerado: number; assinado: number; propostas_count: number }>();
    for (const p of (pdns || [])) {
      const gId = p.gerente_id;
      if (!gId) continue;
      const curr = pdnByGerente.get(gId) || { gerado: 0, assinado: 0, propostas_count: 0 };
      const fase = p.fase || "";
      const vgv = Number(p.vgv_final || p.vgv_estimado || 0);
      if (fase === "proposta" || fase === "negociacao" || fase === "documentacao") { curr.gerado += vgv; curr.propostas_count++; }
      if (fase === "assinado" || fase === "vendido") curr.assinado += vgv;
      pdnByGerente.set(gId, curr);

      // Assign VGV to corretor(s) — handle partnership splits
      const parceria = p.pipeline_lead_id ? parceriaMap.get(p.pipeline_lead_id) : undefined;
      
      if (parceria) {
        // Split VGV between partners
        const principalAuthId = resolveToAuthId(parceria.principal_id);
        const parceiroAuthId = resolveToAuthId(parceria.parceiro_id);
        const vgvPrincipal = vgv * (parceria.divisao_principal / 100);
        const vgvParceiro = vgv * (parceria.divisao_parceiro / 100);

        if (principalAuthId) {
          const agg = corretorAggMap.get(principalAuthId);
          if (agg) {
            if (fase === "proposta" || fase === "negociacao" || fase === "documentacao") agg.real_vgv_gerado += vgvPrincipal;
            if (fase === "assinado" || fase === "vendido") agg.real_vgv_assinado += vgvPrincipal;
          }
        }
        if (parceiroAuthId) {
          const agg = corretorAggMap.get(parceiroAuthId);
          if (agg) {
            if (fase === "proposta" || fase === "negociacao" || fase === "documentacao") agg.real_vgv_gerado += vgvParceiro;
            if (fase === "assinado" || fase === "vendido") agg.real_vgv_assinado += vgvParceiro;
          }
        }
      } else if (p.corretor_id) {
        // No partnership — assign full VGV to single corretor
        const authUserId = profileIdToAuthId.get(p.corretor_id);
        if (authUserId) {
          const agg = corretorAggMap.get(authUserId);
          if (agg) {
            if (fase === "proposta" || fase === "negociacao" || fase === "documentacao") agg.real_vgv_gerado += vgv;
            if (fase === "assinado" || fase === "vendido") agg.real_vgv_assinado += vgv;
          }
        }
      }
    }

    // Get CEO metas for VGV meta values
    const { data: ceoMetas } = await supabase.from("ceo_metas_mensais").select("gerente_id, meta_vgv_assinado").eq("mes", mesKey).in("gerente_id", gerenteIdsAll);
    const metaVgvMap = new Map((ceoMetas || []).map((m: any) => [m.gerente_id, Number(m.meta_vgv_assinado || 0)]));

    // Set VGV + Propostas totals on gerente level from PDN
    for (const gId of gerenteIdsAll) {
      const pdn = pdnByGerente.get(gId) || { gerado: 0, assinado: 0, propostas_count: 0 };
      const g = gerenteMap.get(gId);
      if (g) {
        g.totals.real_vgv_gerado = pdn.gerado;
        g.totals.real_vgv_assinado = pdn.assinado;
        g.totals.meta_vgv_assinado = metaVgvMap.get(gId) || 0;
        // Override checkpoint propostas with PDN count (single source of truth)
        g.totals.real_propostas = pdn.propostas_count;
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
        // Propostas already set from PDN at gerente level — don't accumulate from checkpoint_lines
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
