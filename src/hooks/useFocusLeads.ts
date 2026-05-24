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
  /** R4 — restringe a fila a este conjunto de leads (usado pelo FocusEmptyState). */
  leadIds?: string[];
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

export type FocusMode = "leads" | "time";

export function useFocusLeads(
  corretorAuthId: string | null,
  pipelineTipo: "leads" | "negocios" = "leads",
  modo: FocusMode = "leads"
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

    if (modo === "time") {
      try {
        await reloadTimeMode({
          gestorId: corretorAuthId,
          filters,
          setLeads,
          setStaleSince,
          lastSuccessAtRef,
          leadsCountRef,
        });
      } catch (err: any) {
        console.error("[useFocusLeads/time] error:", err);
        if (leadsCountRef.current > 0 && lastSuccessAtRef.current) {
          setStaleSince(lastSuccessAtRef.current);
        } else {
          setError(err.message || "Erro ao buscar leads do time");
        }
      } finally {
        setLoading(false);
      }
      return;
    }


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
      if (filters?.leadIds && filters.leadIds.length > 0) {
        query = query.in("id", filters.leadIds);
      }


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
      const filterEvery = criteriaFilter.includes("every");
      const filterAll = !filterEvery && criteriaFilter.includes("all");
      const wantOverdue = filterEvery || filterAll || criteriaFilter.includes("overdue_tasks");
      const wantToday = filterEvery || filterAll || criteriaFilter.includes("today");
      const wantNoNextStep = filterEvery || filterAll || criteriaFilter.includes("no_next_step");
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

        // Filtros (em "every", nenhum bucket é descartado)
        if (!filterEvery) {
          if (state === "atrasado" && !wantOverdue) continue;
          if (state === "para_hoje" && !wantToday) continue;
          if (state === "em_dia_proximo") {
            // Só entra em "Tudo" com toggle ligado, e somente se houver tarefa em próximos 2d (não futuras distantes)
            if (!(filterAll && includeUpcoming && hasUpcoming)) continue;
          }
          if (state === "sem_direcao" && !wantNoNextStep) continue;
        }

        // last_action / dias sem direção
        const neverTouched = !lastTouch && !lastConcluida;
        const candidates = [lastTouch, lastConcluida, lead.created_at].filter(Boolean) as string[];
        const lastActionISO = candidates.length
          ? candidates.reduce((a, b) => (a > b ? a : b))
          : lead.created_at;
        const daysSinceAction = lastActionISO
          ? Math.floor((Date.now() - new Date(lastActionISO).getTime()) / 86400000)
          : 999;

        // Janela de cortesia: sem_direcao recém-saído (dia 0) sai (a menos que nunca tocado).
        // Não aplica em "every" — universo completo não deve filtrar nada.
        if (!filterEvery && state === "sem_direcao" && !neverTouched && daysSinceAction < 1) continue;


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
  }, [corretorAuthId, pipelineTipo, modo]);

  return { leads, loading, error, staleSince, reload };
}

