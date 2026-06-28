import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RoletaSegmento {
  id: string;
  nome: string;
}

// Modelo canônico (4 segmentos) — refatoração junho/2026
const SEGMENTO_ORDER_BY_ID: Record<string, number> = {
  "9948f523-29f4-46a7-bc1b-81ff8bb8dd50": 1, // S1 - Moradia
  "409aeddf-077f-473a-97cc-dfc0692ed35e": 2, // S2 - Investimento
  "5311aaaa-0000-4000-8000-000000000005": 3, // S3 - Foco
  "93ca556c-9a32-4fb8-b1af-148100ea47f0": 4, // S4 - Alto Padrão
};

export function getRoletaSegmentoOrder(nome: string | null | undefined) {
  if (!nome) return 99;
  const match = nome.trim().match(/^s\s*(\d+)/i);
  return match ? Number(match[1]) : 99;
}

export function getRoletaSegmentoStableOrder(segmento: { id?: string | null; nome?: string | null | undefined }) {
  const idOrder = segmento.id ? SEGMENTO_ORDER_BY_ID[segmento.id] : undefined;
  if (typeof idOrder === "number") return idOrder;
  return getRoletaSegmentoOrder(segmento.nome);
}

export function compareRoletaSegmentosByNome(a: string | null | undefined, b: string | null | undefined) {
  const orderDiff = getRoletaSegmentoOrder(a) - getRoletaSegmentoOrder(b);
  if (orderDiff !== 0) return orderDiff;
  return (a || "").localeCompare(b || "pt-BR", "pt-BR", { sensitivity: "base" });
}

export function compareRoletaSegmentos(
  a: { id?: string | null; nome?: string | null | undefined },
  b: { id?: string | null; nome?: string | null | undefined },
) {
  const orderDiff = getRoletaSegmentoStableOrder(a) - getRoletaSegmentoStableOrder(b);
  if (orderDiff !== 0) return orderDiff;
  return compareRoletaSegmentosByNome(a.nome, b.nome);
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
      return ((data || []) as RoletaSegmento[]).sort(compareRoletaSegmentos);
    },
    staleTime: 5 * 60_000,
  });
}

/** Visual config per segmento (icon + accent color). Falls back to neutral for unknown. */
const S1 = { icon: "🏠", color: "#60A5FA", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)", order: 1 }; // Moradia
const S2 = { icon: "📈", color: "#4ADE80", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.25)", order: 2 }; // Investimento
const S3 = { icon: "🎯", color: "#F472B6", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.25)", order: 3 }; // Foco
const S4 = { icon: "🏆", color: "#F0B95A", bg: "rgba(240,185,90,0.08)", border: "rgba(240,185,90,0.25)", order: 4 }; // Alto Padrão

const SEGMENTO_VISUALS: Record<string, { icon: string; color: string; bg: string; border: string; order: number }> = {
  // Modelo canônico (4 segmentos)
  "s1 - moradia": S1,
  "s2 - investimento": S2,
  "s3 - foco": S3,
  "s4 - alto padrão": S4,
  "s4 - alto padrao": S4,
  // Compatibilidade com nomes antigos (mapeados para o novo modelo)
  "s1 - mcmv": S1,
  "s1 - mcmv / médio padrão": S1,
  "s1 - mcmv / medio padrao": S1,
  "s2 - médio padrão": S1,
  "s2 - medio padrao": S1,
  "médio-alto padrão": S1,
  "medio-alto padrao": S1,
  "s3 - avulso": S1,
  "avulso": S1,
  "mcmv / até 500k": S1,
  "mcmv / ate 500k": S1,
  "s4 - investimento": S2,
  "investimento": S2,
  "s5 - produto foco": S3,
  "produto foco": S3,
  "s6 - alto padrão": S4,
  "s6 - alto padrao": S4,
  "s2 - alto padrão": S4,
  "s2 - alto padrao": S4,
  "altíssimo padrão": S4,
  "altissimo padrao": S4,
};

const FALLBACK = { icon: "📦", color: "#94A3B8", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.20)", order: 99 };

export function getSegmentoVisual(nome: string | null | undefined) {
  if (!nome) return FALLBACK;
  return SEGMENTO_VISUALS[nome.toLowerCase()] || FALLBACK;
}
