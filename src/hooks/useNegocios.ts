import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
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

export interface CorretorInfo {
  nome: string;
  avatar_url: string | null;
  avatar_gamificado_url: string | null;
  equipe: string | null;
}

export const NEGOCIOS_FASES = [
  { key: "novo_negocio", label: "Novo Negócio", cor: "#0EA5E9", icon: "🆕" },
  { key: "proposta", label: "Proposta", cor: "#3B82F6", icon: "📋" },
  { key: "negociacao", label: "Negociação", cor: "#F59E0B", icon: "🤝" },
  { key: "documentacao", label: "Documentação", cor: "#8B5CF6", icon: "📄" },
  { key: "assinado", label: "Assinado", cor: "#22C55E", icon: "✅" },
  { key: "distrato", label: "Caiu", cor: "#EF4444", icon: "❌" },
] as const;

export function useNegocios() {
  const { user } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [corretorNomes, setCorretorNomes] = useState<Record<string, string>>({});
  const [corretorInfoMap, setCorretorInfoMap] = useState<Record<string, CorretorInfo>>({});
  const [loading, setLoading] = useState(true);

  const loadNegocios = useCallback(async () => {
    if (!user) return;

    // Resolve profile.id for the current user (negocios uses profiles.id as corretor_id)
    let profileId: string | null = null;
    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      profileId = profile?.id || null;
    }

    let query = supabase
      .from("negocios")
      .select("id, lead_id, visita_id, pipeline_lead_id, corretor_id, gerente_id, nome_cliente, telefone, empreendimento, fase, vgv_estimado, vgv_final, observacoes, origem, status, fase_changed_at, created_at, updated_at")
      .eq("status", "ativo")
      .order("updated_at", { ascending: false })
      .limit(500);

    // BUG 1 FIX: Corretor sees only their own negocios
    if (!isAdmin && !isGestor && profileId) {
      query = query.eq("corretor_id", profileId);
    } else if (isGestor && profileId) {
      // Gestor sees negocios where they are gerente
      query = query.eq("gerente_id", profileId);
    }
    // Admin/CEO sees all

    const { data, error } = await query;

    if (error) {
      console.error("Error loading negocios:", error);
      return;
    }

    const rows = (data || []) as Negocio[];
    setNegocios(rows);

    // Load corretor info (profiles + team_members for equipe)
    const userIds = [...new Set([
      ...rows.map(n => n.corretor_id).filter(Boolean),
      ...rows.map(n => n.gerente_id).filter(Boolean),
    ])] as string[];

    if (userIds.length > 0) {
      const [profilesRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("id, user_id, nome, avatar_url, avatar_gamificado_url").in("id", userIds),
        supabase.from("team_members").select("user_id, nome, equipe").in("user_id", userIds),
      ]);

      const nameMap: Record<string, string> = {};
      const infoMap: Record<string, CorretorInfo> = {};

      // profiles.id matches corretor_id in negocios
      profilesRes.data?.forEach(p => {
        nameMap[p.id] = p.nome;
        infoMap[p.id] = {
          nome: p.nome,
          avatar_url: p.avatar_url,
          avatar_gamificado_url: p.avatar_gamificado_url,
          equipe: null,
        };
      });

      // Enrich with equipe from team_members (user_id != profiles.id, need mapping)
      const profileIdByUserId = new Map<string, string>();
      profilesRes.data?.forEach(p => { if (p.user_id) profileIdByUserId.set(p.user_id, p.id); });

      membersRes.data?.forEach(m => {
        if (!m.user_id) return;
        const profileId = profileIdByUserId.get(m.user_id);
        if (profileId && infoMap[profileId]) {
          infoMap[profileId].equipe = m.equipe || null;
        }
        // Also fill name if not from profiles
        if (profileId && !nameMap[profileId]) nameMap[profileId] = m.nome;
      });

      setCorretorNomes(nameMap);
      setCorretorInfoMap(infoMap);
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
    corretorInfoMap,
    loading,
    moveFase,
    updateNegocio,
    getNegociosByFase,
    reload: loadNegocios,
  };
}
