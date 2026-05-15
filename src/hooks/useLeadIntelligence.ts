import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, startOfMonth, endOfMonth, subDays, format, getHours } from "date-fns";

export interface LeadIntelData {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  empreendimento: string | null;
  origem: string | null;
  plataforma: string | null;
  campanha: string | null;
  formulario: string | null;
  segmento_id: string | null;
  corretor_id: string | null;
  stage_id: string;
  primeiro_contato_em: string | null;
  created_at: string;
}

interface StageInfo {
  id: string;
  nome: string;
  tipo: string;
}

interface SegmentoInfo {
  id: string;
  nome: string;
}

export interface CampaignPerf {
  campanha: string;
  leads: number;
  taxaContato: number;
  visitas: number;
  vendas: number;
}

export interface SegmentoPerf {
  segmento: string;
  leads: number;
  taxaContato: number;
  visitas: number;
  vendas: number;
}

export interface CorretorPerf {
  nome: string;
  leadsRecebidos: number;
  taxaContato: number;
  visitas: number;
}

export interface OrigemPerf {
  origem: string;
  count: number;
}

export interface EmpreendimentoPerf {
  empreendimento: string;
  leads: number;
  taxaContato: number;
  visitas: number;
  vendas: number;
}

export interface HourlyData {
  hour: number;
  count: number;
}

