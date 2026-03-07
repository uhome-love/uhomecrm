import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface EscalaEntry {
  id: string;
  data: string;
  segmento_id: string;
  corretor_id: string;
  ativo: boolean;
}

interface TeamMember {
  id: string;
  user_id: string | null;
  nome: string;
  equipe: string | null;
  status: string;
}

export function useEscalaDiaria(data: string) {
  const { user } = useAuth();
  const [escala, setEscala] = useState<EscalaEntry[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEscala = useCallback(async () => {
    if (!user) return;
    const { data: rows, error } = await supabase
      .from("distribuicao_escala")
      .select("*")
      .eq("data", data);
    if (error) { console.error("Error loading escala:", error); return; }
    setEscala((rows || []) as EscalaEntry[]);
  }, [user, data]);

  const loadTeam = useCallback(async () => {
    if (!user) return;
    const { data: rows, error } = await supabase
      .from("team_members")
      .select("id, user_id, nome, equipe, status")
      .eq("status", "ativo");
    if (error) { console.error("Error loading team:", error); return; }
    setTeamMembers((rows || []) as TeamMember[]);
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([loadEscala(), loadTeam()]).finally(() => setLoading(false));
  }, [user, loadEscala, loadTeam]);

  const toggleCorretor = useCallback(async (segmentoId: string, corretorUserId: string) => {
    if (!user) return;
    const existing = escala.find(
      e => e.segmento_id === segmentoId && e.corretor_id === corretorUserId && e.data === data
    );

    if (existing) {
      // Remove from escala
      const { error } = await supabase
        .from("distribuicao_escala")
        .delete()
        .eq("id", existing.id);
      if (error) { toast.error("Erro ao remover da escala"); return; }
      setEscala(prev => prev.filter(e => e.id !== existing.id));
    } else {
      // Add to escala
      const { data: inserted, error } = await supabase
        .from("distribuicao_escala")
        .insert({
          data,
          segmento_id: segmentoId,
          corretor_id: corretorUserId,
          criado_por: user.id,
        })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") {
          toast.info("Corretor já está na escala para este segmento.");
        } else {
          toast.error("Erro ao adicionar na escala");
          console.error(error);
        }
        return;
      }
      setEscala(prev => [...prev, inserted as EscalaEntry]);
    }
  }, [user, escala, data]);

  const isCorretorEscalado = useCallback((segmentoId: string, corretorUserId: string) => {
    return escala.some(
      e => e.segmento_id === segmentoId && e.corretor_id === corretorUserId
    );
  }, [escala]);

  const getCorretoresNoSegmento = useCallback((segmentoId: string) => {
    const userIds = escala
      .filter(e => e.segmento_id === segmentoId)
      .map(e => e.corretor_id);
    return teamMembers.filter(tm => tm.user_id && userIds.includes(tm.user_id));
  }, [escala, teamMembers]);

  return {
    escala,
    teamMembers,
    loading,
    toggleCorretor,
    isCorretorEscalado,
    getCorretoresNoSegmento,
    reload: () => Promise.all([loadEscala(), loadTeam()]),
  };
}
