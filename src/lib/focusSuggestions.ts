/**
 * focusSuggestions — helpers para 3 buckets de sugestão do FocusEmptyState.
 *
 * Cada função retorna IDs de leads (não objetos), para que o reload do
 * useFocusLeads possa hidratar com a régua de saúde + ordenação canônica.
 *
 * Prioridade (overlap exclusivo): A > B > C
 *   A. visitaSemFollowup — stage.tipo IN ('visita','pos_visita') sem toque real 3d
 *   B. vence2d           — pipeline_tarefas pendente vencendo hoje+1 ou hoje+2 (BRT)
 *   C. semTarefa         — leads ativos sem qualquer tarefa pendente
 */
import { supabase } from "@/integrations/supabase/client";
import { TOUCH_TYPES } from "@/hooks/useFocusLeads";

const VISITA_TIPOS = ["visita", "pos_visita"] as const;

function addDaysBRT(days: number): string {
  const now = new Date();
  const brtNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  brtNow.setDate(brtNow.getDate() + days);
  return brtNow.toISOString().slice(0, 10);
}

async function fetchActiveLeadIds(corretorAuthId: string): Promise<{ ids: string[]; stageById: Map<string, string> }> {
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, tipo, pipeline_tipo")
    .eq("ativo", true);

  const excluded = new Set(
    (stages || [])
      .filter((s: any) => s.tipo === "descarte" || s.tipo === "convertido")
      .map((s: any) => s.id)
  );
  const stageById = new Map<string, string>();
  for (const s of stages || []) stageById.set((s as any).id, (s as any).tipo);

  const { data: leads } = await supabase
    .from("pipeline_leads")
    .select("id, stage_id")
    .eq("corretor_id", corretorAuthId)
    .eq("arquivado", false)
    .is("negocio_id", null);

  const ids = (leads || [])
    .filter((l: any) => !excluded.has(l.stage_id))
    .map((l: any) => l.id);

  return { ids, stageById };
}

/** Leads ativos sem QUALQUER tarefa pendente. (Categoria C.) */
export async function fetchLeadIdsSemTarefa(corretorAuthId: string): Promise<string[]> {
  const { ids } = await fetchActiveLeadIds(corretorAuthId);
  if (ids.length === 0) return [];

  const { data: comTarefa } = await supabase
    .from("pipeline_tarefas")
    .select("pipeline_lead_id")
    .eq("status", "pendente")
    .in("pipeline_lead_id", ids);

  const comTarefaSet = new Set((comTarefa || []).map((t: any) => t.pipeline_lead_id));
  return ids.filter((id) => !comTarefaSet.has(id));
}

/** Leads ativos com tarefa pendente vencendo hoje+1 ou hoje+2 (BRT). (Categoria B.) */
export async function fetchLeadIdsVence2d(corretorAuthId: string): Promise<string[]> {
  const { ids } = await fetchActiveLeadIds(corretorAuthId);
  if (ids.length === 0) return [];

  const tomorrow = addDaysBRT(1);
  const after2 = addDaysBRT(2);

  const { data: tarefas } = await supabase
    .from("pipeline_tarefas")
    .select("pipeline_lead_id, vence_em, status")
    .eq("status", "pendente")
    .gte("vence_em", tomorrow)
    .lte("vence_em", after2)
    .in("pipeline_lead_id", ids);

  return Array.from(new Set((tarefas || []).map((t: any) => t.pipeline_lead_id)));
}

/** Leads em stage.tipo IN ('visita','pos_visita') sem toque real nos últimos 3 dias. (Categoria A.) */
export async function fetchLeadIdsVisitaSemFollowup(corretorAuthId: string): Promise<string[]> {
  const { ids, stageById } = await fetchActiveLeadIds(corretorAuthId);
  if (ids.length === 0) return [];

  const visitaLeadIds = ids.filter((id) => {
    // Buscar stage do lead. Precisamos do stage_id; refazer mini-query.
    return true; // placeholder — filtrado abaixo
  });

  // refetch com stage_id para filtrar por tipo
  const { data: leadsWithStage } = await supabase
    .from("pipeline_leads")
    .select("id, stage_id")
    .in("id", ids);

  const filtered = (leadsWithStage || []).filter((l: any) => {
    const tipo = stageById.get(l.stage_id);
    return tipo && (VISITA_TIPOS as readonly string[]).includes(tipo);
  }).map((l: any) => l.id as string);

  if (filtered.length === 0) return [];

  // 3 dias atrás em ISO completo
  const cutoff = new Date(Date.now() - 3 * 86400000).toISOString();

  const { data: toques } = await supabase
    .from("pipeline_atividades")
    .select("pipeline_lead_id, created_at")
    .in("pipeline_lead_id", filtered)
    .in("tipo", TOUCH_TYPES as unknown as string[])
    .gte("created_at", cutoff);

  const comToqueSet = new Set((toques || []).map((t: any) => t.pipeline_lead_id));
  return filtered.filter((id) => !comToqueSet.has(id));
}

export interface FocusSuggestionBuckets {
  visitaSemFollowup: string[];
  vence2d: string[];
  semTarefa: string[];
}

/**
 * Aplica exclusão por prioridade A > B > C.
 * Um mesmo lead aparece em apenas um bucket (o de maior prioridade).
 */
export function applyPriorityExclusion(raw: FocusSuggestionBuckets): FocusSuggestionBuckets {
  const a = new Set(raw.visitaSemFollowup);
  const b = new Set(raw.vence2d.filter((id) => !a.has(id)));
  const c = new Set(raw.semTarefa.filter((id) => !a.has(id) && !b.has(id)));
  return {
    visitaSemFollowup: Array.from(a),
    vence2d: Array.from(b),
    semTarefa: Array.from(c),
  };
}
