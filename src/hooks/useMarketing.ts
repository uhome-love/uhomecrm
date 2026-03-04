import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MarketingEntry {
  id: string;
  report_id: string | null;
  user_id: string;
  canal: string;
  campanha: string | null;
  anuncio: string | null;
  empreendimento: string | null;
  periodo: string | null;
  investimento: number;
  impressoes: number;
  cliques: number;
  leads_gerados: number;
  conversoes: number;
  cpl: number | null;
  cpc: number | null;
  ctr: number | null;
  visitas: number;
  propostas: number;
  vendas: number;
  created_at: string;
}

export interface MarketingReport {
  id: string;
  user_id: string;
  nome_arquivo: string;
  canal: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  resumo_ia: string | null;
  created_at: string;
}

export interface ChannelStats {
  canal: string;
  investimento: number;
  leads: number;
  cliques: number;
  impressoes: number;
  cpl: number | null;
  cpc: number | null;
  ctr: number | null;
  visitas: number;
  propostas: number;
  vendas: number;
  custoVenda: number | null;
}

const CANAL_LABELS: Record<string, string> = {
  meta_ads: "Meta Ads",
  tiktok_ads: "TikTok Ads",
  portal_zap: "Zap Imóveis",
  portal_imovelweb: "Imovelweb",
  portal_vivareal: "Viva Real",
  site_uhome: "Site Uhome",
  google_ads: "Google Ads",
  outros: "Outros",
};

export function getCanalLabel(canal: string) {
  return CANAL_LABELS[canal] || canal;
}

export function useMarketing() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<MarketingEntry[]>([]);
  const [reports, setReports] = useState<MarketingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [entriesRes, reportsRes] = await Promise.all([
      supabase.from("marketing_entries").select("*").order("created_at", { ascending: false }),
      supabase.from("marketing_reports").select("*").order("created_at", { ascending: false }),
    ]);

    if (entriesRes.error) console.error(entriesRes.error);
    if (reportsRes.error) console.error(reportsRes.error);

    setEntries((entriesRes.data as MarketingEntry[]) || []);
    setReports((reportsRes.data as MarketingReport[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const importReport = useCallback(async (csvData: string, fileName: string) => {
    if (!user) return;
    setImporting(true);

    try {
      const { data, error } = await supabase.functions.invoke("parse-marketing-report", {
        body: { csvData, fileName },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const canal = data.canal || "outros";
      const parsedEntries = data.entries || [];

      // Save report
      const { data: reportData, error: reportError } = await supabase
        .from("marketing_reports")
        .insert({ user_id: user.id, nome_arquivo: fileName, canal, dados_brutos: parsedEntries } as any)
        .select()
        .single();

      if (reportError) throw reportError;

      // Save entries
      if (parsedEntries.length > 0) {
        const inserts = parsedEntries.map((e: any) => ({
          report_id: reportData.id,
          user_id: user.id,
          canal,
          campanha: e.campanha || null,
          anuncio: e.anuncio || null,
          empreendimento: e.empreendimento || null,
          periodo: e.periodo || null,
          investimento: e.investimento || 0,
          impressoes: e.impressoes || 0,
          cliques: e.cliques || 0,
          leads_gerados: e.leads_gerados || 0,
          conversoes: e.conversoes || 0,
        }));

        const { error: insertError } = await supabase.from("marketing_entries").insert(inserts as any);
        if (insertError) throw insertError;
      }

      toast.success(`Relatório importado: ${parsedEntries.length} linhas de ${getCanalLabel(canal)}`);
      load();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao importar relatório");
    } finally {
      setImporting(false);
    }
  }, [user, load]);

  const addManualEntry = useCallback(async (entry: Partial<MarketingEntry>) => {
    if (!user) return;
    const { error } = await supabase.from("marketing_entries").insert({
      user_id: user.id,
      canal: "outros",
      investimento: 0,
      impressoes: 0,
      cliques: 0,
      leads_gerados: 0,
      conversoes: 0,
      ...entry,
    } as any);
    if (error) toast.error("Erro ao adicionar");
    else { toast.success("Entrada adicionada"); load(); }
  }, [user, load]);

  const updateEntry = useCallback(async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase.from("marketing_entries").update(updates).eq("id", id);
    if (error) toast.error("Erro ao salvar");
    else setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    const { error } = await supabase.from("marketing_entries").delete().eq("id", id);
    if (error) toast.error("Erro ao remover");
    else setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const deleteReport = useCallback(async (id: string) => {
    const { error } = await supabase.from("marketing_reports").delete().eq("id", id);
    if (error) toast.error("Erro ao remover relatório");
    else { toast.success("Relatório removido"); load(); }
  }, [load]);

  // Stats by channel
  const channelStats: ChannelStats[] = (() => {
    const map = new Map<string, ChannelStats>();
    entries.forEach(e => {
      const existing = map.get(e.canal) || {
        canal: e.canal, investimento: 0, leads: 0, cliques: 0, impressoes: 0,
        cpl: null, cpc: null, ctr: null, visitas: 0, propostas: 0, vendas: 0, custoVenda: null,
      };
      existing.investimento += e.investimento || 0;
      existing.leads += e.leads_gerados || 0;
      existing.cliques += e.cliques || 0;
      existing.impressoes += e.impressoes || 0;
      existing.visitas += e.visitas || 0;
      existing.propostas += e.propostas || 0;
      existing.vendas += e.vendas || 0;
      map.set(e.canal, existing);
    });
    // Calculate derived metrics
    map.forEach(s => {
      s.cpl = s.leads > 0 ? s.investimento / s.leads : null;
      s.cpc = s.cliques > 0 ? s.investimento / s.cliques : null;
      s.ctr = s.impressoes > 0 ? (s.cliques / s.impressoes) * 100 : null;
      s.custoVenda = s.vendas > 0 ? s.investimento / s.vendas : null;
    });
    return Array.from(map.values()).sort((a, b) => b.leads - a.leads);
  })();

  const totals = {
    investimento: entries.reduce((s, e) => s + (e.investimento || 0), 0),
    leads: entries.reduce((s, e) => s + (e.leads_gerados || 0), 0),
    cliques: entries.reduce((s, e) => s + (e.cliques || 0), 0),
    impressoes: entries.reduce((s, e) => s + (e.impressoes || 0), 0),
    vendas: entries.reduce((s, e) => s + (e.vendas || 0), 0),
  };

  return {
    entries, reports, loading, importing, channelStats, totals,
    importReport, addManualEntry, updateEntry, deleteEntry, deleteReport, reload: load,
  };
}
