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
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  reload: (filters?: FocusFilters) => Promise<void>;
}

export function useFocusLeads(
  corretorAuthId: string | null,
  pipelineTipo: "leads" | "negocios" = "leads"
): UseFocusLeadsReturn {
  const [leads, setLeads] = useState<FocusLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (filters?: FocusFilters) => {
    if (!corretorAuthId) return;
    setLoading(true);
    setError(null);

    try {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      // 1. Get stages for name mapping — exclude descarte and convertido
      const { data: stagesData } = await supabase
        .from("pipeline_stages")
        .select("id, nome, tipo, pipeline_tipo")
        .eq("pipeline_tipo", pipelineTipo);

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

      const { data: leadsData, error: leadsError } = await query;
      if (leadsError) throw leadsError;
      if (!leadsData || leadsData.length === 0) {
        setLeads([]);
        setLoading(false);
        return;
      }

      // 3. Get all pending tasks for these leads
      const leadIds = leadsData.map(l => l.id);
      const allTasks: Record<string, { overdue: number; hasFuture: boolean }> = {};

      for (let i = 0; i < leadIds.length; i += 200) {
        const chunk = leadIds.slice(i, i + 200);
        const { data: tasksData } = await supabase
          .from("pipeline_tarefas")
          .select("pipeline_lead_id, vence_em, status")
          .in("pipeline_lead_id", chunk)
          .eq("status", "pendente");

        for (const t of tasksData || []) {
          if (!allTasks[t.pipeline_lead_id]) {
            allTasks[t.pipeline_lead_id] = { overdue: 0, hasFuture: false };
          }
          if (t.vence_em && t.vence_em < todayStr) {
            allTasks[t.pipeline_lead_id].overdue++;
          } else {
            allTasks[t.pipeline_lead_id].hasFuture = true;
          }
        }
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
    } catch (err: any) {
      console.error("[useFocusLeads] error:", err);
      setError(err.message || "Erro ao buscar leads");
    } finally {
      setLoading(false);
    }
  }, [corretorAuthId, pipelineTipo]);

  return { leads, loading, error, reload };
}
