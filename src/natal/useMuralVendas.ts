import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isNatal } from "./config";

export interface CorretorMural { nome: string; foto: string | null }
export interface VendaMural {
  negocio_id: string;
  data_assinatura: string;
  empreendimento: string;
  assinado_em: string;
  corretores: CorretorMural[];
  equipe: string | null;
}

/** Vendas ganhas da campanha (01/11–18/12), sem valores. Mesma fonte para mural e comemoração. */
export function useMuralVendas() {
  return useQuery({
    queryKey: ["natal-mural-vendas"],
    enabled: isNatal(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async (): Promise<VendaMural[]> => {
      const { data, error } = await supabase.rpc("natal_mural_vendas");
      if (error) throw error;
      return (data ?? []).map((v) => ({
        ...v,
        corretores: (Array.isArray(v.corretores) ? v.corretores : []) as unknown as CorretorMural[],
      })) as VendaMural[];
    },
  });
}
