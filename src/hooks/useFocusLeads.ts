/**
 * useFocusLeads — Fetches leads needing attention for Focus Mode.
 *
 * Criteria (filterable):
 *  1. No pending tasks at all (desatualizado)
 *  2. Overdue pending tasks (vence_em < today)
 *  3. Stage stalled > 5 days (stage_changed_at < now - 5d)
 *
 * Supports filtering by stage and criteria type.
 */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/customClient";
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
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

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
            .select("id, pipeline_lead_id, titulo, tipo, vence_em, status")
            .in("pipeline_lead_id", chunk)
            .eq("status", "pendente"),
        { chunkSize: 50, minChunkSize: 10 }
      );

      for (const t of tasksData || []) {
        if (!allTasks[t.pipeline_lead_id]) {
          allTasks[t.pipeline_lead_id] = { overdue: 0, hasFuture: false, overdueList: [] };
        }
        if (t.vence_em && t.vence_em < todayStr) {
          allTasks[t.pipeline_lead_id].overdue++;
          allTasks[t.pipeline_lead_id].overdueList.push({
            id: t.id,
            titulo: t.titulo || "(sem título)",
            vence_em: t.vence_em,
            tipo: (t as any).tipo ?? null,
          });
        } else {
          allTasks[t.pipeline_lead_id].hasFuture = true;
        }
      }

      if (taskErrors.length) {
        console.warn("[useFocusLeads] Algumas consultas de tarefas falharam e foram isoladas por chunk", taskErrors);
      }

      // 4. Build focus leads — filter for those that need attention
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const fiveDaysAgoStr = fiveDaysAgo.toISOString();

      const criteriaFilter = filters?.criteria || ["all"];
      const filterAll = criteriaFilter.includes("all");

      const focusLeads: FocusLead[] = [];

      for (const lead of leadsData) {
        const taskInfo = allTasks[lead.id];
        const hasOverdue = (taskInfo?.overdue ?? 0) > 0;
        const hasNoTasks = !taskInfo;
        const stageStalled = lead.stage_changed_at < fiveDaysAgoStr;

        // Apply criteria filter
        const matchesOverdue = hasOverdue && (filterAll || criteriaFilter.includes("overdue_tasks"));
        const matchesNoTasks = hasNoTasks && (filterAll || criteriaFilter.includes("no_tasks"));
        const matchesStagnant = stageStalled && (filterAll || criteriaFilter.includes("stagnant"));

        if (!matchesOverdue && !matchesNoTasks && !matchesStagnant) continue;

        const lastContact = lead.ultima_acao_at || lead.updated_at;
        const daysSinceContact = lastContact
          ? Math.floor((Date.now() - new Date(lastContact).getTime()) / 86400000)
          : 999;

        const daysInStage = Math.floor(
          (Date.now() - new Date(lead.stage_changed_at).getTime()) / 86400000
        );

        const alertReasons: string[] = [];
        if (hasOverdue) alertReasons.push(`${taskInfo!.overdue} tarefa(s) vencida(s)`);
        if (hasNoTasks) alertReasons.push("Sem tarefas pendentes");
        if (stageStalled) alertReasons.push(`Etapa parada há ${daysInStage} dias`);
        if (daysSinceContact >= 3) alertReasons.push(`Sem contato há ${daysSinceContact} dias`);

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
          last_contact_at: lastContact,
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
