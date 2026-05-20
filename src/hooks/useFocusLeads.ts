/**
 * useFocusLeads — Fetches leads needing attention for Focus Mode.
 *
 * Criteria (filterable):
 *  1. No pending tasks at all (sem tarefa)
 *  2. Overdue pending tasks — espelha CardStatusLine.getLeadStatusFilter
 *     (vence_em < hoje BRT, OU vence_em == hoje BRT && hora_vencimento < agora BRT)
 *  3. Stagnant / "Desatualizado" — sem TOQUE real (pipeline_atividades.tipo ∈ TOUCH_TYPES)
 *     há FOCUS_LEVELS.critical dias
 *
 * Régua de saúde (health) por dias sem TOQUE REAL do corretor:
 *  - Fonte: MAX(pipeline_atividades.created_at) WHERE tipo IN TOUCH_TYPES
 *  - NÃO usa mais ultima_acao_at (poluído por mudanca_etapa, criação, eventos do site, etc.)
 *   ≥ 10d → critical 🔴
 *   ≥  5d → warning  🟠
 *   ≥  1d → attention 🟡
 *   <  1d → ok
 *  - Lead sem atividade alguma → Infinity → critical 🔴
 *
 * Leads com negocio_id NOT NULL são excluídos do Foco de "leads"
 * (aparecem apenas em /meus-negocios → Modo Foco de Negócios).
 */

/** Limiares (em dias sem toque) da régua de saúde do Modo Foco. */
export const FOCUS_LEVELS = { attention: 1, warning: 5, critical: 10 } as const;

/**
 * Whitelist de tipos de pipeline_atividades que contam como TOQUE REAL do corretor.
 * Exclui: entrada, nurturing_sequencia, descarte, mudanca_etapa, sistema (eventos automáticos).
 */
export const TOUCH_TYPES = [
  "followup", "whatsapp", "ligacao", "tarefa", "contato",
  "nao_atendeu", "mensagem", "nota", "proposta", "reuniao", "visita",
] as const;

export type FocusHealth = "ok" | "attention" | "warning" | "critical";

function computeHealth(daysSinceTouch: number): FocusHealth {
  if (daysSinceTouch >= FOCUS_LEVELS.critical) return "critical";
  if (daysSinceTouch >= FOCUS_LEVELS.warning) return "warning";
  if (daysSinceTouch >= FOCUS_LEVELS.attention) return "attention";
  return "ok";
}

function getDaysSinceTouch(lastTouchISO: string | undefined): number {
  if (!lastTouchISO) return Infinity;
  return Math.floor((Date.now() - new Date(lastTouchISO).getTime()) / 86400000);
}

const HEALTH_EMOJI: Record<FocusHealth, string> = {
  critical: "🔴",
  warning: "🟠",
  attention: "🟡",
  ok: "🟢",
};
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchInBatchesWithRetry, runQueryWithRetry } from "@/lib/taskQueryUtils";

export interface FocusLead {
  id: string;
  name: string;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  stage: string;
  stage_id: string;
  origin: string | null;
  interest: string | null;
  last_contact_at: string | null;
  stage_updated_at: string;
  overdue_tasks: number;
  overdue_task_list: { id: string; titulo: string; vence_em: string | null; tipo: string | null }[];
  days_without_contact: number;
  days_in_stage: number;
  corretor_name: string;
  alert_reasons: string[];
  tags: string[];
  negocio_id: string | null;
  pipeline_tipo: string;
  /** Régua de saúde calculada a partir de days_without_contact. */
  health: FocusHealth;
}

export type FocusCriteria = "overdue_tasks" | "no_tasks" | "stagnant" | "all";

export interface FocusFilters {
  stageIds?: string[];
  criteria?: FocusCriteria[];
}

interface UseFocusLeadsReturn {
  leads: FocusLead[];
  loading: boolean;
  error: string | null;
  staleSince: Date | null;
  reload: (filters?: FocusFilters) => Promise<void>;
}

