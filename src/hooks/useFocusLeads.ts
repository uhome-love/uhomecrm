/**
 * useFocusLeads — Modo Foco baseado na régua de 4 estados (CEO 20/05/2026).
 *
 * Estados canônicos (cada lead ativo pertence a exatamente 1):
 *
 *   🔴 atrasado          — ≥1 tarefa pendente vencida (data/hora BRT)
 *   🟠 para_hoje         — sem vencida + ≥1 tarefa pendente HOJE ainda não vencida
 *                          (hora_vencimento NULL ou >= agora BRT)
 *   🟢 em_dia (próx 2d ou futuro distante) — sem vencida, sem hoje, ≥1 futura
 *                          FORA do Modo Foco por padrão.
 *                          Próximos 2 dias entram em "Tudo" só com toggle ON.
 *   🟡 sem_direcao       — zero tarefa pendente
 *                          Subdividido por dias desde a última ação real:
 *                            lastAction = MAX(touch_activity, tarefa.concluida_em, lead.created_at)
 *                            < 1d → janela de cortesia (skip)
 *                            1–4d → 🟡 attention
 *                            5–9d → 🟠 warning
 *                            ≥10d → 🔴 critical
 *                            sem toque + sem tarefa concluída → "Nunca trabalhado" 🔴
 *
 * Filtros UI:
 *   "all"           → atrasado + para_hoje + sem_direcao(>=1d)
 *                     (+ em_dia próximos 2d se filters.includeUpcoming2d)
 *   "overdue_tasks" → só atrasado
 *   "today"         → só para_hoje
 *   "no_next_step"  → só sem_direcao(>=1d)
 *
 * Fonte de "toque real": pipeline_atividades.tipo ∈ TOUCH_TYPES
 *   (ultima_acao_at NÃO é mais usado — campo poluído por mudanca_etapa, criação, etc.)
 */

export const FOCUS_LEVELS = { attention: 1, warning: 5, critical: 10 } as const;

/** Whitelist de tipos de pipeline_atividades que contam como TOQUE REAL do corretor. */
export const TOUCH_TYPES = [
  "followup", "whatsapp", "ligacao", "tarefa", "contato",
  "nao_atendeu", "mensagem", "nota", "proposta", "reuniao", "visita",
] as const;

export type FocusHealth = "ok" | "attention" | "warning" | "critical";
export type FocusState = "atrasado" | "para_hoje" | "em_dia_proximo" | "sem_direcao";
export type PendingTaskBucket = "overdue" | "today" | "upcoming";

import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchInBatchesWithRetry, runQueryWithRetry } from "@/lib/taskQueryUtils";

export interface PendingTaskInfo {
  id: string;
  titulo: string;
  vence_em: string | null;
  hora_vencimento: string | null;
  tipo: string | null;
  bucket: PendingTaskBucket;
}

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
  /** Próxima tarefa a executar (atrasada → hoje → próxima futura). Null se sem_direcao. */
  next_pending_task: PendingTaskInfo | null;
  /** Todas as tarefas pendentes (vencidas + hoje + próximas 2d + futuras distantes), já ordenadas. */
  pending_task_list: PendingTaskInfo[];
  /** Dias desde a última ação (só relevante para sem_direcao; 0 para outros). */
  days_without_contact: number;
  days_in_stage: number;
  corretor_name: string;
  alert_reasons: string[];
  tags: string[];
  negocio_id: string | null;
  pipeline_tipo: string;
  state: FocusState;
  /** True quando o lead nunca recebeu toque nem teve tarefa concluída. */
  never_touched: boolean;
  /** Régua de saúde visual. */
  health: FocusHealth;
}

/**
 * Critérios do Modo Foco:
 * - "overdue_tasks" / "today" / "no_next_step" — buckets individuais da régua de saúde
 * - "all"   — "Tudo que precisa de atenção" (default; união dos 3 buckets acima)
 * - "every" — "Todos" (R4.1): universo completo de leads ativos do corretor,
 *             ordenados pela régua. Ignora filtros de bucket e janela de cortesia.
 */
