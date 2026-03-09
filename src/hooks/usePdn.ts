import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { todayBRT } from "@/lib/utils";
import { toast } from "sonner";

export type PdnSituacao = "visita" | "gerado" | "assinado" | "caiu";

export interface PdnEntry {
  id: string;
  gerente_id: string;
  mes: string;
  nome: string;
  und: string;
  empreendimento: string;
  docs_status: string;
  temperatura: string;
  corretor: string;
  equipe: string;
  ultimo_contato: string;
  data_visita: string;
  tipo_visita: string;
  proxima_acao: string;
  data_proxima_acao: string | null;
  valor_potencial: number | null;
  observacoes: string;
  situacao: PdnSituacao;
  vgv: number | null;
  quando_assina: string | null;
  status_pagamento: string | null;
  motivo_queda: string | null;
  objecao_cliente: string | null;
  created_at: string;
  updated_at: string;
}

export function usePdn(selectedMes?: string, filterGerenteId?: string) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [entries, setEntries] = useState<PdnEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const currentMes = selectedMes || format(new Date(), "yyyy-MM");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("pdn_entries")
      .select("*")
      .eq("mes", currentMes)
      .order("created_at", { ascending: true });

    if (filterGerenteId) {
      query = query.eq("gerente_id", filterGerenteId);
    } else if (!isAdmin) {
      query = query.eq("gerente_id", user.id);
    }

    const { data, error } = await query;
    if (error) { console.error(error); toast.error("Erro ao carregar PDN"); }
    setEntries((data as PdnEntry[]) || []);
    setLoading(false);
  }, [user, currentMes, isAdmin, filterGerenteId]);

  useEffect(() => { load(); }, [load]);

  const addEntry = useCallback(async (partial?: Partial<PdnEntry>) => {
    if (!user) return;
    const situacao = partial?.situacao || "visita";
    const { error } = await supabase.from("pdn_entries").insert({
      gerente_id: user.id,
      mes: currentMes,
      nome: "",
      und: "",
      empreendimento: "",
      docs_status: "sem_docs",
      temperatura: "morno",
      corretor: "",
      equipe: "",
      ultimo_contato: "",
      data_visita: todayBRT(),
      tipo_visita: "1a_visita",
      proxima_acao: "",
      observacoes: "",
      situacao,
      vgv: null,
      quando_assina: null,
      status_pagamento: null,
      objecao_cliente: null,
      ...partial,
    } as any);
    if (error) { toast.error("Erro ao adicionar linha"); console.error(error); }
    else load();
  }, [user, currentMes, load]);

  const updateEntry = useCallback(async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase.from("pdn_entries").update(updates).eq("id", id);
    if (error) { toast.error("Erro ao salvar"); console.error(error); }
    else {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    const { error } = await supabase.from("pdn_entries").delete().eq("id", id);
    if (error) toast.error("Erro ao remover");
    else setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const copyToCurrentMonth = useCallback(async (ids: string[]) => {
    if (!user) return;
    const now = format(new Date(), "yyyy-MM");
    const toCopy = entries.filter(e => ids.includes(e.id));
    const inserts = toCopy.map(e => ({
      gerente_id: user.id,
      mes: now,
      nome: e.nome,
      und: e.und,
      empreendimento: e.empreendimento,
      docs_status: e.docs_status,
      temperatura: e.temperatura,
      corretor: e.corretor,
      equipe: e.equipe,
      ultimo_contato: e.ultimo_contato,
      data_visita: todayBRT(),
      tipo_visita: e.tipo_visita,
      proxima_acao: e.proxima_acao,
      observacoes: e.observacoes,
      valor_potencial: e.valor_potencial,
      situacao: e.situacao,
      vgv: e.vgv,
      quando_assina: e.quando_assina,
      status_pagamento: e.status_pagamento,
      objecao_cliente: e.objecao_cliente,
    }));
    const { error } = await supabase.from("pdn_entries").insert(inserts as any);
    if (error) toast.error("Erro ao copiar linhas");
    else { toast.success(`${inserts.length} linhas copiadas para ${now}`); load(); }
  }, [user, entries, load]);

  // Stats
  const visitas = entries.filter(e => e.situacao === "visita");
  const gerados = entries.filter(e => e.situacao === "gerado");
  const assinados = entries.filter(e => e.situacao === "assinado");
  const caidos = entries.filter(e => e.situacao === "caiu");

  const stats = {
    total: entries.length,
    quente: visitas.filter(e => e.temperatura === "quente").length,
    morno: visitas.filter(e => e.temperatura === "morno").length,
    frio: visitas.filter(e => e.temperatura === "frio").length,
    doc_completa: visitas.filter(e => e.docs_status === "doc_completa").length,
    em_andamento: visitas.filter(e => e.docs_status === "em_andamento").length,
    sem_docs: visitas.filter(e => e.docs_status === "sem_docs").length,
    total_visitas: visitas.length,
    total_gerados: gerados.length,
    total_assinados: assinados.length,
    total_caidos: caidos.length,
    vgv_gerado: gerados.reduce((s, e) => s + (e.vgv || 0), 0),
    vgv_assinado: assinados.reduce((s, e) => s + (e.vgv || 0), 0),
    vgv_caido: caidos.reduce((s, e) => s + (e.vgv || 0), 0),
  };

  return { entries, loading, stats, addEntry, updateEntry, deleteEntry, copyToCurrentMonth, reload: load, currentMes };
}
