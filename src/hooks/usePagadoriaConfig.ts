import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FaixaConfig {
  vgv_max: number | null;
  percentual: number;
}

export interface CredorFixoConfig {
  nome: string;
  tipo: string;
  percentual: number;
}

export function usePagadoriaConfig() {
  const qc = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["pagadoria-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagadoria_config" as any)
        .select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  const getConfig = (tipo: string) => {
    const row = configs.find((c: any) => c.tipo === tipo);
    return row?.config || null;
  };

  const corretorFaixas: FaixaConfig[] = (getConfig("corretor")?.faixas || [])
    .sort((a: FaixaConfig, b: FaixaConfig) => (a.vgv_max ?? Infinity) - (b.vgv_max ?? Infinity));

  const gerenteFaixas: FaixaConfig[] = (getConfig("gerente")?.faixas || [])
    .sort((a: FaixaConfig, b: FaixaConfig) => (a.vgv_max ?? Infinity) - (b.vgv_max ?? Infinity));

  const credoresFixos: CredorFixoConfig[] = getConfig("credores_fixos")?.credores || [];

  const getFaixaPercentual = (faixas: FaixaConfig[], vgvAcumulado: number) => {
    for (const f of faixas) {
      if (f.vgv_max === null || vgvAcumulado <= f.vgv_max) {
        return f.percentual;
      }
    }
    return faixas[faixas.length - 1]?.percentual || 0;
  };

  const saveConfig = useMutation({
    mutationFn: async ({ tipo, config }: { tipo: string; config: any }) => {
      const existing = configs.find((c: any) => c.tipo === tipo);
      if (existing) {
        const { error } = await supabase
          .from("pagadoria_config" as any)
          .update({ config, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pagadoria_config" as any)
          .insert({ tipo, config });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagadoria-config"] }),
  });

  return {
    isLoading,
    corretorFaixas,
    gerenteFaixas,
    credoresFixos,
    getFaixaPercentual,
    saveConfig,
    configs,
  };
}
