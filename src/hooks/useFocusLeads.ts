/**
 * useFocusLeads — Modo Foco baseado na régua de 3 estados (decisão CEO 20/05/2026).
 *
 * Cada lead ATIVO (arquivado=false, sem negocio_id, stage não-descarte/convertido)
 * pertence a EXATAMENTE 1 dos 3 estados:
 *
 *   🟢 EM DIA      = pelo menos 1 tarefa pendente FUTURA (vence_em > hoje BRT,
 *                    ou vence_em = hoje BRT && hora_vencimento NULL || >= agora BRT)
 *                    → FORA do Modo Foco (nutrição planejada)
 *
 *   🔴 ATRASADO    = pelo menos 1 tarefa pendente vencida
 *                    → filtro "Tarefas atrasadas"
 *
 *   🟡 SEM DIREÇÃO = zero tarefa pendente
 *                    → filtro "Sem próximo passo"
 *                    Subdividido por dias desde a última ação real:
 *                      lastAction = MAX(touch_activity, tarefa.concluida_em, lead.created_at)
 *                      <  1d → janela de cortesia (SKIP)
 *                      1–4d  → 🟡 attention
 *                      5–9d  → 🟠 warning
 *                      ≥10d  → 🔴 critical
 *                      sem toque + sem tarefa concluída → "Nunca trabalhado" 🔴
 *
 * Fonte de "toque real": pipeline_atividades.tipo ∈ TOUCH_TYPES
 *  (ultima_acao_at NÃO é mais usado — campo poluído por mudanca_etapa, criação, etc.)
 */

export const FOCUS_LEVELS = { attention: 1, warning: 5, critical: 10 } as const;

/** Whitelist de tipos de pipeline_atividades que contam como TOQUE REAL do corretor. */
export const TOUCH_TYPES = [
  "followup", "whatsapp", "ligacao", "tarefa", "contato",
  "nao_atendeu", "mensagem", "nota", "proposta", "reuniao", "visita",
] as const;

export type FocusHealth = "ok" | "attention" | "warning" | "critical";
export type FocusState = "atrasado" | "sem_direcao";

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
  /** Dias desde a última ação (só relevante para sem_direcao; 0 para atrasado). */
  days_without_contact: number;
  days_in_stage: number;
  corretor_name: string;
  alert_reasons: string[];
  tags: string[];
  negocio_id: string | null;
  pipeline_tipo: string;
  /** Estado canônico na régua de 3 estados. */
  state: FocusState;
  /** True quando o lead nunca recebeu toque nem teve tarefa concluída. */
  never_touched: boolean;
  /** Régua de saúde visual. */
  health: FocusHealth;
}

export type FocusCriteria = "overdue_tasks" | "no_next_step" | "all";

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

const HEALTH_EMOJI: Record<FocusHealth, string> = {
  critical: "🔴",
  warning: "🟠",
  attention: "🟡",
  ok: "🟢",
};

function healthForSemDirecao(days: number, neverTouched: boolean): FocusHealth {
  if (neverTouched) return "critical";
  if (days >= FOCUS_LEVELS.critical) return "critical";
  if (days >= FOCUS_LEVELS.warning) return "warning";
  if (days >= FOCUS_LEVELS.attention) return "attention";
  return "ok";
}