export function useFocusLeads(
  corretorAuthId: string | null,
  pipelineTipo: "leads" | "negocios" = "leads"
): UseFocusLeadsReturn {
  const [leads, setLeads] = useState<FocusLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleSince, setStaleSince] = useState<Date | null>(null);

  // Refs para decisões dentro do reload sem re-criar callback
  const lastSuccessAtRef = useRef<Date | null>(null);
  const leadsCountRef = useRef<number>(0);

  const reload = useCallback(async (filters?: FocusFilters) => {
    if (!corretorAuthId) return;
    setLoading(true);
    setError(null);

    try {
      // "Hoje" e "agora" em BRT (consistente com SQL `AT TIME ZONE 'America/Sao_Paulo'`)
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // "YYYY-MM-DD"
      const nowHHMM_BRT = new Date().toLocaleTimeString("en-GB", {
        timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
      }); // "HH:MM"

      // 1. Get stages for name mapping — exclude descarte and convertido
      const { data: stagesData, error: stagesError } = await runQueryWithRetry<Array<{ id: string; nome: string; tipo: string | null; pipeline_tipo: string | null }>>(() =>
        supabase
          .from("pipeline_stages")
          .select("id, nome, tipo, pipeline_tipo")
          .eq("pipeline_tipo", pipelineTipo)
      );
      if (stagesError) throw stagesError;

      const stageMap: Record<string, string> = {};
      let stageIds: string[] = [];
      for (const s of stagesData || []) {
        // Exclude descarte and convertido stages from Focus Mode
        if ((s as any).tipo === "descarte" || (s as any).tipo === "convertido") continue;
        stageMap[s.id] = s.nome;
        stageIds.push(s.id);
      }

      // Apply stage filter
      if (filters?.stageIds && filters.stageIds.length > 0) {
        stageIds = stageIds.filter(id => filters.stageIds!.includes(id));
      }

      if (stageIds.length === 0) {
        setLeads([]);
        leadsCountRef.current = 0;
        lastSuccessAtRef.current = new Date();
        setStaleSince(null);
        setLoading(false);
        return;
      }

      // 2. Get leads in active stages
      let query = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, telefone2, email, stage_id, stage_changed_at, origem, empreendimento, ultima_acao_at, tags, negocio_id, corretor_id, updated_at")
        .eq("corretor_id", corretorAuthId)
        .eq("arquivado", false)
        .in("stage_id", stageIds);

      if (pipelineTipo === "leads") {
        // Leads que já viraram negócio aparecem só em /meus-negocios → Modo Foco (Negócios).
        // Mantemos exclusão para não duplicar (~2 leads na base hoje).
        query = query.is("negocio_id", null);
      }

      const { data: leadsData, error: leadsError } = await runQueryWithRetry<Array<{
        id: string;
        nome: string;
        telefone: string | null;
        telefone2: string | null;
        email: string | null;
        stage_id: string;
        stage_changed_at: string;
        origem: string | null;
        empreendimento: string | null;
        ultima_acao_at: string | null;
        tags: string[] | null;
        negocio_id: string | null;
        corretor_id: string | null;
        updated_at: string;
      }>>(() => query);
      if (leadsError) throw leadsError;
      if (!leadsData || leadsData.length === 0) {
        setLeads([]);
        leadsCountRef.current = 0;
        lastSuccessAtRef.current = new Date();
        setStaleSince(null);
        setLoading(false);
        return;
      }

      // 3. Get all pending tasks for these leads
      const leadIds = leadsData.map(l => l.id);
      const allTasks: Record<string, { overdue: number; hasFuture: boolean; overdueList: { id: string; titulo: string; vence_em: string | null; tipo: string | null }[] }> = {};

      const { rows: tasksData, errors: taskErrors } = await fetchInBatchesWithRetry<any>(
        leadIds,
        (chunk) =>
          supabase
            .from("pipeline_tarefas")
            .select("id, pipeline_lead_id, titulo, tipo, vence_em, hora_vencimento, status")
            .in("pipeline_lead_id", chunk)
            .eq("status", "pendente"),
        { chunkSize: 50, minChunkSize: 10 }
      );

      for (const t of tasksData || []) {
        if (!allTasks[t.pipeline_lead_id]) {
          allTasks[t.pipeline_lead_id] = { overdue: 0, hasFuture: false, overdueList: [] };
        }
        // Espelha CardStatusLine.getLeadStatusFilter:
        //   vence_em < hoje (BRT) → atrasada
        //   vence_em == hoje (BRT) && hora_vencimento < agora BRT → atrasada
        const venceEm = t.vence_em as string | null;
        const hora = (t.hora_vencimento as string | null)?.slice(0, 5) ?? null;
        const isOverdue =
          !!venceEm && (
            venceEm < todayStr ||
            (venceEm === todayStr && !!hora && hora < nowHHMM_BRT)
          );

        if (isOverdue) {
          allTasks[t.pipeline_lead_id].overdue++;
          allTasks[t.pipeline_lead_id].overdueList.push({
            id: t.id,
            titulo: t.titulo || "(sem título)",
            vence_em: venceEm,
            tipo: (t as any).tipo ?? null,
          });
        } else {
          allTasks[t.pipeline_lead_id].hasFuture = true;
        }
      }

      if (taskErrors.length) {
        console.warn("[useFocusLeads] Algumas consultas de tarefas falharam e foram isoladas por chunk", taskErrors);
      }

      // 3.5 Get last REAL touch per lead from pipeline_atividades (whitelist TOUCH_TYPES).
      // Substitui ultima_acao_at como fonte da régua de saúde — campo estava poluído
      // por mudanca_etapa, criação de lead, eventos do site, skip de fila, etc.
      const lastTouchMap = new Map<string, string>();
      const { rows: activitiesData, errors: activityErrors } = await fetchInBatchesWithRetry<{
        pipeline_lead_id: string;
        created_at: string;
      }>(
        leadIds,
        (chunk) =>
          supabase
            .from("pipeline_atividades")
            .select("pipeline_lead_id, created_at")
            .in("pipeline_lead_id", chunk)
            .in("tipo", TOUCH_TYPES as unknown as string[])
            .order("created_at", { ascending: false }),
        { chunkSize: 50, minChunkSize: 10 }
      );
      for (const a of activitiesData || []) {
        const current = lastTouchMap.get(a.pipeline_lead_id);
        if (!current || a.created_at > current) {
          lastTouchMap.set(a.pipeline_lead_id, a.created_at);
        }
      }
      if (activityErrors.length) {
        console.warn("[useFocusLeads] Algumas consultas de atividades falharam e foram isoladas por chunk", activityErrors);
      }

      // 4. Build focus leads — filter for those that need attention
      const criteriaFilter = filters?.criteria || ["all"];
      const filterAll = criteriaFilter.includes("all");

      const focusLeads: FocusLead[] = [];

      for (const lead of leadsData) {
        const taskInfo = allTasks[lead.id];
        const hasOverdue = (taskInfo?.overdue ?? 0) > 0;
        const hasNoTasks = !taskInfo;

        // Régua de saúde: dias desde o último TOQUE REAL (whitelist TOUCH_TYPES).
        // Sem atividade alguma → Infinity → critical 🔴 (comportamento correto).
        const lastTouch = lastTouchMap.get(lead.id);
        const daysSinceTouch = getDaysSinceTouch(lastTouch);
        // Exposto para a UI: usar Infinity como 999 só para evitar quebrar formatadores.
        const daysSinceContact = Number.isFinite(daysSinceTouch) ? daysSinceTouch : 999;

        const daysInStage = Math.floor(
          (Date.now() - new Date(lead.stage_changed_at).getTime()) / 86400000
        );

        const health = computeHealth(daysSinceTouch);
        // "Desatualizado" = sem toque real há ≥10d (critical).
        const isStale = health === "critical";

        // Apply criteria filter
        const matchesOverdue = hasOverdue && (filterAll || criteriaFilter.includes("overdue_tasks"));
        const matchesNoTasks = hasNoTasks && (filterAll || criteriaFilter.includes("no_tasks"));
        const matchesStagnant = isStale && (filterAll || criteriaFilter.includes("stagnant"));

        if (!matchesOverdue && !matchesNoTasks && !matchesStagnant) continue;

        const alertReasons: string[] = [];
        if (hasOverdue) alertReasons.push(`${taskInfo!.overdue} tarefa(s) vencida(s)`);
        if (hasNoTasks) alertReasons.push("Sem tarefas pendentes");
        if (health !== "ok") {
          const label = lastTouch
            ? `Sem toque há ${daysSinceContact}d`
            : `Sem toque registrado`;
          alertReasons.push(`${HEALTH_EMOJI[health]} ${label}`);
        }

        focusLeads.push({
          id: lead.id,
          name: lead.nome,
          phone: lead.telefone,
          phone2: lead.telefone2,
          email: lead.email,
          stage: stageMap[lead.stage_id] || "Desconhecida",
          stage_id: lead.stage_id,
          origin: lead.origem,
          interest: lead.empreendimento,
          // last_contact_at agora reflete o último TOQUE real (não ultima_acao_at).
          last_contact_at: lastTouch ?? null,
          stage_updated_at: lead.stage_changed_at,
          overdue_tasks: taskInfo?.overdue ?? 0,
          overdue_task_list: taskInfo?.overdueList ?? [],
          days_without_contact: daysSinceContact,
          days_in_stage: daysInStage,
          corretor_name: "",
          alert_reasons: alertReasons,
          tags: (lead.tags || []).filter(Boolean),
          negocio_id: lead.negocio_id,
          pipeline_tipo: pipelineTipo,
          health,
        });
      }


      // Sort by urgency
      focusLeads.sort((a, b) => {
        if (b.alert_reasons.length !== a.alert_reasons.length) {
          return b.alert_reasons.length - a.alert_reasons.length;
        }
        return b.days_without_contact - a.days_without_contact;
      });

      setLeads(focusLeads);
      leadsCountRef.current = focusLeads.length;
      lastSuccessAtRef.current = new Date();
      setStaleSince(null);
    } catch (err: any) {
      console.error("[useFocusLeads] error:", err);
      // Preservar snapshot: se já há cache em tela, marcar stale e NÃO zerar leads
      if (leadsCountRef.current > 0 && lastSuccessAtRef.current) {
        setStaleSince(lastSuccessAtRef.current);
      } else {
        setError(err.message || "Erro ao buscar leads");
      }
    } finally {
      setLoading(false);
    }
  }, [corretorAuthId, pipelineTipo]);

  return { leads, loading, error, staleSince, reload };
}
