/**
 * qualificacaoTaskEngine — motor único de avanço da etapa "Qualificação".
 *
 * Motivação: existiam 2 mecanismos criando tarefas para o mesmo lead sem se
 * falar (pills do card + popup de conclusão), causando tarefas duplicadas.
 * Além disso, o antigo cancelamento filtrava por `origem` começando em
 * "qualificacao_" — deixando tarefas manuais antigas (origem null) penduradas.
 *
 * Regras:
 *  1. Salva `flag_status.status_atendimento = statusKey` no lead.
 *  2. ANTES de criar a nova tarefa, cancela TODAS as pendentes daquele lead
 *     (independente da origem). Esta é a correção da causa raiz.
 *  3. Cria a nova tarefa conforme `TASK_MAP`, preservando os títulos/tipos
 *     originais e origem `qualificacao_${statusKey}`.
 *  4. Para `alinhando_visita`, aceita `dataOverride` (YYYY-MM-DD | "hoje"
 *     | "amanha") para o `vence_em` da tarefa "Confirmar data da visita".
 *  5. Dispara toast, `onSaved?.()` e o evento `pipeline-reload`.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QUALIFICACAO_STATUS_ATEND } from "@/components/pipeline/PipelineStageTransitionPopup";

export const QUALIFICACAO_TASK_MAP: Record<
  string,
  { tipo: string; titulo: string; diasVence: number }
> = {
  contato_inicial:    { tipo: "whatsapp", titulo: "Perfil de busca completo?",                diasVence: 0 },
  alinhamento_perfil: { tipo: "tarefa",   titulo: "Buscar imóveis compatíveis",               diasVence: 0 },
  busca:              { tipo: "whatsapp", titulo: "Enviar opções de imóveis",                 diasVence: 0 },
  envio_opcoes:       { tipo: "tarefa",   titulo: "Registrar retorno sobre as opções enviadas", diasVence: 2 },
  follow_up:          { tipo: "ligacao",  titulo: "Follow-up com novidades",                  diasVence: 3 },
  alinhando_visita:   { tipo: "ligacao",  titulo: "Confirmar data da visita",                 diasVence: 0 },
};

export type DataOverride = "hoje" | "amanha" | string; // YYYY-MM-DD

function todayBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function resolveVenceEm(statusKey: string, dataOverride?: DataOverride): string {
  if (statusKey === "alinhando_visita" && dataOverride) {
    if (dataOverride === "hoje") return todayBRT();
    if (dataOverride === "amanha") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataOverride)) return dataOverride;
  }
  const cfg = QUALIFICACAO_TASK_MAP[statusKey];
  const d = new Date();
  d.setDate(d.getDate() + (cfg?.diasVence ?? 0));
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export interface AdvanceQualificacaoInput {
  lead: {
    id: string;
    nome?: string | null;
    corretor_id?: string | null;
    flag_status?: Record<string, any> | null;
  };
  statusKey: string;
  dataOverride?: DataOverride;
  onSaved?: () => void;
  /** Silencia toast (útil quando popup de conclusão faz seu próprio toast). */
  silent?: boolean;
}

export async function advanceQualificacaoStatus({
  lead,
  statusKey,
  dataOverride,
  onSaved,
  silent,
}: AdvanceQualificacaoInput): Promise<void> {
  const cfg = QUALIFICACAO_TASK_MAP[statusKey];
  if (!cfg) throw new Error(`[qualificacaoTaskEngine] status desconhecido: ${statusKey}`);

  // 1. Salva status_atendimento
  const nextFlag: Record<string, any> = { ...(lead.flag_status || {}) };
  nextFlag.status_atendimento = statusKey;
  const { error: updErr } = await supabase
    .from("pipeline_leads")
    .update({ flag_status: nextFlag } as any)
    .eq("id", lead.id);
  if (updErr) throw updErr;

  // 2. Cancela TODAS as tarefas pendentes (independente da origem) — fix causa raiz
  const { data: pend } = await supabase
    .from("pipeline_tarefas")
    .select("id")
    .eq("pipeline_lead_id", lead.id)
    .eq("status", "pendente");
  const cancelIds = (pend || []).map((t: any) => t.id);
  if (cancelIds.length > 0) {
    await supabase
      .from("pipeline_tarefas")
      .update({ status: "cancelada" } as any)
      .in("id", cancelIds);
  }

  // 3. Cria nova tarefa
  if (lead.corretor_id) {
    const vence_em = resolveVenceEm(statusKey, dataOverride);
    const leadNome = lead.nome || "Lead";
    const { error: insErr } = await supabase.from("pipeline_tarefas").insert({
      pipeline_lead_id: lead.id,
      tipo: cfg.tipo,
      titulo: `${cfg.titulo} — ${leadNome}`,
      descricao: `Qualificação — ${QUALIFICACAO_STATUS_ATEND[statusKey] || statusKey}`,
      vence_em,
      hora_vencimento: "10:00",
      status: "pendente",
      prioridade: "media",
      responsavel_id: lead.corretor_id,
      created_by: lead.corretor_id,
      origem: `qualificacao_${statusKey}`,
    } as any);
    if (insErr) throw insErr;
  }

  if (!silent) toast.success(`Etapa: ${QUALIFICACAO_STATUS_ATEND[statusKey] || statusKey}`);
  onSaved?.();
  window.dispatchEvent(new CustomEvent("pipeline-reload"));
}
