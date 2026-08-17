import { supabase } from "@/integrations/supabase/client";

/**
 * Etapas finais do pipeline que NUNCA devem aparecer na Fila do CEO
 * nem voltar para distribuição (venda ganha / contrato gerado).
 *
 * Motivo: leads-sombra de vendas manuais nasciam com aceite pendente e
 * reapareciam na fila como se fossem leads novos.
 */
export const FILA_CEO_TIPOS_FINAIS = ["venda", "contrato_gerado"] as const;

let cache: string[] | null = null;

/** Ids das etapas finais (cacheado por sessão). */
export async function getStagesFinaisIds(): Promise<string[]> {
  if (cache) return cache;
  const { data } = await supabase
    .from("pipeline_stages")
    .select("id, tipo")
    .in("tipo", FILA_CEO_TIPOS_FINAIS as unknown as string[]);
  cache = (data ?? []).map((s: any) => s.id as string);
  return cache;
}

/**
 * Filtro PostgREST `.or(...)` que mantém leads sem etapa e exclui as etapas finais.
 * Retorna null quando não há etapas finais cadastradas (nenhum filtro necessário).
 */
export async function filaCeoStageOrFilter(): Promise<string | null> {
  const ids = await getStagesFinaisIds();
  if (ids.length === 0) return null;
  return `stage_id.is.null,stage_id.not.in.(${ids.join(",")})`;
}
