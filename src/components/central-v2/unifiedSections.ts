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
  Layers3,
  FileText,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import type { CentralSectionId } from "./sections";

/**
 * Seções da Central de Relatórios unificada (Relatórios + Performance).
 *
 * Cada seção declara o "motor" de dados que a alimenta:
 *  - `ssot`     → rpc_metricas / v_fato_* (fonte única de verdade)
 *  - `central`  → RPCs get_relatorio_* (visões operacionais)
 *  - `builder`  → construtor de relatório por equipe/corretor
 */
export type CentralEngine = "ssot" | "central" | "builder" | "forecast";

export type UnifiedSectionId =
  | "visao"
  | "pipeline-leads"
  | "origem"
  | "oferta-ativa"
  | "sla"
  | "visitas"
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
  { id: "visao", label: "Visão Geral", icon: Sparkles, engine: "ssot", corretor: true, fonte: "SSOT · rpc_metricas" },

  { id: "pipeline-leads", label: "Pipeline", icon: Users, engine: "central", centralId: "pipeline-leads", fonte: "get_relatorio_pipeline_leads" },
  { id: "origem", label: "Origem & ROI", icon: Layers3, engine: "ssot", fonte: "SSOT · rpc_metricas_origem" },
  { id: "oferta-ativa", label: "Oferta Ativa", icon: Megaphone, engine: "central", centralId: "oferta-ativa", fonte: "get_relatorio_oferta_ativa" },
  { id: "sla", label: "Tempo de Resposta", icon: Gauge, engine: "central", centralId: "sla", fonte: "get_relatorio_sla" },
  { id: "visitas", label: "Visitas", icon: MapPin, engine: "central", centralId: "visitas", fonte: "get_relatorio_visitas" },

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

export interface UnifiedGroup {
  label: string;
  ids: UnifiedSectionId[];
}

export const UNIFIED_GROUPS: UnifiedGroup[] = [
  { label: "Visão", ids: ["visao"] },
  { label: "Comercial", ids: ["pipeline-leads", "origem", "oferta-ativa", "sla", "visitas"] },
  { label: "Resultado", ids: ["negocios", "vendas", "metas", "cohort"] },
  { label: "Equipe", ids: ["ranking", "relatorio-equipe", "progresso", "relatorio-1a1"] },
];

export const DEFAULT_UNIFIED_SECTION: UnifiedSectionId = "visao";

export function isUnifiedSection(v: string | null | undefined): v is UnifiedSectionId {
  return !!v && UNIFIED_SECTIONS.some((s) => s.id === v);
}

export function getUnifiedSection(id: UnifiedSectionId): UnifiedSection {
  return UNIFIED_SECTIONS.find((s) => s.id === id) ?? UNIFIED_SECTIONS[0];
}

/** Aliases das seções antigas (`/central-relatorios?secao=` e `/ranking`). */
export const SECTION_ALIASES: Record<string, UnifiedSectionId> = {
  geral: "visao",
  "origem-segmento": "origem",
  relatorios: "relatorio-equipe",
  relatorio: "relatorio-1a1",
  "um-a-um": "relatorio-1a1",
};
