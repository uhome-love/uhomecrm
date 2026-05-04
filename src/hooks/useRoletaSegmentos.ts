import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RoletaSegmento {
  id: string;
  nome: string;
}

/** All active roleta segmentos — used to label OA lists and group them. */
export function useRoletaSegmentos() {
  return useQuery({
    queryKey: ["roleta-segmentos-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roleta_segmentos")
        .select("id, nome, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as RoletaSegmento[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Visual config per segmento (icon + accent color). Falls back to neutral for unknown. */
const S1 = { icon: "🏠", color: "#60A5FA", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)", order: 1 };
const S2 = { icon: "🏆", color: "#F0B95A", bg: "rgba(240,185,90,0.08)", border: "rgba(240,185,90,0.25)", order: 2 };
const S3 = { icon: "🎯", color: "#F472B6", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.25)", order: 3 };
const S4 = { icon: "📈", color: "#4ADE80", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.25)", order: 4 };

const SEGMENTO_VISUALS: Record<string, { icon: string; color: string; bg: string; border: string; order: number }> = {
  // Novos nomes (S1..S4)
  "s1 - mcmv / médio padrão": S1,
  "s1 - mcmv / medio padrao": S1,
  "s2 - alto padrão": S2,
  "s2 - alto padrao": S2,
  "s3 - avulso": S3,
  "s4 - investimento": S4,
  // Compatibilidade com nomes antigos
  "altíssimo padrão": S2,
  "altissimo padrao": S2,
  "médio-alto padrão": S1,
  "medio-alto padrao": S1,
  "investimento": S4,
  "mcmv / até 500k": S1,
  "mcmv / ate 500k": S1,
};

const FALLBACK = { icon: "📦", color: "#94A3B8", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.20)", order: 99 };

export function getSegmentoVisual(nome: string | null | undefined) {
  if (!nome) return FALLBACK;
  return SEGMENTO_VISUALS[nome.toLowerCase()] || FALLBACK;
}
