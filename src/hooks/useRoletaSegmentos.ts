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
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data || []) as RoletaSegmento[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Visual config per segmento (icon + accent color). Falls back to neutral for unknown. */
const SEGMENTO_VISUALS: Record<string, { icon: string; color: string; bg: string; border: string; order: number }> = {
  "altíssimo padrão": { icon: "🏆", color: "#F0B95A", bg: "rgba(240,185,90,0.08)", border: "rgba(240,185,90,0.25)", order: 1 },
  "altissimo padrao": { icon: "🏆", color: "#F0B95A", bg: "rgba(240,185,90,0.08)", border: "rgba(240,185,90,0.25)", order: 1 },
  "médio-alto padrão": { icon: "💎", color: "#A78BFA", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.25)", order: 2 },
  "medio-alto padrao": { icon: "💎", color: "#A78BFA", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.25)", order: 2 },
  "investimento": { icon: "📈", color: "#4ADE80", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.25)", order: 3 },
  "mcmv / até 500k": { icon: "🏠", color: "#60A5FA", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)", order: 4 },
  "mcmv / ate 500k": { icon: "🏠", color: "#60A5FA", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)", order: 4 },
};

const FALLBACK = { icon: "📦", color: "#94A3B8", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.20)", order: 99 };

export function getSegmentoVisual(nome: string | null | undefined) {
  if (!nome) return FALLBACK;
  return SEGMENTO_VISUALS[nome.toLowerCase()] || FALLBACK;
}
