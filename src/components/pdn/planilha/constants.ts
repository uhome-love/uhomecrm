import type { PdnGrupo } from "@/hooks/usePdn";

export type SortKey = "nome" | "data" | "vgv" | "corretor" | "status";

/** Regressão de etapa no PDN: etapa anterior de cada grupo (null = não pode regredir). */
export const PREV_GRUPO: Record<PdnGrupo, PdnGrupo | null> = {
  pos_visita: null,
  em_negociacao: "pos_visita",
  contrato: "em_negociacao",
  ganho: "contrato",
  caidos: null,
};

export const GRUPO_LABEL_UI: Record<PdnGrupo, string> = {
  pos_visita: "Pós-Visita",
  em_negociacao: "Em Negociação",
  contrato: "Contrato",
  ganho: "Ganho",
  caidos: "Caídos",
};
