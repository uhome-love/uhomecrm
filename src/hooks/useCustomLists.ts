import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface CustomListFilters {
  fontes: string[];
  etapas?: string[];
  empreendimentos?: string[];
  origens?: string[];
  tempoSemContato?: string;
  temperatura?: string[];
  score?: string;
  etapasPdn?: string[];
  tempoParado?: string;
  motivoPerda?: string[];
  periodoPerda?: string;
  periodoCompra?: string;
  objetivoPosVenda?: string[];
  ordem?: string;
}

export interface CustomList {
  id: string;
  corretor_id: string;
  nome: string;
  filtros: CustomListFilters;
  criada_at: string;
  ultima_usada_at: string | null;
  vezes_usada: number;
}

export function useCustomLists() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["custom-lists", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("custom_lists")
        .select("*")
        .eq("corretor_id", user.id)
        .order("ultima_usada_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as unknown as CustomList[];
    },
    enabled: !!user,
  });

  const createList = useMutation({
    mutationFn: async ({ nome, filtros }: { nome: string; filtros: CustomListFilters }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("custom_lists")
        .insert({ corretor_id: user.id, nome, filtros: filtros as any })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CustomList;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-lists"] });
      toast.success("Lista personalizada criada!");
    },
  });

  const markUsed = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from("custom_lists")
        .update({ ultima_usada_at: new Date().toISOString(), vezes_usada: lists.find(l => l.id === listId)?.vezes_usada ? lists.find(l => l.id === listId)!.vezes_usada + 1 : 1 })
        .eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-lists"] }),
  });

  const deleteList = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase.from("custom_lists").delete().eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-lists"] });
      toast.success("Lista excluída");
    },
  });

  return { lists, isLoading, createList, markUsed, deleteList };
}

/** Resolve filters into actual pipeline_leads ids for the corretor */
export async function resolveCustomListLeads(
  userId: string,
  filtros: CustomListFilters
): Promise<{ ids: string[]; count: number }> {
  // For now we query pipeline_leads for the corretor
  let query = supabase
    .from("pipeline_leads")
    .select("id, stage_id, empreendimento, temperatura, updated_at, motivo_descarte, oportunidade_score, origem")
    .eq("corretor_id", userId);

  // Filter by pipeline type based on fontes
  // We'll do client-side filtering for complex logic
  const { data: allLeads } = await query;
  if (!allLeads) return { ids: [], count: 0 };

  // Get stages to map names
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, nome, pipeline_tipo")
    .eq("ativo", true);

  const stageMap = new Map((stages || []).map(s => [s.id, s]));

  let filtered = [...allLeads];

  // Filter by fonte (pipeline type)
  if (filtros.fontes.length > 0) {
    const allowedPipelineTypes: string[] = [];
    if (filtros.fontes.includes("meus_leads")) allowedPipelineTypes.push("leads");
    if (filtros.fontes.includes("meus_negocios")) allowedPipelineTypes.push("negocios");
    if (filtros.fontes.includes("perdidos")) allowedPipelineTypes.push("leads", "negocios");
    if (filtros.fontes.includes("pos_venda")) allowedPipelineTypes.push("negocios");

    if (!filtros.fontes.includes("perdidos") && !filtros.fontes.includes("pos_venda")) {
      filtered = filtered.filter(l => {
        const stage = stageMap.get(l.stage_id);
        return stage && allowedPipelineTypes.includes(stage.pipeline_tipo);
      });
    }
  }

  // Filter by etapas (stage names)
  if (filtros.etapas && filtros.etapas.length > 0) {
    const stageIds = (stages || [])
      .filter(s => filtros.etapas!.includes(s.nome))
      .map(s => s.id);
    filtered = filtered.filter(l => stageIds.includes(l.stage_id));
  }

  // Filter by empreendimento
  if (filtros.empreendimentos && filtros.empreendimentos.length > 0) {
    filtered = filtered.filter(l =>
      l.empreendimento && filtros.empreendimentos!.includes(l.empreendimento)
    );
  }

  // Filter by temperatura
  if (filtros.temperatura && filtros.temperatura.length > 0) {
    filtered = filtered.filter(l => filtros.temperatura!.includes(l.temperatura));
  }

  // Filter by tempo sem contato
  if (filtros.tempoSemContato && filtros.tempoSemContato !== "qualquer") {
    const now = new Date();
    const daysMap: Record<string, number> = {
      "3dias": 3, "7dias": 7, "15dias": 15, "nunca": 9999
    };
    const days = daysMap[filtros.tempoSemContato] || 0;
    if (days > 0 && days < 9999) {
      const cutoff = new Date(now.getTime() - days * 86400000).toISOString();
      filtered = filtered.filter(l => l.updated_at < cutoff);
    }
  }

  // Filter by origem
  if (filtros.origens && filtros.origens.length > 0) {
    filtered = filtered.filter(l => {
      const origem = ((l as any).origem || "").toLowerCase();
      return filtros.origens!.some(o => {
        if (o === "instagram") return origem.includes("instagram");
        if (o === "facebook") return origem.includes("facebook");
        if (o === "google") return origem.includes("google");
        if (o === "indicacao") return origem.includes("indica");
        if (o === "stand") return origem.includes("stand") || origem.includes("plantão");
        if (o === "email") return origem.includes("email");
        if (o === "site") return origem.includes("site") || origem.includes("portal");
        if (o === "meta_ads") return origem.includes("meta") || origem.includes("ads");
        if (o === "outros") return true;
        return false;
      });
    });
  }

  // Filter by score
  if (filtros.score && filtros.score !== "qualquer") {
    const minScore = parseInt(filtros.score, 10);
    if (!isNaN(minScore)) {
      filtered = filtered.filter(l => (l.oportunidade_score || 0) > minScore);
    }
  }

  // Filter by motivo_descarte (perdidos)
  if (filtros.fontes.includes("perdidos")) {
    filtered = filtered.filter(l => l.motivo_descarte != null);
    if (filtros.motivoPerda && filtros.motivoPerda.length > 0) {
      filtered = filtered.filter(l =>
        l.motivo_descarte && filtros.motivoPerda!.some(m => 
          l.motivo_descarte!.toLowerCase().includes(m.toLowerCase())
        )
      );
    }
  }

  // Sort
  const ordem = filtros.ordem || "score";
  if (ordem === "score") {
    filtered.sort((a, b) => (b.oportunidade_score || 0) - (a.oportunidade_score || 0));
  } else if (ordem === "tempo_sem_contato") {
    filtered.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
  } else if (ordem === "alfabetica") {
    // We don't have nome in this select, so skip
  }

  return { ids: filtered.map(l => l.id), count: filtered.length };
}
