import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Pagadorias ──
export function usePagadorias() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: pagadorias = [], isLoading } = useQuery({
    queryKey: ["pagadorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagadorias" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const createPagadoria = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase.from("pagadorias" as any).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagadorias"] }),
  });

  const updatePagadoria = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("pagadorias" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagadorias"] }),
  });

  return { pagadorias, isLoading, createPagadoria, updatePagadoria };
}

// ── Credores ──
export function useCredores(pagadoriaId: string | null) {
  return useQuery({
    queryKey: ["pagadoria-credores", pagadoriaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagadoria_credores" as any)
        .select("*")
        .eq("pagadoria_id", pagadoriaId!)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!pagadoriaId,
  });
}

// ── Comissao Faixas ──
export function useComissaoFaixas() {
  const qc = useQueryClient();

  const { data: faixas = [], isLoading } = useQuery({
    queryKey: ["comissao-faixas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissao_faixas" as any)
        .select("*")
        .order("vgv_min");
      if (error) throw error;
      return data as any[];
    },
  });

  const upsertFaixa = useMutation({
    mutationFn: async (faixa: any) => {
      if (faixa.id) {
        const { error } = await supabase.from("comissao_faixas" as any).update(faixa).eq("id", faixa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comissao_faixas" as any).insert(faixa);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comissao-faixas"] }),
  });

  const deleteFaixa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comissao_faixas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comissao-faixas"] }),
  });

  const getFaixaForVgv = (vgvAcumulado: number) => {
    const sorted = [...faixas].sort((a, b) => b.vgv_min - a.vgv_min);
    return sorted.find(f => vgvAcumulado >= f.vgv_min) || faixas[0];
  };

  return { faixas, isLoading, upsertFaixa, deleteFaixa, getFaixaForVgv };
}

// ── Conteudos Marketing ──
export function useConteudosMarketing() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: conteudos = [], isLoading } = useQuery({
    queryKey: ["conteudos-marketing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudos_marketing" as any)
        .select("*")
        .order("data_publicacao", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const createConteudo = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase.from("conteudos_marketing" as any).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conteudos-marketing"] }),
  });

  const updateConteudo = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("conteudos_marketing" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conteudos-marketing"] }),
  });

  const deleteConteudo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("conteudos_marketing" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conteudos-marketing"] }),
  });

  return { conteudos, isLoading, createConteudo, updateConteudo, deleteConteudo };
}

// ── Backoffice Tasks ──
export function useBackofficeTasks() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["backoffice-tasks", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backoffice_tasks" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("data", today)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("backoffice_tasks" as any)
        .update({ status: "concluida", concluida_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backoffice-tasks"] }),
  });

  const completedCount = tasks.filter((t: any) => t.status === "concluida").length;
  const titulo =
    completedCount >= 10 ? { emoji: "👑", label: "Lenda do dia" } :
    completedCount >= 6 ? { emoji: "🚀", label: "Em chamas" } :
    completedCount >= 3 ? { emoji: "✏️", label: "Produzindo" } :
    { emoji: "🌱", label: "Aquecendo" };

  const pontosHoje = tasks
    .filter((t: any) => t.status === "concluida")
    .reduce((sum: number, t: any) => sum + (t.pontos || 5), 0);

  return { tasks, isLoading, completeTask, completedCount, titulo, pontosHoje };
}
