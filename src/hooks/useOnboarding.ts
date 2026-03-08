import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface OnboardingStep {
  id: string;
  phase: "config" | "actions" | "week1";
  phaseLabel: string;
  label: string;
  description: string;
  route: string;
  autoDetect: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // Dia 1 — Configuração
  { id: "perfil_completo", phase: "config", phaseLabel: "Dia 1 — Configuração", label: "Complete seu perfil", description: "Adicione foto e telefone ao seu perfil", route: "/configuracoes", autoDetect: true },
  { id: "disponibilidade", phase: "config", phaseLabel: "Dia 1 — Configuração", label: "Defina sua disponibilidade", description: "Configure sua disponibilidade na roleta de leads", route: "/disponibilidade", autoDetect: true },
  { id: "scripts_lidos", phase: "config", phaseLabel: "Dia 1 — Configuração", label: "Leia os scripts do time", description: "Conheça os scripts de ligação e follow-up", route: "/scripts", autoDetect: false },
  { id: "tutorial_assistido", phase: "config", phaseLabel: "Dia 1 — Configuração", label: "Assista o tutorial do sistema", description: "Vídeo de 3 minutos com as principais funcionalidades", route: "/homi", autoDetect: false },
  // Dia 1-3 — Primeiras ações
  { id: "primeira_ligacao", phase: "actions", phaseLabel: "Dia 1-3 — Primeiras ações", label: "Faça sua primeira ligação", description: "Realize uma ligação pela Oferta Ativa", route: "/oferta-ativa", autoDetect: true },
  { id: "registrar_resultado", phase: "actions", phaseLabel: "Dia 1-3 — Primeiras ações", label: "Registre resultado de ligação", description: "Registre o feedback de uma tentativa de contato", route: "/oferta-ativa", autoDetect: true },
  { id: "mover_lead_pipeline", phase: "actions", phaseLabel: "Dia 1-3 — Primeiras ações", label: "Mova um lead no pipeline", description: "Avance um lead de etapa no funil de vendas", route: "/pipeline", autoDetect: true },
  { id: "primeira_visita", phase: "actions", phaseLabel: "Dia 1-3 — Primeiras ações", label: "Agende sua primeira visita", description: "Marque uma visita com um cliente potencial", route: "/agenda-visitas", autoDetect: true },
  // Semana 1
  { id: "meta_batida", phase: "week1", phaseLabel: "Semana 1", label: "Bata sua meta diária", description: "Cumpra todas as metas de um dia", route: "/corretor", autoDetect: true },
  { id: "conversa_homi", phase: "week1", phaseLabel: "Semana 1", label: "Converse com o HOMI", description: "Use o assistente IA para preparar uma visita ou tirar dúvidas", route: "/homi", autoDetect: true },
  { id: "resumo_semanal", phase: "week1", phaseLabel: "Semana 1", label: "Veja seu Resumo Semanal", description: "Acesse o painel de resumo da sua semana", route: "/corretor/resumo", autoDetect: false },
];

export function useOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: completedSteps = [], isLoading } = useQuery({
    queryKey: ["onboarding", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("corretor_onboarding")
        .select("step_id, completed")
        .eq("user_id", user!.id);
      return (data || []).filter(s => s.completed).map(s => s.step_id);
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Check if user is new (created within last 7 days)
  const isNewUser = useMemo(() => {
    if (!user) return false;
    const createdAt = new Date(user.created_at);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return createdAt >= sevenDaysAgo;
  }, [user]);

  const totalSteps = ONBOARDING_STEPS.length;
  const completedCount = completedSteps.length;
  const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const isComplete = completedCount >= totalSteps;
  const showOnboarding = isNewUser && !isComplete;

  const completeStep = useCallback(async (stepId: string) => {
    if (!user || completedSteps.includes(stepId)) return;
    await supabase.from("corretor_onboarding").upsert({
      user_id: user.id,
      step_id: stepId,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: "user_id,step_id" });
    queryClient.invalidateQueries({ queryKey: ["onboarding", user.id] });
  }, [user, completedSteps, queryClient]);

  // Auto-detect completed steps
  const runAutoDetection = useCallback(async () => {
    if (!user) return;

    const checks: { stepId: string; check: () => Promise<boolean> }[] = [
      {
        stepId: "perfil_completo",
        check: async () => {
          const { data } = await supabase.from("profiles").select("telefone, avatar_url").eq("user_id", user.id).maybeSingle();
          return !!(data?.telefone || data?.avatar_url);
        },
      },
      {
        stepId: "disponibilidade",
        check: async () => {
          const { count } = await supabase.from("corretor_disponibilidade").select("id", { count: "exact", head: true }).eq("user_id", user.id);
          return (count || 0) > 0;
        },
      },
      {
        stepId: "primeira_ligacao",
        check: async () => {
          const { count } = await supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).eq("corretor_id", user.id);
          return (count || 0) > 0;
        },
      },
      {
        stepId: "registrar_resultado",
        check: async () => {
          const { count } = await supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).eq("corretor_id", user.id);
          return (count || 0) > 0;
        },
      },
      {
        stepId: "mover_lead_pipeline",
        check: async () => {
          const { count } = await supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).eq("corretor_id", user.id);
          return (count || 0) > 0;
        },
      },
      {
        stepId: "primeira_visita",
        check: async () => {
          const { count } = await supabase.from("visitas").select("id", { count: "exact", head: true }).eq("corretor_id", user.id);
          return (count || 0) > 0;
        },
      },
      {
        stepId: "conversa_homi",
        check: async () => {
          const { count } = await supabase.from("homi_conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id);
          return (count || 0) > 0;
        },
      },
    ];

    for (const { stepId, check } of checks) {
      if (completedSteps.includes(stepId)) continue;
      try {
        const result = await check();
        if (result) await completeStep(stepId);
      } catch {
        // Ignore RLS or missing table errors
      }
    }
  }, [user, completedSteps, completeStep]);

  // Run auto-detection on mount and periodically
  useEffect(() => {
    if (!user || !showOnboarding) return;
    runAutoDetection();
    const interval = setInterval(runAutoDetection, 60_000);
    return () => clearInterval(interval);
  }, [user, showOnboarding, runAutoDetection]);

  return {
    steps: ONBOARDING_STEPS,
    completedSteps,
    completedCount,
    totalSteps,
    progress,
    isComplete,
    showOnboarding,
    isLoading,
    completeStep,
  };
}

// Hook for managers to see onboarding status of team members
export function useTeamOnboarding(memberUserIds: string[]) {
  return useQuery({
    queryKey: ["team-onboarding", memberUserIds],
    queryFn: async () => {
      if (memberUserIds.length === 0) return {};
      const { data } = await supabase
        .from("corretor_onboarding")
        .select("user_id, step_id, completed")
        .in("user_id", memberUserIds)
        .eq("completed", true);
      
      const map: Record<string, number> = {};
      (data || []).forEach(row => {
        map[row.user_id] = (map[row.user_id] || 0) + 1;
      });
      return map;
    },
    enabled: memberUserIds.length > 0,
    staleTime: 60_000,
  });
}
