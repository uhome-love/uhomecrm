import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { FichaLia } from "./liaConhecimento";

export function useLiaConhecimento() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["lia-hub", "conhecimento"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lia_produtos")
        .select("id, slug, nome, nome_publico, ficha, ativo, updated_at, midias").order("nome_publico").order("slug");
      if (error) throw error;
      return (data ?? []) as FichaLia[];
    },
  });
  const salvar = useMutation({
    mutationFn: async ({ produto, ficha }: { produto: FichaLia; ficha: string }) => {
      const { data, error } = await supabase.rpc("lia_salvar_ficha", { p_id: produto.id, p_versao: produto.updated_at, p_ficha: ficha });
      if (error) throw error;
      if (!data) throw new Error("Não foi possível confirmar o salvamento.");
      await qc.invalidateQueries({ queryKey: ["lia-hub", "conhecimento"] });
      await qc.invalidateQueries({ queryKey: ["lia-lab-execucoes"] });
      return data;
    },
    onSuccess: () => toast.success("Ficha salva. Nenhum envio foi iniciado."),
    onError: (e: Error) => toast.error(e.message),
  });
  return { ...query, salvar };
}