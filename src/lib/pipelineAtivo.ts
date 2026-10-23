import { leadSaude, type LeadSaudeInput } from "@/lib/leadSaude";

/** Etapas comerciais (aparecem na aba Negócios). */
export const TIPOS_NEGOCIO = new Set(["convertido", "proposta", "contrato_gerado", "negociacao", "assinatura"]);

type LeadMin = Omit<LeadSaudeInput, "stage_tipo"> & { stage_id: string };

/**
 * Fonte única do "pipeline ativo": tudo que não é terminal (Ganho/Descarte).
 * Estagnados contam (seguem na carteira até o Bolsão). Topo e bolinhas usam este mesmo conjunto.
 */
export function contarPipelineAtivo<T extends LeadMin>(leads: T[], stageTypeById: Record<string, string | undefined>) {
  let total = 0, negocios = 0;
  for (const l of leads) {
    const tipo = stageTypeById[l.stage_id];
    if (leadSaude({ ...l, stage_tipo: tipo }) === "terminal") continue;
    total++;
    if (tipo && TIPOS_NEGOCIO.has(tipo)) negocios++;
  }
  return { total, leads: total - negocios, negocios };
}
