import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

export interface Trilha {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  nivel: string | null;
  ordem: number | null;
  publicada: boolean | null;
  thumbnail_url: string | null;
  xp_total: number | null;
  criado_por: string | null;
  visibilidade: string | null;
  created_at: string | null;
}

export interface Aula {
  id: string;
  trilha_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: string;
  ordem: number | null;
  duracao_minutos: number | null;
  xp_recompensa: number | null;
  conteudo_url: string | null;
  youtube_id: string | null;
  conteudo: any; // JSONB: { url, html, questions[], storage_path }
  obrigatoria: boolean | null;
  created_at: string | null;
}

export interface Progresso {
  id: string;
  corretor_id: string | null;
  trilha_id: string | null;
  aula_id: string | null;
  status: string | null;
  quiz_score: number | null;
  xp_ganho: number | null;
  checklist_items: any;
  concluida_at: string | null;
  created_at: string | null;
}

export interface QuizQuestion {
  id: string;
  aula_id: string | null;
  pergunta: string;
  opcoes: any;
  explicacao: string | null;
  ordem: number | null;
}

export const CATEGORIAS = [
  { key: "tecnicas_vendas", label: "📈 Técnicas de Vendas", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  { key: "empreendimentos", label: "🏢 Empreendimentos", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { key: "processos", label: "⚙️ Processos Uhome", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { key: "objecoes_scripts", label: "💬 Objeções e Scripts", color: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
  { key: "treinamento_sistema", label: "💻 Treinamento do Sistema", color: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
];

export const NIVEL_CONFIG: Record<string, { label: string; color: string }> = {
  iniciante: { label: "Iniciante", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  intermediario: { label: "Intermediário", color: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  avancado: { label: "Avançado", color: "bg-red-500/15 text-red-600 border-red-500/30" },
};

export const TIPO_CONFIG: Record<string, { emoji: string; label: string }> = {
  youtube: { emoji: "▶️", label: "Vídeo YouTube" },
  vimeo: { emoji: "▶️", label: "Vídeo Vimeo" },
  video_upload: { emoji: "▶️", label: "Vídeo" },
  video: { emoji: "▶️", label: "Vídeo" },
  pdf: { emoji: "📄", label: "PDF" },
  texto: { emoji: "📝", label: "Texto" },
  quiz: { emoji: "🧠", label: "Quiz" },
  checklist: { emoji: "☑️", label: "Checklist" },
};

export function getStudyLevel(totalXp: number) {
  if (totalXp >= 600) return { label: "Mestre", emoji: "🏆", level: 4, nextAt: null, progress: 100 };
  if (totalXp >= 300) return { label: "Especialista", emoji: "🎓", level: 3, nextAt: 600, progress: ((totalXp - 300) / 300) * 100 };
  if (totalXp >= 100) return { label: "Praticante", emoji: "📚", level: 2, nextAt: 300, progress: ((totalXp - 100) / 200) * 100 };
  return { label: "Aprendiz", emoji: "📖", level: 1, nextAt: 100, progress: (totalXp / 100) * 100 };
}

export function useAcademia() {
  const { user } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const queryClient = useQueryClient();
  const canManage = isAdmin || isGestor;

  // Resolve profiles.id from auth user.id (FK references profiles.id, not auth.users.id)
  const { data: profileId } = useQuery({
    queryKey: ["profile-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
      return data?.id || null;
    },
    enabled: !!user,
    staleTime: 300000,
  });

  // Load trilhas (published for students, all for managers)
  const { data: trilhas = [], isLoading: trilhasLoading } = useQuery({
    queryKey: ["academia-trilhas", canManage],
    queryFn: async () => {
      let q = supabase.from("academia_trilhas").select("*").order("ordem", { ascending: true });
      if (!canManage) q = q.eq("publicada", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Trilha[];
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Load all aulas
  const { data: aulas = [], isLoading: aulasLoading } = useQuery({
    queryKey: ["academia-aulas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("academia_aulas").select("*").order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as Aula[];
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Load user progress
  const { data: progresso = [], isLoading: progressoLoading } = useQuery({
    queryKey: ["academia-progresso", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase.from("academia_progresso").select("*").eq("corretor_id", profileId);
      if (error) throw error;
      return (data || []) as Progresso[];
    },
    enabled: !!profileId,
    staleTime: 30000,
  });

  // Load certificates
  const { data: certificados = [] } = useQuery({
    queryKey: ["academia-certificados", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase.from("academia_certificados").select("*").eq("corretor_id", profileId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId,
    staleTime: 60000,
  });

  const totalXp = useMemo(() => progresso.reduce((sum, p) => sum + (p.xp_ganho || 0), 0), [progresso]);
  const studyLevel = useMemo(() => getStudyLevel(totalXp), [totalXp]);

  const getTrilhaProgress = useCallback((trilhaId: string) => {
    const trilhaAulas = aulas.filter(a => a.trilha_id === trilhaId);
    if (trilhaAulas.length === 0) return { total: 0, completed: 0, percent: 0, started: false };
    const completed = trilhaAulas.filter(a => progresso.some(p => p.aula_id === a.id && p.status === "concluida")).length;
    return { total: trilhaAulas.length, completed, percent: Math.round((completed / trilhaAulas.length) * 100), started: completed > 0 };
  }, [aulas, progresso]);

  const getAulaStatus = useCallback((aulaId: string): "nao_iniciada" | "em_andamento" | "concluida" => {
    const p = progresso.find(pr => pr.aula_id === aulaId);
    if (!p) return "nao_iniciada";
    if (p.status === "concluida") return "concluida";
    return "em_andamento";
  }, [progresso]);

  const getTrilhaDuration = useCallback((trilhaId: string) => {
    return aulas.filter(a => a.trilha_id === trilhaId).reduce((sum, a) => sum + (a.duracao_minutos || 0), 0);
  }, [aulas]);

  const completeAula = useCallback(async (aulaId: string, trilhaId: string, quizScore?: number) => {
    if (!profileId) return;
    const aula = aulas.find(a => a.id === aulaId);
    let xp = aula?.xp_recompensa || 10;

    // Bonus XP for 100% quiz
    if (quizScore === 100) xp += 50;

    // Use upsert to avoid stale-state race condition with startAula
    const { error } = await supabase.from("academia_progresso").upsert({
      corretor_id: profileId,
      trilha_id: trilhaId,
      aula_id: aulaId,
      status: "concluida",
      xp_ganho: xp,
      quiz_score: quizScore ?? null,
      concluida_at: new Date().toISOString(),
    }, { onConflict: "corretor_id,aula_id" });

    if (error) {
      console.error("Erro ao concluir aula:", error);
      toast.error("Erro ao salvar progresso");
      return;
    }

    toast(`🎯 +${xp} XP! Aula concluída!`, { duration: 3000 });

    // Check trilha completion
    const trilhaAulas = aulas.filter(a => a.trilha_id === trilhaId);
    const completedCount = trilhaAulas.filter(a =>
      a.id === aulaId || progresso.some(p => p.aula_id === a.id && p.status === "concluida")
    ).length;

    if (completedCount >= trilhaAulas.length) {
      const trilha = trilhas.find(t => t.id === trilhaId);
      const codigo = `UHOME-${Date.now().toString(36).toUpperCase()}`;
      await supabase.from("academia_certificados").insert({ trilha_id: trilhaId, corretor_id: user.id, codigo });
      toast(`🏆 TRILHA CONCLUÍDA! ${trilha?.titulo || ""}`, { description: `+100 XP bônus · Certificado emitido!`, duration: 6000 });
    }

    await queryClient.invalidateQueries({ queryKey: ["academia-progresso"] });
    await queryClient.invalidateQueries({ queryKey: ["academia-certificados"] });
    await queryClient.refetchQueries({ queryKey: ["academia-progresso", user.id] });
  }, [user, aulas, progresso, trilhas, queryClient]);

  const startAula = useCallback(async (aulaId: string, trilhaId: string) => {
    if (!user) return;
    const existing = progresso.find(p => p.aula_id === aulaId);
    if (existing) return;
    await supabase.from("academia_progresso").insert({
      corretor_id: user.id, trilha_id: trilhaId, aula_id: aulaId, status: "em_andamento", xp_ganho: 0,
    });
    queryClient.invalidateQueries({ queryKey: ["academia-progresso"] });
  }, [user, progresso, queryClient]);

  // CRUD for trilhas
  const createTrilha = useCallback(async (data: Partial<Trilha>) => {
    if (!user) return null;
    const { data: created, error } = await supabase.from("academia_trilhas").insert({
      titulo: data.titulo || "Nova Trilha",
      descricao: data.descricao || null,
      categoria: data.categoria || "tecnicas_vendas",
      nivel: data.nivel || "iniciante",
      publicada: data.publicada ?? false,
      visibilidade: (data as any).visibilidade || "todos",
      thumbnail_url: data.thumbnail_url || null,
      criado_por: user.id,
      ordem: trilhas.length + 1,
    } as any).select().single();
    if (error) { toast.error("Erro ao criar trilha"); return null; }
    queryClient.invalidateQueries({ queryKey: ["academia-trilhas"] });
    toast.success("Trilha criada!");
    return created;
  }, [user, trilhas.length, queryClient]);

  const updateTrilha = useCallback(async (id: string, data: Partial<Trilha>) => {
    const { error } = await supabase.from("academia_trilhas").update(data as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar trilha"); return false; }
    queryClient.invalidateQueries({ queryKey: ["academia-trilhas"] });
    toast.success("Trilha atualizada!");
    return true;
  }, [queryClient]);

  const deleteTrilha = useCallback(async (id: string) => {
    await supabase.from("academia_aulas").delete().eq("trilha_id", id);
    await supabase.from("academia_trilhas").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["academia-trilhas"] });
    queryClient.invalidateQueries({ queryKey: ["academia-aulas"] });
    toast.success("Trilha excluída");
  }, [queryClient]);

  // CRUD for aulas
  const createAula = useCallback(async (data: Partial<Aula> & { trilha_id: string }) => {
    const trilhaAulas = aulas.filter(a => a.trilha_id === data.trilha_id);
    const { data: created, error } = await supabase.from("academia_aulas").insert({
      trilha_id: data.trilha_id,
      titulo: data.titulo || "Nova Aula",
      tipo: data.tipo || "youtube",
      descricao: data.descricao || null,
      conteudo_url: data.conteudo_url || null,
      youtube_id: data.youtube_id || null,
      conteudo: data.conteudo || null,
      duracao_minutos: data.duracao_minutos || 10,
      xp_recompensa: data.xp_recompensa || 10,
      ordem: data.ordem ?? trilhaAulas.length + 1,
    } as any).select().single();
    if (error) { toast.error("Erro ao criar aula"); return null; }
    // Update trilha XP total
    await recalcTrilhaXp(data.trilha_id);
    queryClient.invalidateQueries({ queryKey: ["academia-aulas"] });
    toast.success("Aula criada!");
    return created;
  }, [aulas, queryClient]);

  const updateAula = useCallback(async (id: string, data: Partial<Aula>) => {
    const { error } = await supabase.from("academia_aulas").update(data as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar aula"); return false; }
    const aula = aulas.find(a => a.id === id);
    if (aula?.trilha_id) await recalcTrilhaXp(aula.trilha_id);
    queryClient.invalidateQueries({ queryKey: ["academia-aulas"] });
    toast.success("Aula atualizada!");
    return true;
  }, [aulas, queryClient]);

  const deleteAula = useCallback(async (id: string) => {
    const aula = aulas.find(a => a.id === id);
    await supabase.from("academia_aulas").delete().eq("id", id);
    if (aula?.trilha_id) await recalcTrilhaXp(aula.trilha_id);
    queryClient.invalidateQueries({ queryKey: ["academia-aulas"] });
    toast.success("Aula excluída");
  }, [aulas, queryClient]);

  async function recalcTrilhaXp(trilhaId: string) {
    const { data: aulaList } = await supabase.from("academia_aulas").select("xp_recompensa").eq("trilha_id", trilhaId);
    const totalXp = (aulaList || []).reduce((sum: number, a: any) => sum + (a.xp_recompensa || 0), 0);
    await supabase.from("academia_trilhas").update({ xp_total: totalXp } as any).eq("id", trilhaId);
  }

  const completedTrilhasCount = useMemo(() => {
    return trilhas.filter(t => getTrilhaProgress(t.id).percent === 100).length;
  }, [trilhas, getTrilhaProgress]);

  const completedAulasCount = useMemo(() => {
    return progresso.filter(p => p.status === "concluida").length;
  }, [progresso]);

  return {
    trilhas, aulas, progresso, certificados, totalXp, studyLevel, canManage,
    getTrilhaProgress, getAulaStatus, getTrilhaDuration,
    completeAula, startAula,
    createTrilha, updateTrilha, deleteTrilha,
    createAula, updateAula, deleteAula,
    completedTrilhasCount, completedAulasCount,
    loading: trilhasLoading || aulasLoading || progressoLoading,
  };
}
