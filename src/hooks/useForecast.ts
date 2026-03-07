import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface ForecastGerente {
  gerente_id: string;
  gerente_nome: string;
  visitas_realizadas: number;
  propostas_reais: number;
  vendas_reais: number;
  vgv_real: number;
  conv_visita_proposta: number;
  conv_proposta_venda: number;
  ticket_medio: number;
  propostas_estimadas: number;
  vendas_previstas: number;
  vgv_previsto: number;
  meta_vendas: number;
  meta_vgv: number;
}

export interface ForecastData {
  gerentes: ForecastGerente[];
  consolidado: {
    visitas_realizadas: number;
    propostas_estimadas: number;
    vendas_previstas: number;
    vgv_previsto: number;
    meta_vendas: number;
    meta_vgv: number;
  };
  loading: boolean;
  reload: () => void;
}

const DEFAULT_CONV_VP = 0.22; // 22% visita → proposta
const DEFAULT_CONV_PV = 0.33; // 33% proposta → venda

export function useForecast(): ForecastData {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [gerentes, setGerentes] = useState<ForecastGerente[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    const mesStart = format(startOfMonth(now), "yyyy-MM-dd");
    const mesEnd = format(endOfMonth(now), "yyyy-MM-dd");
    const mesKey = format(now, "yyyy-MM");

    // Get gerente profiles
    const { data: profiles } = await supabase.from("profiles").select("user_id, nome");
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.nome]));

    // Determine which gerentes to show
    let gerenteIds: string[] = [];
    if (isAdmin) {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["gestor", "admin"]);
      gerenteIds = (roles || []).map(r => r.user_id);
    } else {
      gerenteIds = [user.id];
    }

    // Get checkpoints this month for visitas_realizadas
    let cpQuery = supabase.from("checkpoints").select("id, gerente_id").gte("data", mesStart).lte("data", mesEnd);
    if (!isAdmin) cpQuery = cpQuery.eq("gerente_id", user.id);
    const { data: cps } = await cpQuery;

    const cpIds = (cps || []).map(c => c.id);
    const cpGerenteMap = new Map<string, string[]>();
    for (const cp of (cps || [])) {
      const arr = cpGerenteMap.get(cp.gerente_id) || [];
      arr.push(cp.id);
      cpGerenteMap.set(cp.gerente_id, arr);
    }

    // Get checkpoint lines (source for visitas)
    let lines: any[] = [];
    if (cpIds.length > 0) {
      const { data } = await supabase.from("checkpoint_lines").select("*").in("checkpoint_id", cpIds);
      lines = data || [];
    }

    // Get PDN entries this month (single source of truth for proposals, sales, VGV)
    let pdnQuery = supabase.from("pdn_entries").select("*").eq("mes", mesKey);
    if (!isAdmin) pdnQuery = pdnQuery.eq("gerente_id", user.id);
    const { data: pdnData } = await pdnQuery;

    // Get ceo_metas_mensais
    let metasQuery = supabase.from("ceo_metas_mensais").select("*").eq("mes", mesKey);
    const { data: metas } = await metasQuery;
    const metaMap = new Map((metas || []).map(m => [m.gerente_id, m]));

    // Build per-gerente forecast
    const result: ForecastGerente[] = [];

    for (const gId of gerenteIds) {
      const gCpIds = cpGerenteMap.get(gId) || [];
      const gLines = lines.filter(l => gCpIds.includes(l.checkpoint_id));
      const gPdn = (pdnData || []).filter(p => p.gerente_id === gId);

      // Aggregate checkpoint data (visitas)
      let visitas_realizadas = 0;
      for (const l of gLines) {
        visitas_realizadas += l.real_visitas_realizadas ?? 0;
      }

      // PDN: propostas = gerado + assinado, vendas = assinado, VGV from assinado
      let propostas_reais = 0;
      let vendas_reais = 0;
      let vgv_real = 0;
      let vgv_gerado = 0;

      for (const p of gPdn) {
        if (p.situacao === 'gerado' || p.situacao === 'assinado') {
          propostas_reais += 1;
        }
        if (p.situacao === 'assinado') {
          vendas_reais += 1;
          vgv_real += Number(p.vgv ?? 0);
        }
        if (p.situacao === 'gerado') {
          vgv_gerado += Number(p.vgv ?? 0);
        }
      }

      // Conversion rates from real data or defaults
      const conv_visita_proposta = visitas_realizadas > 0 && propostas_reais > 0
        ? propostas_reais / visitas_realizadas
        : DEFAULT_CONV_VP;

      const conv_proposta_venda = propostas_reais > 0 && vendas_reais > 0
        ? vendas_reais / propostas_reais
        : DEFAULT_CONV_PV;

      const ticket_medio = vendas_reais > 0
        ? vgv_real / vendas_reais
        : (propostas_reais > 0 ? (vgv_real + vgv_gerado) / propostas_reais : 700000);

      // Predictions: use MAX of estimated vs real (real data is the floor)
      const propostas_estimadas = Math.max(propostas_reais, Math.round(visitas_realizadas * conv_visita_proposta));
      const vendas_previstas = Math.max(vendas_reais, Math.round(propostas_estimadas * conv_proposta_venda));
      const vgv_previsto = Math.max(vgv_real, vendas_previstas * ticket_medio);

      // Metas
      const meta = metaMap.get(gId);

      result.push({
        gerente_id: gId,
        gerente_nome: profileMap.get(gId) || "Gerente",
        visitas_realizadas,
        propostas_reais,
        vendas_reais,
        vgv_real,
        conv_visita_proposta,
        conv_proposta_venda,
        ticket_medio,
        propostas_estimadas,
        vendas_previstas,
        vgv_previsto,
        meta_vendas: meta ? Math.round(meta.meta_visitas_realizadas * DEFAULT_CONV_VP * DEFAULT_CONV_PV) : 0,
        meta_vgv: meta ? Number(meta.meta_vgv_assinado) : 0,
      });
    }

    result.sort((a, b) => b.vendas_previstas - a.vendas_previstas);
    setGerentes(result);
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const consolidado = {
    visitas_realizadas: gerentes.reduce((s, g) => s + g.visitas_realizadas, 0),
    propostas_estimadas: gerentes.reduce((s, g) => s + g.propostas_estimadas, 0),
    vendas_previstas: gerentes.reduce((s, g) => s + g.vendas_previstas, 0),
    vgv_previsto: gerentes.reduce((s, g) => s + g.vgv_previsto, 0),
    meta_vendas: gerentes.reduce((s, g) => s + g.meta_vendas, 0),
    meta_vgv: gerentes.reduce((s, g) => s + g.meta_vgv, 0),
  };

  return { gerentes, consolidado, loading, reload: load };
}
