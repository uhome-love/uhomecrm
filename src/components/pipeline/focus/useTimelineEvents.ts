/**
 * useTimelineEvents — Sprint 1 R2 (Modo Foco)
 *
 * Agrupa eventos de um lead numa timeline única ordenada por data desc:
 *   - pipeline_atividades (todas)
 *   - pipeline_tarefas pendentes E concluídas (recentes)
 *   - pipeline_historico (movimentações de stage) — se a tabela existir
 *   - criação do lead (pipeline_leads.created_at)
 *
 * Sem schema change (Sprint 1).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TimelineEventKind =
  | "atividade"
  | "tarefa_pendente"
  | "tarefa_concluida"
  | "stage_change"
  | "lead_created";

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  /** ISO timestamp — usado para ordenar. */
  at: string;
  /** Título curto p/ exibir. */
  title: string;
  /** Texto auxiliar (descrição, observação, etc). */
  subtitle?: string | null;
  /** Tipo/categoria opcional (ex: "ligacao", "whatsapp"). */
  tipo?: string | null;
  /** Status original quando aplicável. */
  status?: string | null;
}

interface UseTimelineEventsReturn {
  events: TimelineEvent[];
  loading: boolean;
  reload: () => void;
}

export function useTimelineEvents(leadId: string | null | undefined): UseTimelineEventsReturn {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!leadId) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [atRes, taRes, hiRes, leadRes] = await Promise.all([
        supabase
          .from("pipeline_atividades")
          .select("id, tipo, titulo, descricao, created_at, status")
          .eq("pipeline_lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("pipeline_tarefas")
          .select("id, titulo, tipo, status, created_at, concluida_em, vence_em, hora_vencimento")
          .eq("pipeline_lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(50),
        // pipeline_historico existe (validado Sprint 1 R2). Se vier erro, ignora.
        supabase
          .from("pipeline_historico")
          .select("id, stage_anterior_id, stage_novo_id, observacao, created_at")
          .eq("pipeline_lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("pipeline_leads")
          .select("id, created_at, nome")
          .eq("id", leadId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const merged: TimelineEvent[] = [];

      for (const a of atRes.data || []) {
        merged.push({
          id: `at-${a.id}`,
          kind: "atividade",
          at: a.created_at,
          title: a.titulo || a.tipo || "Atividade",
          subtitle: a.descricao || null,
          tipo: a.tipo,
          status: a.status,
        });
      }

      for (const t of taRes.data || []) {
        const isConcluida = t.status === "concluida";
        merged.push({
          id: `ta-${t.id}`,
          kind: isConcluida ? "tarefa_concluida" : "tarefa_pendente",
          at: isConcluida && t.concluida_em ? t.concluida_em : t.created_at,
          title: t.titulo,
          subtitle: t.vence_em
            ? `Vence: ${t.vence_em}${t.hora_vencimento ? ` ${String(t.hora_vencimento).slice(0, 5)}` : ""}`
            : null,
          tipo: t.tipo,
          status: t.status,
        });
      }

      if (!hiRes.error) {
        for (const h of hiRes.data || []) {
          merged.push({
            id: `hi-${h.id}`,
            kind: "stage_change",
            at: h.created_at,
            title: "Mudança de etapa",
            subtitle: h.observacao || null,
          });
        }
      }

      if (leadRes.data?.created_at) {
        merged.push({
          id: `lead-${leadRes.data.id}`,
          kind: "lead_created",
          at: leadRes.data.created_at,
          title: "Lead criado",
          subtitle: leadRes.data.nome ? `Origem do contato: ${leadRes.data.nome}` : null,
        });
      }

      merged.sort((a, b) => (a.at < b.at ? 1 : -1));
      setEvents(merged);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [leadId, tick]);

  return { events, loading, reload: () => setTick((n) => n + 1) };
}
