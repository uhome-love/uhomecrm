import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OndaControle = {
  onda: 1 | 2 | 3;
  status: "aguardando" | "em_curso" | "pausada" | "concluida";
  total_alvo: number;
  total_enviado: number;
  total_erros: number;
  iniciada_em: string | null;
  concluida_em: string | null;
  pausada_em: string | null;
  motivo_pausa: string | null;
};

export type AtrioResposta = {
  id: string;
  lead_id: string;
  telefone: string;
  tipo_resposta: "sim" | "nao" | "texto_livre";
  conteudo_resposta: string | null;
  enviado_para_roleta: boolean;
  corretor_designado_id: string | null;
  recebido_em: string;
};

export type AtrioAudiencia = {
  lead_id: string;
  nome: string | null;
  telefone_normalizado: string;
  empreendimento_origem: string | null;
  onda: number;
  ordem: number;
  status: string;
};

export function useCampanhaAtrioFlag() {
  return useQuery({
    queryKey: ["atrio", "flag"],
    queryFn: async () => {
      const { data } = await supabase.from("system_flags")
        .select("flag_value, reason, updated_at")
        .eq("flag_name", "campanha_atrio_enabled").maybeSingle();
      return data ?? { flag_value: false, reason: null, updated_at: null };
    },
    refetchInterval: 5000,
  });
}

export function useAtrioControle() {
  return useQuery({
    queryKey: ["atrio", "controle"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campanha_atrio_controle")
        .select("*").order("onda");
      if (error) throw error;
      return (data || []) as OndaControle[];
    },
    refetchInterval: 5000,
  });
}

export function useAtrioRespostas() {
  return useQuery({
    queryKey: ["atrio", "respostas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campanha_atrio_respostas")
        .select("*").order("recebido_em", { ascending: false }).limit(20);
      if (error) throw error;
      return (data || []) as AtrioResposta[];
    },
    refetchInterval: 5000,
  });
}

export function useAtrioAudienciaPreview() {
  return useQuery({
    queryKey: ["atrio", "preview"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campanha_atrio_audiencia")
        .select("lead_id, nome, telefone_normalizado, empreendimento_origem, onda, ordem, status")
        .order("onda").order("ordem").limit(50);
      if (error) throw error;
      return (data || []) as AtrioAudiencia[];
    },
  });
}

export function useAtrioAudienciaCount() {
  return useQuery({
    queryKey: ["atrio", "aud-count"],
    queryFn: async () => {
      const { count } = await supabase.from("campanha_atrio_audiencia")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });
}

async function invokeFn(name: string, body: any = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data;
}

export function useAtrioActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["atrio"] });
  };
  const prepararAudiencia = useMutation({
    mutationFn: () => invokeFn("campanha-atrio-preparar-audiencia"),
    onSuccess: invalidate,
  });
  const iniciarOnda = useMutation({
    mutationFn: (args: number | { onda: number; force?: boolean }) => {
      const payload = typeof args === "number" ? { onda: args } : args;
      return invokeFn("campanha-atrio-iniciar-onda", payload);
    },
    onSuccess: invalidate,
  });
  const pararTudo = useMutation({
    mutationFn: () => invokeFn("campanha-atrio-parar-tudo"),
    onSuccess: invalidate,
  });
  const toggleFlag = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.from("system_flags").update({
        flag_value: next, reason: next ? "ligado_manual_admin" : "desligado_manual_admin",
      }).eq("flag_name", "campanha_atrio_enabled");
      if (error) throw error;
      return next;
    },
    onSuccess: invalidate,
  });
  return { prepararAudiencia, iniciarOnda, pararTudo, toggleFlag };
}