export function useLeadIntelligence(periodo: string) {
  const [leads, setLeads] = useState<LeadIntelData[]>([]);
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [segmentos, setSegmentos] = useState<SegmentoInfo[]>([]);
  const [corretorNames, setCorretorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (periodo === "7d") return { start: subDays(now, 7).toISOString(), end: now.toISOString() };
    if (periodo === "30d") return { start: subDays(now, 30).toISOString(), end: now.toISOString() };
    if (periodo === "mes") return { start: startOfMonth(now).toISOString(), end: endOfMonth(now).toISOString() };
    // hoje
    return { start: startOfDay(now).toISOString(), end: now.toISOString() };
  }, [periodo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, stagesRes, segRes] = await Promise.all([
        supabase
          .from("pipeline_leads")
          .select("id, nome, telefone, email, empreendimento, origem, plataforma, campanha, formulario, segmento_id, corretor_id, stage_id, primeiro_contato_em, created_at")
          .gte("created_at", dateRange.start)
          .lte("created_at", dateRange.end)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase.from("pipeline_stages").select("id, nome, tipo").order("ordem"),
        supabase.from("pipeline_segmentos").select("id, nome"),
      ]);

      const leadsData = (leadsRes.data || []) as LeadIntelData[];
      setLeads(leadsData);
      setStages((stagesRes.data || []) as StageInfo[]);
      setSegmentos((segRes.data || []) as SegmentoInfo[]);

      // Fetch corretor names
      const cIds = [...new Set(leadsData.map(l => l.corretor_id).filter(Boolean))] as string[];
      if (cIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", cIds);
        const map: Record<string, string> = {};
        (profiles || []).forEach(p => { map[p.user_id] = p.nome || "Sem nome"; });
        setCorretorNames(map);
      }
    } catch (err) {
      console.error("Lead intelligence fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Stage map
  const stageMap = useMemo(() => new Map(stages.map(s => [s.id, s])), [stages]);
  const segMap = useMemo(() => new Map(segmentos.map(s => [s.id, s.nome])), [segmentos]);

  // Helpers
  const hasContato = (l: LeadIntelData) => !!l.primeiro_contato_em;
  const isVisita = (l: LeadIntelData) => {
    const s = stageMap.get(l.stage_id);
    return s && ["visita", "pos_visita", "visita_marcada", "visita_realizada"].includes(s.tipo);
  };
  const isVenda = (l: LeadIntelData) => {
    const s = stageMap.get(l.stage_id);
    return s && ["venda", "assinado"].includes(s.tipo);
  };
  const isProposta = (l: LeadIntelData) => {
    const s = stageMap.get(l.stage_id);
    return s && ["proposta", "negociacao"].includes(s.tipo);
  };

  // KPIs
  const kpis = useMemo(() => {
    const today = startOfDay(new Date()).toISOString();
    const leadsHoje = leads.filter(l => l.created_at >= today).length;
    const totalLeads = leads.length;
    const contatados = leads.filter(hasContato).length;
    const visitas = leads.filter(isVisita).length + leads.filter(isProposta).length;
    const vendas = leads.filter(isVenda).length;
    return {
      leadsHoje,
      leadsMes: totalLeads,
      taxaContato: totalLeads ? Math.round((contatados / totalLeads) * 100) : 0,
      taxaVisita: totalLeads ? Math.round((visitas / totalLeads) * 100) : 0,
      taxaVenda: totalLeads ? Math.round((vendas / totalLeads) * 100) : 0,
    };
  }, [leads, stageMap]);

  // Performance por campanha
  const campanhas = useMemo((): CampaignPerf[] => {
    const map = new Map<string, LeadIntelData[]>();
    leads.forEach(l => {
      const key = l.campanha || "Sem campanha";
      map.set(key, [...(map.get(key) || []), l]);
    });
    return [...map.entries()]
      .map(([campanha, arr]) => ({
        campanha,
        leads: arr.length,
        taxaContato: arr.length ? Math.round((arr.filter(hasContato).length / arr.length) * 100) : 0,
        visitas: arr.filter(l => isVisita(l) || isProposta(l)).length,
        vendas: arr.filter(isVenda).length,
      }))
      .sort((a, b) => b.leads - a.leads);
  }, [leads, stageMap]);

  // Performance por formulário
  const formularios = useMemo((): CampaignPerf[] => {
    const map = new Map<string, LeadIntelData[]>();
    leads.forEach(l => {
      const key = l.formulario || "Sem formulário";
      map.set(key, [...(map.get(key) || []), l]);
    });
    return [...map.entries()]
      .map(([campanha, arr]) => ({
        campanha,
        leads: arr.length,
        taxaContato: arr.length ? Math.round((arr.filter(hasContato).length / arr.length) * 100) : 0,
        visitas: arr.filter(l => isVisita(l) || isProposta(l)).length,
        vendas: arr.filter(isVenda).length,
      }))
      .sort((a, b) => b.leads - a.leads);
  }, [leads, stageMap]);

  // Performance por segmento
  const segmentoPerf = useMemo((): SegmentoPerf[] => {
    const map = new Map<string, LeadIntelData[]>();
    leads.forEach(l => {
      const key = l.segmento_id ? (segMap.get(l.segmento_id) || "Outro") : "Sem segmento";
      map.set(key, [...(map.get(key) || []), l]);
    });
    return [...map.entries()]
      .map(([segmento, arr]) => ({
        segmento,
        leads: arr.length,
        taxaContato: arr.length ? Math.round((arr.filter(hasContato).length / arr.length) * 100) : 0,
        visitas: arr.filter(l => isVisita(l) || isProposta(l)).length,
        vendas: arr.filter(isVenda).length,
      }))
      .sort((a, b) => b.leads - a.leads);
  }, [leads, stageMap, segMap]);

  // Performance por corretor
  const corretorPerf = useMemo((): CorretorPerf[] => {
    const map = new Map<string, LeadIntelData[]>();
    leads.filter(l => l.corretor_id).forEach(l => {
      map.set(l.corretor_id!, [...(map.get(l.corretor_id!) || []), l]);
    });
    return [...map.entries()]
      .map(([cid, arr]) => ({
        nome: corretorNames[cid] || "Desconhecido",
        leadsRecebidos: arr.length,
        taxaContato: arr.length ? Math.round((arr.filter(hasContato).length / arr.length) * 100) : 0,
        visitas: arr.filter(l => isVisita(l) || isProposta(l)).length,
      }))
      .sort((a, b) => b.leadsRecebidos - a.leadsRecebidos);
  }, [leads, stageMap, corretorNames]);

  // Origem dos leads
  const origemPerf = useMemo((): OrigemPerf[] => {
    const map = new Map<string, number>();
    leads.forEach(l => {
      const key = l.plataforma || l.origem || "Não identificado";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()]
      .map(([origem, count]) => ({ origem, count }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  // Ranking empreendimentos (full performance)
  const empreendimentoPerf = useMemo((): EmpreendimentoPerf[] => {
    const map = new Map<string, LeadIntelData[]>();
    leads.forEach(l => {
      const key = l.empreendimento || "Não informado";
      map.set(key, [...(map.get(key) || []), l]);
    });
    return [...map.entries()]
      .map(([empreendimento, arr]) => ({
        empreendimento,
        leads: arr.length,
        taxaContato: arr.length ? Math.round((arr.filter(hasContato).length / arr.length) * 100) : 0,
        visitas: arr.filter(l => isVisita(l) || isProposta(l)).length,
        vendas: arr.filter(isVenda).length,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 20);
  }, [leads, stageMap]);

  // Leads por horário
  const hourlyData = useMemo((): HourlyData[] => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    leads.forEach(l => {
      const h = getHours(new Date(l.created_at));
      hours[h].count++;
    });
    return hours;
  }, [leads]);

  return {
    loading,
    leads,
    kpis,
    campanhas,
    formularios,
    segmentoPerf,
    corretorPerf,
    origemPerf,
    empreendimentoPerf,
    hourlyData,
    reload: fetchData,
  };
}
