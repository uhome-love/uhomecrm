import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Negocio {
  id: string;
  lead_id: string | null;
  visita_id: string | null;
  pipeline_lead_id: string | null;
  corretor_id: string | null;
  gerente_id: string | null;
  nome_cliente: string;
  telefone: string | null;
  empreendimento: string | null;
  fase: string;
  vgv_estimado: number | null;
  vgv_final: number | null;
  observacoes: string | null;
  origem: string | null;
  status: string;
  fase_changed_at: string;
  created_at: string;
  updated_at: string;
}

export const NEGOCIOS_FASES = [
  { key: "proposta", label: "Proposta", cor: "#3B82F6", icon: "📋" },
  { key: "negociacao", label: "Negociação", cor: "#F59E0B", icon: "🤝" },
  { key: "documentacao", label: "Documentação", cor: "#8B5CF6", icon: "📄" },
  { key: "assinado", label: "Assinado", cor: "#22C55E", icon: "✅" },
  { key: "distrato", label: "Distrato", cor: "#EF4444", icon: "❌" },
] as const;

export function useNegocios() {
  const { user } = useAuth();
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [corretorNomes, setCorretorNomes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadNegocios = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("negocios")
      .select("*")
      .eq("status", "ativo")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Error loading negocios:", error);
      return;
    }

    const rows = (data || []) as Negocio[];
    setNegocios(rows);

    // Load names
    const userIds = [...new Set([
      ...rows.map(n => n.corretor_id).filter(Boolean),
      ...rows.map(n => n.gerente_id).filter(Boolean),
    ])] as string[];

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, avatar_url")
        .in("user_id", userIds);
      const { data: members } = await supabase
        .from("team_members")
        .select("user_id, nome")
        .in("user_id", userIds);

      const map: Record<string, string> = {};
      members?.forEach(m => { if (m.user_id) map[m.user_id] = m.nome; });
      profiles?.forEach(p => { if (p.user_id && !map[p.user_id]) map[p.user_id] = p.nome; });
      setCorretorNomes(map);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadNegocios().finally(() => setLoading(false));
  }, [user, loadNegocios]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("negocios-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "negocios" }, () => {
        loadNegocios();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadNegocios]);

  const moveFase = useCallback(async (negocioId: string, novaFase: string) => {
    const negocio = negocios.find(n => n.id === negocioId);
    if (!negocio || negocio.fase === novaFase) return;

    // Optimistic
    setNegocios(prev => prev.map(n =>
      n.id === negocioId ? { ...n, fase: novaFase, fase_changed_at: new Date().toISOString() } : n
    ));

    const { error } = await supabase
      .from("negocios")
      .update({ fase: novaFase, updated_at: new Date().toISOString() } as any)
      .eq("id", negocioId);

    if (error) {
      console.error("Error moving negocio:", error);
      toast.error("Erro ao mover negócio");
      setNegocios(prev => prev.map(n =>
        n.id === negocioId ? { ...n, fase: negocio.fase } : n
      ));
      return;
    }

    const faseInfo = NEGOCIOS_FASES.find(f => f.key === novaFase);
    toast(`${faseInfo?.icon || "📍"} ${negocio.nome_cliente} → ${faseInfo?.label || novaFase}`, {
      duration: 3000,
    });
  }, [negocios]);

  const updateNegocio = useCallback(async (id: string, updates: Partial<Negocio>) => {
    const { error } = await supabase
      .from("negocios")
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar negócio");
      return;
    }

    setNegocios(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  }, []);

  const getNegociosByFase = useCallback((fase: string) => {
    return negocios.filter(n => n.fase === fase);
  }, [negocios]);

  return {
    negocios,
    corretorNomes,
    loading,
    moveFase,
    updateNegocio,
    getNegociosByFase,
    reload: loadNegocios,
  };
}
