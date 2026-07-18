// Mapa: etapa do pipeline → categorias do Marketplace (prioridade por ordem).
import type { MarketplaceCategory } from "@/hooks/useMarketplace";

export const STAGE_TO_CATEGORIAS: Record<string, MarketplaceCategory[]> = {
  "Novo Lead":        ["script_ligacao", "whatsapp"],
  "Sem Contato":      ["script_ligacao", "whatsapp"],
  "Contato Iniciado": ["script_ligacao", "argumento_empreendimento"],
  "Qualificação":     ["script_ligacao", "argumento_empreendimento"],
  Busca:              ["argumento_empreendimento", "script_ligacao"],
  Aquecimento:        ["argumento_empreendimento", "quebra_objecao", "whatsapp"],
  Visita:             ["whatsapp", "script_ligacao"],
  "Pós-Visita":       ["quebra_objecao", "template_proposta"],
  "Em Negociação":    ["quebra_objecao", "template_proposta"],
  Contrato:           ["template_proposta"],
};

export function getCategoriasForStage(stage: string): MarketplaceCategory[] {
  return STAGE_TO_CATEGORIAS[stage] || ["script_ligacao", "whatsapp"];
}
