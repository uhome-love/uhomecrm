/**
 * Régua única de negócios: a etapa vem SEMPRE do Pipeline.
 * Pós-visita ainda não é negócio. Ganho vem das vendas assinadas ativas.
 * Leitura no banco: view `v_negocios_pipeline`.
 */
export type EtapaNegocio = "documentacao" | "proposta" | "contrato" | "ganho";

export const ETAPAS_NEGOCIO: EtapaNegocio[] = ["documentacao", "proposta", "contrato", "ganho"];
export const ETAPAS_NEGOCIO_ANDAMENTO: EtapaNegocio[] = ["documentacao", "proposta", "contrato"];

export const ETAPA_NEGOCIO_LABEL: Record<EtapaNegocio, string> = {
  documentacao: "Documentação",
  proposta: "Proposta",
  contrato: "Contrato",
  ganho: "Ganho",
};

/** Converte o tipo da etapa do Pipeline na etapa de negócio (null = ainda não é negócio). */
export function etapaNegocioDoPipeline(tipo?: string | null): EtapaNegocio | null {
  switch (tipo) {
    case "documentacao":
      return "documentacao";
    case "proposta":
      return "proposta";
    case "contrato_gerado":
      return "contrato";
    case "venda":
      return "ganho";
    default:
      return null;
  }
}
