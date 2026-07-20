/**
 * qualificacaoTaskEngine — motor único de avanço da etapa "Qualificação".
 *
 * Regras:
 *  1. Salva `flag_status.status_atendimento = statusKey` no lead.
 *  2. ANTES de criar a nova tarefa, cancela TODAS as pendentes daquele lead
 *     (independente da origem).
 *  3. Cria a nova tarefa conforme `TASK_MAP`.
 *  4. TETO DE 7 DIAS: `vence_em` nunca ultrapassa hoje+7 (BRT). Se dataOverride
 *     for além, faz `clamp` silencioso e a UI mostra aviso.
 *  5. Hora: `horaOverride` ("HH:MM") controla `hora_vencimento` (default "10:00").
 *  6. Título dinâmico: `"${ação} às ${HH}h · dd/mm"` — sem repetir nome do lead.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QUALIFICACAO_STATUS_ATEND } from "@/components/pipeline/PipelineStageTransitionPopup";

/**
 * Títulos-ação (verbo direto), sem nome do lead — o card do Kanban já mostra.
 * Ex. renderizado: "Enviar opções às 11h · 22/07".
 */
export const QUALIFICACAO_TASK_MAP: Record<
  string,
  { tipo: string; acao: string; diasVence: number }
> = {
  contato_inicial:    { tipo: "whatsapp", acao: "Perfil de busca completo",  diasVence: 0 },
  alinhamento_perfil: { tipo: "tarefa",   acao: "Alinhar perfil de busca",   diasVence: 0 },
  busca:              { tipo: "whatsapp", acao: "Buscar imóveis compatíveis", diasVence: 0 },
  envio_opcoes:       { tipo: "tarefa",   acao: "Enviar opções",             diasVence: 2 },
  follow_up:          { tipo: "ligacao",  acao: "Follow-up",                 diasVence: 3 },
  alinhando_visita:   { tipo: "ligacao",  acao: "Confirmar visita",          diasVence: 0 },
};

/** Teto absoluto da cadência de Qualificação. */
export const QUALIFICACAO_MAX_DIAS = 7;

export type DataOverride = "hoje" | "amanha" | string; // YYYY-MM-DD

function brtDateOnly(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function addDaysBRT(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return brtDateOnly(d);
}

/**
 * Resolve `vence_em` respeitando o teto de 7 dias.
 * Retorna { venceEm, clamped: true } se a data pedida foi cortada.
 */
export function resolveVenceEm(
  statusKey: string,
  dataOverride?: DataOverride,
): { venceEm: string; clamped: boolean } {
  const hoje = addDaysBRT(0);
  const maxDate = addDaysBRT(QUALIFICACAO_MAX_DIAS);

  let requested: string | undefined;
  if (statusKey === "alinhando_visita" && dataOverride) {
    if (dataOverride === "hoje") requested = hoje;
    else if (dataOverride === "amanha") requested = addDaysBRT(1);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(dataOverride)) requested = dataOverride;
  }
  if (!requested) {
    const cfg = QUALIFICACAO_TASK_MAP[statusKey];
    requested = addDaysBRT(cfg?.diasVence ?? 0);
  }

  // Clamp: nunca antes de hoje, nunca depois de hoje+7
  if (requested < hoje) return { venceEm: hoje, clamped: false };
  if (requested > maxDate) return { venceEm: maxDate, clamped: true };
  return { venceEm: requested, clamped: false };
}

/**
 * Verifica se um `dataOverride` seria clampado — usado pela UI (VisitaDatePicker)
 * para exibir aviso "Máximo 7 dias — ajustado para dd/mm" ANTES de submeter.
 */
export function willClampVisitaDate(dataOverride?: DataOverride): {
  clamped: boolean;
  adjustedTo?: string; // YYYY-MM-DD
} {
  if (!dataOverride || dataOverride === "hoje" || dataOverride === "amanha") {
    return { clamped: false };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataOverride)) return { clamped: false };
  const maxDate = addDaysBRT(QUALIFICACAO_MAX_DIAS);
  if (dataOverride > maxDate) return { clamped: true, adjustedTo: maxDate };
  return { clamped: false };
}

function formatHoraShort(hora: string): string {
  // "10:00" → "10h" ; "15:30" → "15h30"
  const m = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!m) return hora;
  const [, hh, mm] = m;
  return mm === "00" ? `${hh}h` : `${hh}h${mm}`;
}

function formatDataShort(venceEm: string): string {
  // "2026-07-22" → "22/07"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(venceEm);
  return m ? `${m[3]}/${m[2]}` : venceEm;
}

export function buildQualificacaoTaskTitle(
  statusKey: string,
  venceEm: string,
  hora: string,
): string {
  const cfg = QUALIFICACAO_TASK_MAP[statusKey];
  const acao = cfg?.acao || statusKey;
  return `${acao} às ${formatHoraShort(hora)} · ${formatDataShort(venceEm)}`;
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
  /** "HH:MM" — default "10:00". */
  horaOverride?: string;
  onSaved?: () => void;
  /** Silencia toast (útil quando popup de conclusão faz seu próprio toast). */
  silent?: boolean;
}

export async function advanceQualificacaoStatus({
  lead,
  statusKey,
  dataOverride,
  horaOverride,
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

  // 2. Cancela TODAS as tarefas pendentes (independente da origem)
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

  // 3. Cria nova tarefa com clamp de 7 dias + título dinâmico
  const { venceEm, clamped } = resolveVenceEm(statusKey, dataOverride);
  const hora = /^\d{2}:\d{2}$/.test(horaOverride || "") ? (horaOverride as string) : "10:00";
  const titulo = buildQualificacaoTaskTitle(statusKey, venceEm, hora);

  if (lead.corretor_id) {
    const { error: insErr } = await supabase.from("pipeline_tarefas").insert({
      pipeline_lead_id: lead.id,
      tipo: cfg.tipo,
      titulo,
      descricao: `Qualificação — ${QUALIFICACAO_STATUS_ATEND[statusKey] || statusKey}`,
      vence_em: venceEm,
      hora_vencimento: hora,
      status: "pendente",
      prioridade: "media",
      responsavel_id: lead.corretor_id,
      created_by: lead.corretor_id,
      origem: `qualificacao_${statusKey}`,
    } as any);
    if (insErr) throw insErr;
  }

  if (!silent) {
    if (clamped) {
      toast.success(
        `Etapa: ${QUALIFICACAO_STATUS_ATEND[statusKey] || statusKey} — data ajustada para ${formatDataShort(venceEm)} (máx. 7 dias)`,
      );
    } else {
      toast.success(`Etapa: ${QUALIFICACAO_STATUS_ATEND[statusKey] || statusKey}`);
    }
  }
  onSaved?.();
  window.dispatchEvent(new CustomEvent("pipeline-reload"));
}
