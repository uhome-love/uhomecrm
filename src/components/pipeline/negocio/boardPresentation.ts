import type { NegPasso } from "@/hooks/useNegociosBoard";
import type { LeadSaude } from "@/lib/leadSaude";

export type NegociosLens = "meus" | "equipe";
export type NegociosColKey = "pos_visita" | NegPasso;
export type MoveLeadFn = (leadId: string, newStageId: string, observacao?: string, dealDetails?: { vgvFinal?: number | null; dataAssinatura?: string | null; unidade?: string | null }) => void | Promise<unknown>;

export const NEGOCIOS_COLUNAS: { key: NegociosColKey; tipo: string; nome: string; vazio: string }[] = [
  { key: "pos_visita", tipo: "pos_visita", nome: "Pós-Visita", vazio: "Nenhum pós-visita agora" },
  { key: "documentacao", tipo: "documentacao", nome: "Documentação", vazio: "Nenhuma documentação agora" },
  { key: "proposta", tipo: "proposta", nome: "Proposta", vazio: "Nenhuma proposta agora" },
  { key: "contrato", tipo: "contrato_gerado", nome: "Contrato", vazio: "Nenhum contrato agora" },
  { key: "ganho", tipo: "venda", nome: "Ganho", vazio: "Nenhuma venda neste recorte" },
];
export const FLOW_TIPOS = NEGOCIOS_COLUNAS.map(c => c.tipo);
export const PASSO_TIPO: Record<NegociosColKey, string> = { pos_visita: "pos_visita", documentacao: "documentacao", proposta: "proposta", contrato: "contrato_gerado", ganho: "venda" };
export const COMMERCIAL_TIPOS = ["documentacao", "proposta", "contrato_gerado"];
export const SAUDE_STRIPE: Record<LeadSaude, string> = {
  verde: "before:bg-success-500", ambar: "before:bg-warning-500", vermelho: "before:bg-danger-500", estagnado: "before:bg-purple-500", terminal: "before:bg-success-500",
};
export function money(reais: number | null): string | null {
  if (reais == null) return null;
  if (reais >= 1_000_000) return "R$ " + (reais / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mi";
  if (reais >= 1000) return "R$ " + Math.round(reais / 1000).toLocaleString("pt-BR") + " mil";
  return "R$ " + reais.toLocaleString("pt-BR");
}