export type FocusCriteria = "overdue_tasks" | "today" | "no_next_step" | "all" | "every";

export interface FocusFilters {
  stageIds?: string[];
  criteria?: FocusCriteria[];
  /** Quando true, "Tudo" também inclui leads com tarefa pendente nos próximos 2 dias. */
  includeUpcoming2d?: boolean;
}


interface UseFocusLeadsReturn {
  leads: FocusLead[];
  loading: boolean;
  error: string | null;
  staleSince: Date | null;
  reload: (filters?: FocusFilters) => Promise<void>;
}

const HEALTH_EMOJI: Record<FocusHealth, string> = {
  critical: "🔴", warning: "🟠", attention: "🟡", ok: "🟢",
};

function healthForSemDirecao(days: number, neverTouched: boolean): FocusHealth {
  if (neverTouched) return "critical";
  if (days >= FOCUS_LEVELS.critical) return "critical";
  if (days >= FOCUS_LEVELS.warning) return "warning";
  if (days >= FOCUS_LEVELS.attention) return "attention";
  return "ok";
}

/** Adiciona N dias a "YYYY-MM-DD" (sem cuidar de horário). */
function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
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
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const nowHHMM_BRT = new Date().toLocaleTimeString("en-GB", {
        timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
      });
      const upcomingCutoffStr = addDaysStr(todayStr, 2); // <= today+2 conta como "próximos 2d"

      // 1. Stages
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
        setLeads([]); leadsCountRef.current = 0; lastSuccessAtRef.current = new Date();
        setStaleSince(null); setLoading(false); return;
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

      if (pipelineTipo === "leads") query = query.is("negocio_id", null);

      const { data: leadsData, error: leadsError } = await runQueryWithRetry<Array<{
        id: string; nome: string; telefone: string | null; telefone2: string | null; email: string | null;
        stage_id: string; stage_changed_at: string; origem: string | null; empreendimento: string | null;
        ultima_acao_at: string | null; tags: string[] | null; negocio_id: string | null;
        corretor_id: string | null; updated_at: string; created_at: string;
      }>>(() => query);
      if (leadsError) throw leadsError;
      if (!leadsData || leadsData.length === 0) {
        setLeads([]); leadsCountRef.current = 0; lastSuccessAtRef.current = new Date();
        setStaleSince(null); setLoading(false); return;
      }

      const leadIds = leadsData.map((l) => l.id);

      // 3. Tarefas (pendente + concluida)
      interface TaskAgg {
        overdueList: PendingTaskInfo[];
        todayList: PendingTaskInfo[];
        upcomingList: PendingTaskInfo[];
        futureDistantList: PendingTaskInfo[];
        lastConcluida: string | null;
      }
      const taskAgg: Record<string, TaskAgg> = {};

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
          taskAgg[lid] = {
            overdueList: [], todayList: [], upcomingList: [], futureDistantList: [],
            lastConcluida: null,
          };
        }
        const bucket = taskAgg[lid];

        if (t.status === "concluida") {
          const c = (t.concluida_em as string | null) ?? null;
          if (c && (!bucket.lastConcluida || c > bucket.lastConcluida)) {
            bucket.lastConcluida = c;
          }
          continue;
        }

        const venceEm = t.vence_em as string | null;
        const hora = (t.hora_vencimento as string | null)?.slice(0, 5) ?? null;
        const info: PendingTaskInfo = {
          id: t.id,
          titulo: t.titulo || "(sem título)",
          vence_em: venceEm,
          hora_vencimento: t.hora_vencimento ?? null,
          tipo: (t as any).tipo ?? null,
          bucket: "upcoming", // será sobrescrito abaixo
        };

        if (!venceEm) {
          // tarefa pendente sem data — trata como "upcoming distante" (não bloqueia, não vence)
          info.bucket = "upcoming";
          bucket.futureDistantList.push(info);
          continue;
        }

        if (
          venceEm < todayStr ||
          (venceEm === todayStr && !!hora && hora < nowHHMM_BRT)
        ) {
          info.bucket = "overdue";
          bucket.overdueList.push(info);
        } else if (venceEm === todayStr) {
          // hoje, ainda não vencida (hora NULL ou >= agora)
          info.bucket = "today";
          bucket.todayList.push(info);
        } else if (venceEm <= upcomingCutoffStr) {
          // amanhã ou depois de amanhã
          info.bucket = "upcoming";
          bucket.upcomingList.push(info);
        } else {
          // 3+ dias no futuro
          info.bucket = "upcoming";
          bucket.futureDistantList.push(info);
        }
      }
      if (taskErrors.length) {
        console.warn("[useFocusLeads] Algumas consultas de tarefas falharam e foram isoladas por chunk", taskErrors);
      }

      // 4. Último toque real
      const lastTouchMap = new Map<string, string>();
      const { rows: activitiesData, errors: activityErrors } = await fetchInBatchesWithRetry<{
        pipeline_lead_id: string; created_at: string;
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
        if (!current || a.created_at > current) lastTouchMap.set(a.pipeline_lead_id, a.created_at);
      }
      if (activityErrors.length) {
        console.warn("[useFocusLeads] Algumas consultas de atividades falharam e foram isoladas por chunk", activityErrors);
      }

      // 5. Régua de 4 estados + filtros
      const criteriaFilter = filters?.criteria || ["all"];
      const filterAll = criteriaFilter.includes("all");
      const wantOverdue = filterAll || criteriaFilter.includes("overdue_tasks");
      const wantToday = filterAll || criteriaFilter.includes("today");
      const wantNoNextStep = filterAll || criteriaFilter.includes("no_next_step");
      const includeUpcoming = !!filters?.includeUpcoming2d;

      const focusLeads: FocusLead[] = [];

      // Sort helpers
      const horaKey = (h: string | null) => (h ? h.slice(0, 5) : "99:99"); // NULL último
      const sortByHora = (a: PendingTaskInfo, b: PendingTaskInfo) =>
        horaKey(a.hora_vencimento).localeCompare(horaKey(b.hora_vencimento));
      const sortByVence = (a: PendingTaskInfo, b: PendingTaskInfo) => {
        const av = a.vence_em ?? "9999-99-99";
        const bv = b.vence_em ?? "9999-99-99";
        if (av !== bv) return av.localeCompare(bv);
        return sortByHora(a, b);
      };

      for (const lead of leadsData) {
        const agg = taskAgg[lead.id];
        const overdueList = agg?.overdueList ?? [];
        const todayList = agg?.todayList ?? [];
        const upcomingList = agg?.upcomingList ?? [];
        const futureDistantList = agg?.futureDistantList ?? [];
        const hasOverdue = overdueList.length > 0;
        const hasToday = todayList.length > 0;
        const hasUpcoming = upcomingList.length > 0;
        const hasFutureDistant = futureDistantList.length > 0;
        const hasAnyPending = hasOverdue || hasToday || hasUpcoming || hasFutureDistant;

        const lastConcluida = agg?.lastConcluida ?? null;
        const lastTouch = lastTouchMap.get(lead.id) ?? null;

        // Estado canônico
        let state: FocusState;
        if (hasOverdue) state = "atrasado";
        else if (hasToday) state = "para_hoje";
        else if (hasUpcoming || hasFutureDistant) state = "em_dia_proximo"; // ambos rotulados aqui
        else state = "sem_direcao";

        // Filtros
        if (state === "atrasado" && !wantOverdue) continue;
        if (state === "para_hoje" && !wantToday) continue;
        if (state === "em_dia_proximo") {
          // Só entra em "Tudo" com toggle ligado, e somente se houver tarefa em próximos 2d (não futuras distantes)
          if (!(filterAll && includeUpcoming && hasUpcoming)) continue;
        }
        if (state === "sem_direcao" && !wantNoNextStep) continue;

        // last_action / dias sem direção
        const neverTouched = !lastTouch && !lastConcluida;
        const candidates = [lastTouch, lastConcluida, lead.created_at].filter(Boolean) as string[];
        const lastActionISO = candidates.length
          ? candidates.reduce((a, b) => (a > b ? a : b))
          : lead.created_at;
        const daysSinceAction = lastActionISO
          ? Math.floor((Date.now() - new Date(lastActionISO).getTime()) / 86400000)
          : 999;

        // Janela de cortesia: sem_direcao recém-saído (dia 0) sai (a menos que nunca tocado)
        if (state === "sem_direcao" && !neverTouched && daysSinceAction < 1) continue;

        const daysInStage = Math.floor(
          (Date.now() - new Date(lead.stage_changed_at).getTime()) / 86400000
        );

        // Lista de pendentes ordenada (overdue → today → upcoming → distante)
        overdueList.sort(sortByVence);
        todayList.sort(sortByHora);
        upcomingList.sort(sortByVence);
        futureDistantList.sort(sortByVence);
        const pendingTaskList: PendingTaskInfo[] = [
          ...overdueList, ...todayList, ...upcomingList, ...futureDistantList,
        ];
        const nextPendingTask = pendingTaskList[0] ?? null;

        // Health + alertReasons
        let health: FocusHealth;
        let alertReasons: string[];
        if (state === "atrasado") {
          health = "critical";
          alertReasons = [`${overdueList.length} tarefa(s) vencida(s)`];
        } else if (state === "para_hoje") {
          health = "warning";
          const earliest = todayList[0];
          const horaTxt = earliest?.hora_vencimento ? ` às ${horaKey(earliest.hora_vencimento)}` : "";
          alertReasons = [`🟠 ${todayList.length} tarefa(s) hoje${horaTxt}`];
        } else if (state === "em_dia_proximo") {
          health = "ok";
          const earliest = upcomingList[0];
          alertReasons = earliest?.vence_em
            ? [`🟢 Próxima tarefa em ${earliest.vence_em}`]
            : [`🟢 Tarefa agendada`];
        } else {
          // sem_direcao
          health = healthForSemDirecao(daysSinceAction, neverTouched);
          alertReasons = neverTouched
            ? [`${HEALTH_EMOJI.critical} Nunca trabalhado`]
            : [`${HEALTH_EMOJI[health]} Sem direção há ${daysSinceAction}d`];
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
          overdue_tasks: overdueList.length,
          overdue_task_list: overdueList.map((t) => ({
            id: t.id, titulo: t.titulo, vence_em: t.vence_em, tipo: t.tipo,
          })),
          next_pending_task: nextPendingTask,
          pending_task_list: pendingTaskList,
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
      // 1) atrasado (vencidas DESC)
      // 2) para_hoje (hora ASC, NULL último)
      // 3) em_dia_proximo (vence_em ASC)
      // 4) sem_direcao (nunca → 10+d → 5–9d → 1–4d)
      const stateRank: Record<FocusState, number> = {
        atrasado: 0, para_hoje: 1, em_dia_proximo: 2, sem_direcao: 3,
      };
      focusLeads.sort((a, b) => {
        if (stateRank[a.state] !== stateRank[b.state]) return stateRank[a.state] - stateRank[b.state];
        if (a.state === "atrasado") return b.overdue_tasks - a.overdue_tasks;
        if (a.state === "para_hoje") {
          const ah = horaKey(a.next_pending_task?.hora_vencimento ?? null);
          const bh = horaKey(b.next_pending_task?.hora_vencimento ?? null);
          return ah.localeCompare(bh);
        }
        if (a.state === "em_dia_proximo") {
          const av = a.next_pending_task?.vence_em ?? "9999-99-99";
          const bv = b.next_pending_task?.vence_em ?? "9999-99-99";
          return av.localeCompare(bv);
        }
        // sem_direcao
        if (a.never_touched !== b.never_touched) return a.never_touched ? -1 : 1;
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
