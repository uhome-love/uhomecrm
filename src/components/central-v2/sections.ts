import {
  Sparkles,
  Users,
  Megaphone,
  MapPin,
  Briefcase,
  TrendingUp,
  Trophy,
  Layers3,
  Target,
  Gauge,
  LineChart,
  type LucideIcon,
} from "lucide-react";

export type CentralSectionId =
  | "geral"
  | "pipeline-leads"
  | "origem-segmento"
  | "oferta-ativa"
  | "sla"
  | "visitas"
  | "negocios"
  | "vendas"
  | "metas"
  | "cohort"
  | "ranking";

export interface CentralSection {
  id: CentralSectionId;
  label: string;
  icon: LucideIcon;
  highlight?: boolean;
}

export const CENTRAL_SECTIONS: CentralSection[] = [
  { id: "geral", label: "Geral", icon: Sparkles, highlight: true },
  { id: "pipeline-leads", label: "Pipeline", icon: Users },
  { id: "origem-segmento", label: "Origem & Segmento", icon: Layers3 },
  { id: "oferta-ativa", label: "Oferta Ativa", icon: Megaphone },
  { id: "sla", label: "Tempo de Resposta", icon: Gauge },
  { id: "visitas", label: "Visitas", icon: MapPin },
  { id: "negocios", label: "Pipeline de Negócios", icon: Briefcase },
  { id: "vendas", label: "Vendas", icon: TrendingUp },
  { id: "metas", label: "Metas vs. Realizado", icon: Target },
  { id: "cohort", label: "Coorte & Retenção", icon: LineChart },
  { id: "ranking", label: "Ranking", icon: Trophy },
];

export const DEFAULT_SECTION: CentralSectionId = "geral";

export function isCentralSection(v: string | null | undefined): v is CentralSectionId {
  return !!v && CENTRAL_SECTIONS.some((s) => s.id === v);
}

export function getSection(id: CentralSectionId): CentralSection {
  return CENTRAL_SECTIONS.find((s) => s.id === id) ?? CENTRAL_SECTIONS[0];
}
