import {
  Sparkles,
  Users,
  Megaphone,
  MapPin,
  Briefcase,
  TrendingUp,
  Trophy,
  Target,
  Gauge,
  LineChart,
  FileText,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import type { CentralSectionId } from "./sections";

/**
 * Seções da Performance (hub único de resultado do CRM).
 *
 * Cada seção declara o "motor" de dados que a alimenta:
 *  - `ssot`     → rpc_metricas / v_fato_* (fonte única de verdade)
 *  - `central`  → RPCs get_relatorio_* (visões operacionais)
 *  - `builder`  → construtor de relatório por equipe/corretor
 *  - `forecast` → forecast IA do pipeline de negócios
 *
 * A navegação é de 2 níveis: 5 visões (chips) × sub-visões (select).
 */
export type CentralEngine = "ssot" | "central" | "builder" | "forecast" | "perf3";

export type UnifiedSectionId =
  | "funil"
  | "visao"
  | "sla"
  | "visitas"
  | "oferta-ativa"
  | "negocios"
  | "vendas"
  | "metas"
  | "cohort"
  | "forecast"
  | "ranking"
  | "relatorio-equipe"
  | "progresso"
  | "relatorio-1a1";

export interface UnifiedSection {
  id: UnifiedSectionId;
  label: string;
  icon: LucideIcon;
  engine: CentralEngine;
  /** Seção correspondente no motor legado (`central`). */
  centralId?: CentralSectionId;
  /** Visível para corretor sem visão de gestão. */
  corretor?: boolean;
  /** Rótulo curto da fonte, exibido no rodapé da seção. */
  fonte: string;
}

export const UNIFIED_SECTIONS: UnifiedSection[] = [
  { id: "funil", label: "Funil & Resultado", icon: Gauge, engine: "perf3", corretor: true, fonte: "SSOT · rpc_perf_funil" },
  { id: "visao", label: "Visão Geral (legado)", icon: Sparkles, engine: "ssot", corretor: true, fonte: "SSOT · rpc_metricas" },

  { id: "sla", label: "Tempo de Resposta", icon: Gauge, engine: "central", centralId: "sla", fonte: "get_relatorio_sla" },
  { id: "visitas", label: "Visitas", icon: MapPin, engine: "central", centralId: "visitas", fonte: "get_relatorio_visitas" },
  { id: "oferta-ativa", label: "Oferta Ativa", icon: Megaphone, engine: "central", centralId: "oferta-ativa", fonte: "get_relatorio_oferta_ativa" },

  { id: "negocios", label: "Negócios", icon: Briefcase, engine: "central", centralId: "negocios", fonte: "get_relatorio_negocios" },
  { id: "vendas", label: "Vendas", icon: TrendingUp, engine: "central", centralId: "vendas", fonte: "get_relatorio_vendas" },
  { id: "metas", label: "Metas vs. Realizado", icon: Target, engine: "central", centralId: "metas", fonte: "get_relatorio_metas" },
  { id: "cohort", label: "Coorte & Retenção", icon: LineChart, engine: "central", centralId: "cohort", fonte: "get_relatorio_cohort" },
  { id: "forecast", label: "Forecast IA", icon: Sparkles, engine: "forecast", fonte: "Forecast IA · pipeline de negócios" },

  { id: "ranking", label: "Ranking", icon: Trophy, engine: "ssot", fonte: "SSOT · rpc_metricas" },
  { id: "relatorio-equipe", label: "Relatório por equipe", icon: FileText, engine: "builder", fonte: "get_relatorio_* por corretor" },

  { id: "progresso", label: "Meu Progresso", icon: Rocket, engine: "ssot", corretor: true, fonte: "SSOT · rpc_metricas" },
  { id: "relatorio-1a1", label: "Relatório 1:1", icon: FileText, engine: "ssot", corretor: true, fonte: "SSOT · rpc_metricas" },
];

export type UnifiedViewId = "visao-geral" | "comercial" | "resultado" | "equipe" | "meus";

export interface UnifiedView {
  id: UnifiedViewId;
  label: string;
  icon: LucideIcon;
  /** Sub-visões da visão, na ordem do seletor. A primeira é o padrão. */
  ids: UnifiedSectionId[];
}

export const UNIFIED_VIEWS: UnifiedView[] = [
  { id: "visao-geral", label: "Visão Geral", icon: Sparkles, ids: ["funil", "visao"] },
  { id: "comercial", label: "Comercial", icon: Users, ids: ["sla", "visitas", "oferta-ativa"] },
  { id: "resultado", label: "Resultado", icon: TrendingUp, ids: ["negocios", "vendas", "metas", "cohort", "forecast"] },
  { id: "equipe", label: "Equipe", icon: Trophy, ids: ["ranking", "relatorio-equipe"] },
  { id: "meus", label: "Meus resultados", icon: Rocket, ids: ["progresso", "relatorio-1a1"] },
];

export const DEFAULT_UNIFIED_SECTION: UnifiedSectionId = "funil";

export function isUnifiedSection(v: string | null | undefined): v is UnifiedSectionId {
  return !!v && UNIFIED_SECTIONS.some((s) => s.id === v);
}

export function getUnifiedSection(id: UnifiedSectionId): UnifiedSection {
  return UNIFIED_SECTIONS.find((s) => s.id === id) ?? UNIFIED_SECTIONS[0];
}

/** Visão (chip) que contém a sub-visão informada. */
export function getViewOfSection(id: UnifiedSectionId): UnifiedView {
  return UNIFIED_VIEWS.find((v) => v.ids.includes(id)) ?? UNIFIED_VIEWS[0];
}

/** Aliases das seções antigas (`?secao=`, `/ranking`, abas removidas). */
export const SECTION_ALIASES: Record<string, UnifiedSectionId> = {
  geral: "visao",
  "pipeline-leads": "visao",
  origem: "visao",
  performance: "funil",
  "origem-segmento": "visao",
  relatorios: "relatorio-equipe",
  relatorio: "relatorio-1a1",
  "um-a-um": "relatorio-1a1",
};