export function useFocusLeads(
  corretorAuthId: string | null,
  pipelineTipo: "leads" | "negocios" = "leads"
): UseFocusLeadsReturn {
  const [leads, setLeads] = useState<FocusLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleSince, setStaleSince] = useState<Date | null>(null);

  const lastSuccessAtRef = useRef<Date | null>(null);
  const leadsCountRef = useRef<number>(0);

  const reload = useCallback(async (filters?: FocusFilters) => {
    if (!corretorAuthId) return;
    setLoading(true);
    setError(null);

    try {
      // "Hoje" e "agora" em BRT
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const nowHHMM_BRT = new Date().toLocaleTimeString("en-GB", {
        timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
      });

      // 1. Stages (exclui descarte/convertido)
      const { data: stagesData, error: stagesError } = await runQueryWithRetry<
        Array<{ id: string; nome: string; tipo: string | null; pipeline_tipo: string | null }>
      >(() =>
        supabase
          .from("pipeline_stages")
          .select("id, nome, tipo, pipeline_tipo")
          .eq("pipeline_tipo", pipelineTipo)
      );
      if (stagesError) throw stagesError;

      const stageMap: Record<string, string> = {};
      let stageIds: string[] = [];
      for (const s of stagesData || []) {
        if ((s as any).tipo === "descarte" || (s as any).tipo === "convertido") continue;
        stageMap[s.id] = s.nome;
        stageIds.push(s.id);
      }
      if (filters?.stageIds && filters.stageIds.length > 0) {
        stageIds = stageIds.filter((id) => filters.stageIds!.includes(id));
      }
      if (stageIds.length === 0) {
        setLeads([]);
        leadsCountRef.current = 0;
        lastSuccessAtRef.current = new Date();
        setStaleSince(null);
        setLoading(false);
        return;
      }

      // 2. Leads ativos
      let query = supabase
        .from("pipeline_leads")
        .select(
          "id, nome, telefone, telefone2, email, stage_id, stage_changed_at, origem, empreendimento, ultima_acao_at, tags, negocio_id, corretor_id, updated_at, created_at"
        )
        .eq("corretor_id", corretorAuthId)
        .eq("arquivado", false)
        .in("stage_id", stageIds);

      if (pipelineTipo === "leads") {
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
        created_at: string;
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

      const leadIds = leadsData.map((l) => l.id);

      // 3. Tarefas (pendente + concluida) por lead
      const taskAgg: Record<string, {
        overdue: number;
        hasFuture: boolean;
        overdueList: { id: string; titulo: string; vence_em: string | null; tipo: string | null }[];
        lastConcluida: string | null;
      }> = {};

      const { rows: tasksData, errors: taskErrors } = await fetchInBatchesWithRetry<any>(
        leadIds,
        (chunk) =>
          supabase
            .from("pipeline_tarefas")
            .select("id, pipeline_lead_id, titulo, tipo, vence_em, hora_vencimento, status, concluida_em")
            .in("pipeline_lead_id", chunk)
            .in("status", ["pendente", "concluida"]),
        { chunkSize: 50, minChunkSize: 10 }
      );

      for (const t of tasksData || []) {
        const lid = t.pipeline_lead_id as string;
        if (!taskAgg[lid]) {
          taskAgg[lid] = { overdue: 0, hasFuture: false, overdueList: [], lastConcluida: null };
        }
        const bucket = taskAgg[lid];

        if (t.status === "concluida") {
          const c = (t.concluida_em as string | null) ?? null;
          if (c && (!bucket.lastConcluida || c > bucket.lastConcluida)) {
            bucket.lastConcluida = c;
          }
          continue;
        }

        // status === 'pendente'
        const venceEm = t.vence_em as string | null;
        const hora = (t.hora_vencimento as string | null)?.slice(0, 5) ?? null;
        const isOverdue =
          !!venceEm && (
            venceEm < todayStr ||
            (venceEm === todayStr && !!hora && hora < nowHHMM_BRT)
          );
        if (isOverdue) {
          bucket.overdue++;
          bucket.overdueList.push({
            id: t.id,
            titulo: t.titulo || "(sem título)",
            vence_em: venceEm,
            tipo: (t as any).tipo ?? null,
          });
        } else {
          // pendente não vencida = futura (inclui hoje sem hora ou com hora futura)
          bucket.hasFuture = true;
        }
      }
      if (taskErrors.length) {
        console.warn("[useFocusLeads] Algumas consultas de tarefas falharam e foram isoladas por chunk", taskErrors);
      }

      // 4. Último TOQUE real (pipeline_atividades whitelist)
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

      // 5. Montar FocusLeads aplicando régua de 3 estados
      const criteriaFilter = filters?.criteria || ["all"];
      const filterAll = criteriaFilter.includes("all");
      const wantOverdue = filterAll || criteriaFilter.includes("overdue_tasks");
      const wantNoNextStep = filterAll || criteriaFilter.includes("no_next_step");

      const focusLeads: FocusLead[] = [];

      for (const lead of leadsData) {
        const agg = taskAgg[lead.id];
        const overdueCount = agg?.overdue ?? 0;
        const hasFuture = agg?.hasFuture ?? false;
        const lastConcluida = agg?.lastConcluida ?? null;
        const lastTouch = lastTouchMap.get(lead.id) ?? null;

        // Estado canônico
        let state: FocusState;
        if (overdueCount > 0) {
          state = "atrasado";
        } else if (hasFuture) {
          // 🟢 EM DIA — fora do Modo Foco
          continue;
        } else {
          state = "sem_direcao";
        }

        // Filtro do CEO/corretor
        if (state === "atrasado" && !wantOverdue) continue;
        if (state === "sem_direcao" && !wantNoNextStep) continue;

        // Calcular last_action e gravidade
        const neverTouched = !lastTouch && !lastConcluida;
        const candidates = [lastTouch, lastConcluida, lead.created_at].filter(Boolean) as string[];
        const lastActionISO = candidates.length
          ? candidates.reduce((a, b) => (a > b ? a : b))
          : lead.created_at;
        const daysSinceAction = lastActionISO
          ? Math.floor((Date.now() - new Date(lastActionISO).getTime()) / 86400000)
          : 999;

        // Janela de cortesia: sem_direcao recém-saído (dia 0) fica de fora
        if (state === "sem_direcao" && !neverTouched && daysSinceAction < 1) continue;

        const daysInStage = Math.floor(
          (Date.now() - new Date(lead.stage_changed_at).getTime()) / 86400000
        );

        let health: FocusHealth;
        let alertReasons: string[];
        if (state === "atrasado") {
          health = "critical";
          alertReasons = [`${overdueCount} tarefa(s) vencida(s)`];
        } else {
          health = healthForSemDirecao(daysSinceAction, neverTouched);
          if (neverTouched) {
            alertReasons = [`${HEALTH_EMOJI.critical} Nunca trabalhado`];
          } else {
            alertReasons = [`${HEALTH_EMOJI[health]} Sem direção há ${daysSinceAction}d`];
          }
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
          last_contact_at: lastTouch ?? lastConcluida ?? null,
          stage_updated_at: lead.stage_changed_at,
          overdue_tasks: overdueCount,
          overdue_task_list: agg?.overdueList ?? [],
          days_without_contact: state === "sem_direcao" ? daysSinceAction : 0,
          days_in_stage: daysInStage,
          corretor_name: "",
          alert_reasons: alertReasons,
          tags: (lead.tags || []).filter(Boolean),
          negocio_id: lead.negocio_id,
          pipeline_tipo: pipelineTipo,
          state,
          never_touched: neverTouched,
          health,
        });
      }

      // Ordenação:
      // 1) Atrasados antes de sem_direcao (mais urgente operacionalmente)
      // 2) Dentro de atrasado: mais tarefas vencidas primeiro
      // 3) Dentro de sem_direcao: nunca tocados → mais dias → menos dias
      const stateRank: Record<FocusState, number> = { atrasado: 0, sem_direcao: 1 };
      focusLeads.sort((a, b) => {
        if (stateRank[a.state] !== stateRank[b.state]) {
          return stateRank[a.state] - stateRank[b.state];
        }
        if (a.state === "atrasado") {
          return b.overdue_tasks - a.overdue_tasks;
        }
        // sem_direcao
        if (a.never_touched !== b.never_touched) {
          return a.never_touched ? -1 : 1;
        }
        return b.days_without_contact - a.days_without_contact;
      });

      setLeads(focusLeads);
      leadsCountRef.current = focusLeads.length;
      lastSuccessAtRef.current = new Date();
      setStaleSince(null);
    } catch (err: any) {
      console.error("[useFocusLeads] error:", err);
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
