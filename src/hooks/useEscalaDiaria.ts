import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

export interface EscalaEntry {
  id: string;
  data: string;
  segmento_id: string;
  corretor_id: string;
  ativo: boolean;
  aprovacao_status: "pendente" | "aprovado" | "rejeitado";
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
}

export interface SegmentoCampanha {
  id: string;
  segmento_id: string;
  campanha_nome: string;
}

export interface Segmento {
  id: string;
  nome: string;
  cor: string | null;
  ordem: number;
  empreendimentos: string[];
}

export interface TeamMember {
  id: string;
  user_id: string | null;
  nome: string;
  equipe: string | null;
  gerente_id: string;
  status: string;
}

export function useEscalaDiaria(data: string) {
  const { user } = useAuth();
  const { isAdmin, isGestor, isCorretor } = useUserRole();
  const qc = useQueryClient();
  const qKey = ["escala-diaria", data];

  // Load escala entries for the date (RLS will filter automatically)
  const { data: escala = [], isLoading: loadingEscala } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("distribuicao_escala")
        .select("*")
        .eq("data", data);
      if (error) throw error;
      return (rows || []) as EscalaEntry[];
    },
    enabled: !!user,
    staleTime: 10_000,
  });

  // Load team members — gestor sees own team, admin sees all
  const { data: teamMembers = [], isLoading: loadingTeam } = useQuery({
    queryKey: ["escala-team-members", user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("team_members")
        .select("id, user_id, nome, equipe, gerente_id, status")
        .eq("status", "ativo");

      // Gestores (non-admin) only see their own team
      if (!isAdmin && isGestor) {
        query = query.eq("gerente_id", user!.id);
      }

      const { data: rows, error } = await query;
      if (error) throw error;
      return (rows || []) as TeamMember[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Load segments
  const { data: segmentos = [] } = useQuery({
    queryKey: ["escala-segmentos"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("pipeline_segmentos")
        .select("id, nome, cor, ordem, empreendimentos")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (rows || []) as Segmento[];
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  // Load profiles for names (including validador names)
  const { data: profiles = {} } = useQuery({
    queryKey: ["escala-profiles"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("profiles")
        .select("user_id, nome");
      if (error) throw error;
      const map: Record<string, string> = {};
      (rows || []).forEach((p: any) => { map[p.user_id] = p.nome; });
      return map;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  // Load disponibilidade for all corretores
  const { data: disponibilidades = [] } = useQuery({
    queryKey: ["escala-disponibilidades"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("corretor_disponibilidade")
        .select("user_id, status, na_roleta, leads_recebidos_turno, entrada_em");
      if (error) throw error;
      return rows || [];
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // Toggle corretor on/off a segment (creates pending entry)
  const toggleMutation = useMutation({
    mutationFn: async ({ segmentoId, corretorUserId }: { segmentoId: string; corretorUserId: string }) => {
      if (!user) throw new Error("Not auth");
      const existing = escala.find(
        e => e.segmento_id === segmentoId && e.corretor_id === corretorUserId && e.data === data
      );
      if (existing) {
        const { error } = await supabase
          .from("distribuicao_escala")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("distribuicao_escala")
          .insert({
            data,
            segmento_id: segmentoId,
            corretor_id: corretorUserId,
            criado_por: user.id,
            aprovacao_status: "pendente",
          });
        if (error) {
          if (error.code === "23505") {
            toast.info("Corretor já está na escala para este segmento.");
          } else throw error;
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
    onError: () => toast.error("Erro ao atualizar escala"),
  });

  // Approve/reject entry
  const aprovacaoMutation = useMutation({
    mutationFn: async ({ entryId, status }: { entryId: string; status: "aprovado" | "rejeitado" }) => {
      if (!user) throw new Error("Not auth");
      const { error } = await supabase
        .from("distribuicao_escala")
        .update({
          aprovacao_status: status,
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: qKey });
      toast.success(vars.status === "aprovado" ? "Escala aprovada!" : "Escala rejeitada.");
    },
    onError: () => toast.error("Erro ao processar aprovação"),
  });

  // Approve all pending for a date
  const aprovarTodosMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not auth");
      const pendingIds = escala.filter(e => e.aprovacao_status === "pendente").map(e => e.id);
      if (pendingIds.length === 0) return;
      const { error } = await supabase
        .from("distribuicao_escala")
        .update({
          aprovacao_status: "aprovado",
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
        })
        .in("id", pendingIds);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qKey });
      toast.success("Todas as escalas aprovadas!");
    },
  });

  const loading = loadingEscala || loadingTeam;

  const getCorretoresNoSegmento = useCallback((segmentoId: string) => {
    const userIds = escala
      .filter(e => e.segmento_id === segmentoId && e.aprovacao_status === "aprovado")
      .map(e => e.corretor_id);
    return teamMembers.filter(tm => tm.user_id && userIds.includes(tm.user_id));
  }, [escala, teamMembers]);

  const getPendentesNoSegmento = useCallback((segmentoId: string) => {
    return escala.filter(e => e.segmento_id === segmentoId && e.aprovacao_status === "pendente");
  }, [escala]);

  const isCorretorEscalado = useCallback((segmentoId: string, corretorUserId: string) => {
    return escala.some(
      e => e.segmento_id === segmentoId && e.corretor_id === corretorUserId
    );
  }, [escala]);

  const getEntryStatus = useCallback((segmentoId: string, corretorUserId: string) => {
    const entry = escala.find(
      e => e.segmento_id === segmentoId && e.corretor_id === corretorUserId
    );
    return entry?.aprovacao_status || null;
  }, [escala]);

  const getEntryApproval = useCallback((segmentoId: string, corretorUserId: string) => {
    const entry = escala.find(
      e => e.segmento_id === segmentoId && e.corretor_id === corretorUserId
    );
    if (!entry || !entry.aprovado_por) return null;
    return {
      aprovadoPor: profiles[entry.aprovado_por] || "—",
      aprovadoEm: entry.aprovado_em,
    };
  }, [escala, profiles]);

  const getDisponibilidade = useCallback((userId: string) => {
    return disponibilidades.find((d: any) => d.user_id === userId);
  }, [disponibilidades]);

  // Get equipe label for a corretor
  const getEquipe = useCallback((corretorUserId: string) => {
    const tm = teamMembers.find(t => t.user_id === corretorUserId);
    return tm?.equipe || null;
  }, [teamMembers]);

  const totalPendentes = escala.filter(e => e.aprovacao_status === "pendente").length;

  const getLeadsAtivos = useCallback((_corretorUserId: string) => {
    const disp = disponibilidades.find((d: any) => d.user_id === _corretorUserId);
    return disp?.leads_recebidos_turno || 0;
  }, [disponibilidades]);

  // Can the current user validate? (gestor or admin, not corretor-only)
  const canValidate = isGestor || isAdmin;

  return {
    escala,
    teamMembers,
    segmentos,
    profiles,
    loading,
    totalPendentes,
    canValidate,
    isAdmin,
    toggleCorretor: (segmentoId: string, corretorUserId: string) =>
      toggleMutation.mutateAsync({ segmentoId, corretorUserId }),
    aprovar: (entryId: string, status: "aprovado" | "rejeitado") =>
      aprovacaoMutation.mutateAsync({ entryId, status }),
    aprovarTodos: () => aprovarTodosMutation.mutateAsync(),
    isCorretorEscalado,
    getEntryStatus,
    getEntryApproval,
    getCorretoresNoSegmento,
    getPendentesNoSegmento,
    getDisponibilidade,
    getEquipe,
    getLeadsAtivos,
    reload: () => qc.invalidateQueries({ queryKey: qKey }),
    saving: toggleMutation.isPending || aprovacaoMutation.isPending,
  };
}