// ============================================================================
// MODO TIME — fila do gestor com leads críticos de TODO o time
// ============================================================================
//
// Critérios "crítico" (lead entra se atender ≥1):
//  1. Sem contato há 5+ dias (COALESCE(ultima_acao_at, created_at) < now-5d)
//  2. Tarefa atrasada há 3+ dias (vence_em < today-3 ou today-3 com hora passada)
//  3. Lead em stage tipo='visita_marcada' SEM visita confirmada (confirmed_at IS NULL)
//  4. Lead com negocio_id parado há 7+ dias (stage_changed_at < now-7d)
//
// Inclui leads de ambos os pipelines (leads + negocios). Exclui stages
// descarte/convertido.
async function reloadTimeMode(params: {
  gestorId: string;
  filters: FocusFilters | undefined;
  setLeads: (l: FocusLead[]) => void;
  setStaleSince: (d: Date | null) => void;
  lastSuccessAtRef: { current: Date | null };
  leadsCountRef: { current: number };
}) {
  const { gestorId, filters, setLeads, setStaleSince, lastSuccessAtRef, leadsCountRef } = params;

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const nowHHMM_BRT = new Date().toLocaleTimeString("en-GB", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
  });
  const cutoff5d = addDaysStr(todayStr, -5);
  const cutoff3dTask = addDaysStr(todayStr, -3);
  const cutoff7d = addDaysStr(todayStr, -7);

  // 1. Team (auth user_ids dos corretores ativos)
  const { data: teamData, error: teamErr } = await runQueryWithRetry<
    Array<{ user_id: string }>
  >(() =>
    supabase
      .from("team_members")
      .select("user_id")
      .eq("gerente_id", gestorId)
      .eq("status", "ativo")
      .not("user_id", "is", null)
  );
  if (teamErr) throw teamErr;
  const teamIds = (teamData ?? []).map((r) => r.user_id).filter(Boolean);
  if (teamIds.length === 0) {
    setLeads([]); leadsCountRef.current = 0; lastSuccessAtRef.current = new Date();
    setStaleSince(null); return;
  }

  // 2. Stages (ambos pipelines, exclui descarte/convertido)
  const { data: stagesData, error: stagesErr } = await runQueryWithRetry<
    Array<{ id: string; nome: string; tipo: string | null; pipeline_tipo: string | null }>
  >(() =>
    supabase
      .from("pipeline_stages")
      .select("id, nome, tipo, pipeline_tipo")
  );
  if (stagesErr) throw stagesErr;
  const stageMap: Record<string, { nome: string; tipo: string | null; pipeline_tipo: string }> = {};
  const allowedStageIds: string[] = [];
  for (const s of stagesData ?? []) {
    if (s.tipo === "descarte" || s.tipo === "convertido") continue;
    stageMap[s.id] = {
      nome: s.nome,
      tipo: s.tipo,
      pipeline_tipo: (s.pipeline_tipo as string) || "leads",
    };
    allowedStageIds.push(s.id);
  }

  // 3. Perfis do time (nomes)
  const { data: profilesData } = await runQueryWithRetry<
    Array<{ user_id: string; nome: string | null }>
  >(() =>
    supabase
      .from("profiles")
      .select("user_id, nome")
      .in("user_id", teamIds)
  );
  const corretorNomeMap = new Map<string, string>();
  for (const p of profilesData ?? []) {
    if (p.user_id) corretorNomeMap.set(p.user_id, p.nome || "(sem nome)");
  }

  // 4. Leads ativos do time (sem filtro de negocio_id; ambos pipelines)
  const { rows: leadsData, errors: leadsErrors } = await fetchInBatchesWithRetry<any>(
    teamIds,
    (chunk) =>
      supabase
        .from("pipeline_leads")
        .select(
          "id, nome, telefone, telefone2, email, stage_id, stage_changed_at, origem, empreendimento, ultima_acao_at, tags, negocio_id, corretor_id, updated_at, created_at"
        )
        .in("corretor_id", chunk)
        .eq("arquivado", false)
        .in("stage_id", allowedStageIds),
    { chunkSize: 50, minChunkSize: 10 }
  );
  if (leadsErrors.length) {
    console.warn("[useFocusLeads/time] chunks de leads com erro", leadsErrors);
  }
  if (!leadsData || leadsData.length === 0) {
    setLeads([]); leadsCountRef.current = 0; lastSuccessAtRef.current = new Date();
    setStaleSince(null); return;
  }
  const leadIds = leadsData.map((l: any) => l.id);

  // 5. Tarefas pendentes (só vencidas/hoje/futuras — não precisa concluídas aqui)
  const overdueByLead = new Map<string, PendingTaskInfo[]>();
  const todayByLead = new Map<string, PendingTaskInfo[]>();
  const upcomingByLead = new Map<string, PendingTaskInfo[]>();
  const { rows: tasksData } = await fetchInBatchesWithRetry<any>(
    leadIds,
    (chunk) =>
      supabase
        .from("pipeline_tarefas")
        .select("id, pipeline_lead_id, titulo, tipo, vence_em, hora_vencimento, status")
        .in("pipeline_lead_id", chunk)
        .eq("status", "pendente"),
    { chunkSize: 50, minChunkSize: 10 }
  );
  for (const t of tasksData ?? []) {
    const lid = t.pipeline_lead_id as string;
    const venceEm = t.vence_em as string | null;
    const hora = (t.hora_vencimento as string | null)?.slice(0, 5) ?? null;
    const info: PendingTaskInfo = {
      id: t.id,
      titulo: t.titulo || "(sem título)",
      vence_em: venceEm,
      hora_vencimento: t.hora_vencimento ?? null,
      tipo: t.tipo ?? null,
      bucket: "upcoming",
    };
    if (venceEm && (venceEm < todayStr || (venceEm === todayStr && !!hora && hora < nowHHMM_BRT))) {
      info.bucket = "overdue";
      if (!overdueByLead.has(lid)) overdueByLead.set(lid, []);
      overdueByLead.get(lid)!.push(info);
    } else if (venceEm === todayStr) {
      info.bucket = "today";
      if (!todayByLead.has(lid)) todayByLead.set(lid, []);
      todayByLead.get(lid)!.push(info);
    } else {
      if (!upcomingByLead.has(lid)) upcomingByLead.set(lid, []);
      upcomingByLead.get(lid)!.push(info);
    }
  }

  // 6. Visitas confirmadas (só leads em stage visita_marcada)
  const leadsEmVisitaMarcada = leadsData
    .filter((l: any) => stageMap[l.stage_id]?.tipo === "visita_marcada")
    .map((l: any) => l.id);
  const visitaConfirmadaSet = new Set<string>();
  if (leadsEmVisitaMarcada.length > 0) {
    const { rows: vData } = await fetchInBatchesWithRetry<any>(
      leadsEmVisitaMarcada,
      (chunk) =>
        supabase
          .from("visitas")
          .select("pipeline_lead_id, confirmed_at, status")
          .in("pipeline_lead_id", chunk)
          .not("confirmed_at", "is", null),
      { chunkSize: 100, minChunkSize: 20 }
    );
    for (const v of vData ?? []) {
      if (v.pipeline_lead_id) visitaConfirmadaSet.add(v.pipeline_lead_id);
    }
  }

  // 7. Aplicar 4 critérios + montar FocusLead[]
  const horaKey = (h: string | null) => (h ? h.slice(0, 5) : "99:99");
  const sortByVence = (a: PendingTaskInfo, b: PendingTaskInfo) => {
    const av = a.vence_em ?? "9999-99-99";
    const bv = b.vence_em ?? "9999-99-99";
    if (av !== bv) return av.localeCompare(bv);
    return horaKey(a.hora_vencimento).localeCompare(horaKey(b.hora_vencimento));
  };

  const out: FocusLead[] = [];
  for (const lead of leadsData) {
    const stageInfo = stageMap[lead.stage_id];
    if (!stageInfo) continue;
    if (filters?.leadIds && filters.leadIds.length > 0 && !filters.leadIds.includes(lead.id)) continue;

    const overdueList = (overdueByLead.get(lead.id) ?? []).slice().sort(sortByVence);
    const todayList = (todayByLead.get(lead.id) ?? []).slice().sort(sortByVence);
    const upcomingList = (upcomingByLead.get(lead.id) ?? []).slice().sort(sortByVence);

    const lastActionISO: string = lead.ultima_acao_at || lead.created_at;
    const lastActionDateStr = lastActionISO ? lastActionISO.slice(0, 10) : todayStr;
    const daysSinceAction = Math.floor(
      (Date.now() - new Date(lastActionISO || lead.created_at).getTime()) / 86400000
    );
    const daysInStage = Math.floor(
      (Date.now() - new Date(lead.stage_changed_at).getTime()) / 86400000
    );

    // Critério 1: sem contato 5+d
    const isSemContato5d = lastActionDateStr < cutoff5d;
    // Critério 2: tarefa atrasada há 3+ dias
    const isTaskAtrasada3d = overdueList.some(
      (t) => t.vence_em && t.vence_em <= cutoff3dTask
    );
    // Critério 3: visita marcada sem confirmação
    const isVisitaSemConfirmacao =
      stageInfo.tipo === "visita_marcada" && !visitaConfirmadaSet.has(lead.id);
    // Critério 4: negócio parado 7+d
    const isNegocioParado7d =
      !!lead.negocio_id && lead.stage_changed_at &&
      lead.stage_changed_at.slice(0, 10) < cutoff7d;

    if (!isSemContato5d && !isTaskAtrasada3d && !isVisitaSemConfirmacao && !isNegocioParado7d) {
      continue;
    }

    // Razão principal (ordem de severidade)
    const reasons: string[] = [];
    if (isTaskAtrasada3d) {
      const worst = overdueList[0];
      reasons.push(
        `🔴 Tarefa atrasada há ${Math.max(
          0,
          Math.floor((Date.now() - new Date((worst.vence_em as string) + "T23:59:59").getTime()) / 86400000)
        )}d`
      );
    }
    if (isNegocioParado7d) reasons.push(`🔴 Negócio parado há ${daysInStage}d`);
    if (isVisitaSemConfirmacao) reasons.push(`🟠 Visita marcada sem confirmação`);
    if (isSemContato5d) reasons.push(`🟠 Sem contato há ${daysSinceAction}d`);

    const pendingTaskList = [...overdueList, ...todayList, ...upcomingList];

    out.push({
      id: lead.id,
      name: lead.nome,
      phone: lead.telefone,
      phone2: lead.telefone2,
      email: lead.email,
      stage: stageInfo.nome,
      stage_id: lead.stage_id,
      origin: lead.origem,
      interest: lead.empreendimento,
      last_contact_at: lead.ultima_acao_at,
      stage_updated_at: lead.stage_changed_at,
      overdue_tasks: overdueList.length,
      overdue_task_list: overdueList.map((t) => ({
        id: t.id, titulo: t.titulo, vence_em: t.vence_em, tipo: t.tipo,
      })),
      next_pending_task: pendingTaskList[0] ?? null,
      pending_task_list: pendingTaskList,
      days_without_contact: daysSinceAction,
      days_in_stage: daysInStage,
      corretor_name: corretorNomeMap.get(lead.corretor_id) || "—",
      alert_reasons: reasons,
      tags: (lead.tags || []).filter(Boolean),
      negocio_id: lead.negocio_id,
      pipeline_tipo: stageInfo.pipeline_tipo,
      state: isTaskAtrasada3d || isNegocioParado7d ? "atrasado" : "sem_direcao",
      never_touched: false,
      health: isTaskAtrasada3d || isNegocioParado7d ? "critical" : "warning",
    });
  }

  // Ordenação: critical primeiro, depois por daysSinceAction desc
  out.sort((a, b) => {
    const rank = (h: FocusHealth) => (h === "critical" ? 0 : h === "warning" ? 1 : 2);
    if (rank(a.health) !== rank(b.health)) return rank(a.health) - rank(b.health);
    return b.days_without_contact - a.days_without_contact;
  });

  setLeads(out);
  leadsCountRef.current = out.length;
  lastSuccessAtRef.current = new Date();
  setStaleSince(null);
}

