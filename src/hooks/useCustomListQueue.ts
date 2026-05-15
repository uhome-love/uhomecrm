/**
 * useCustomListQueue — Client-side queue for custom (pipeline-based) lists.
 *
 * Provides the same interface as useOAServerQueue so DialingModeWithScript
 * can swap seamlessly between OA-server lists and custom pipeline lists.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { OALead, OALista } from "@/hooks/useOfertaAtiva";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/** Convert a pipeline_lead row into an OALead-compatible shape */
function pipelineLeadToOALead(row: any): OALead {
  return {
    id: row.id,
    lista_id: "custom_pipeline",
    nome: row.nome || "Sem nome",
    telefone: row.telefone || null,
    telefone2: row.telefone2 || null,
    email: row.email || null,
    telefone_normalizado: row.telefone?.replace(/\D/g, "") || null,
    empreendimento: row.empreendimento || null,
    campanha: row.campanha || null,
    origem: row.origem || null,
    data_lead: row.created_at || null,
    observacoes: row.observacoes || null,
    status: "na_fila",
    motivo_descarte: null,
    corretor_id: row.corretor_id || null,
    jetimob_id: null,
    cadastrado_jetimob: false,
    cadastrado_jetimob_em: null,
    tentativas_count: 0,
    ultima_tentativa: null,
    proxima_tentativa_apos: null,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

export function useCustomListQueue(lista: OALista) {
  const { user } = useAuth();
  const [currentLead, setCurrentLead] = useState<OALead | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [queueEmpty, setQueueEmpty] = useState(false);

  // Internal queue of pipeline_lead IDs
  const queueRef = useRef<string[]>([]);
  const initializedRef = useRef(false);

  // Load lead IDs from sessionStorage on mount
  useEffect(() => {
    if (initializedRef.current) return;
    const raw = sessionStorage.getItem("custom_list_lead_ids");
    if (raw) {
      try {
        queueRef.current = JSON.parse(raw) as string[];
      } catch {
        queueRef.current = [];
      }
    }
    initializedRef.current = true;
  }, []);

  const fetchNext = useCallback(async (): Promise<OALead | null> => {
    if (!user) return null;

    // Initialize queue if not done
    if (!initializedRef.current) {
      const raw = sessionStorage.getItem("custom_list_lead_ids");
      if (raw) {
        try { queueRef.current = JSON.parse(raw) as string[]; } catch { queueRef.current = []; }
      }
      initializedRef.current = true;
    }

    if (queueRef.current.length === 0) {
      setQueueEmpty(true);
      setCurrentLead(null);
      return null;
    }

    setIsLoading(true);
    try {
      const nextId = queueRef.current.shift()!;
      // Update sessionStorage so refreshes don't re-serve
      sessionStorage.setItem("custom_list_lead_ids", JSON.stringify(queueRef.current));

      const { data, error } = await supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, telefone2, email, empreendimento, origem, observacoes, corretor_id, created_at, updated_at")
        .eq("id", nextId)
        .single();

      if (error || !data) {
        // Skip this lead, try next
        console.warn("Custom list: lead not found, skipping", nextId);
        return fetchNext();
      }

      const oaLead = pipelineLeadToOALead(data);
      setCurrentLead(oaLead);
      setQueueEmpty(false);
      return oaLead;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // No-op heartbeat/lock for custom lists (pipeline_leads don't use locks)
  const startHeartbeat = useCallback((_leadId: string) => {}, []);
  const stopHeartbeat = useCallback(() => {}, []);
  const unlockLead = useCallback(async (_leadId: string) => {}, []);

  return {
    currentLead,
    setCurrentLead,
    isLoading,
    queueEmpty,
    fetchNext,
    startHeartbeat,
    stopHeartbeat,
    unlockLead,
  };
}

/**
 * Register an attempt for a custom-list lead.
 * Records in:
 * 1) oferta_ativa_tentativas (for stats/ranking/gamification)
 * 2) pipeline_atividades (for lead timeline in pipeline)
 * 3) Updates pipeline_leads.updated_at + ultima_acao_at
 */
export function useCustomListRegistrar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const registrar = useCallback(async (
    lead: OALead,
    canal: string,
    resultado: string,
    feedback: string,
    lista?: OALista,
    idempotencyKey?: string,
    visitaMarcada?: boolean,
    interesseTipo?: string,
  ): Promise<{ success: boolean; reason?: string; idempotent?: boolean }> => {
    if (!user) return { success: false, reason: "no_user" };

    try {
      // 1) Insert into oferta_ativa_tentativas for stats
      const pontos = resultado === "com_interesse" ? 3 : resultado === "numero_errado" ? 0 : 1;
      const { error: tentError } = await supabase.from("oferta_ativa_tentativas").insert({
        lead_id: lead.id,
        corretor_id: user.id,
        lista_id: null,
        empreendimento: lead.empreendimento,
        canal,
        resultado,
        feedback,
        pontos,
        idempotency_key: idempotencyKey || `${user.id}_${lead.id}_${Date.now()}`,
      } as any);

      if (tentError) {
        if (tentError.code === "23505") return { success: true, idempotent: true };
        console.error("Custom registrar tentativa error:", tentError);
        return { success: false, reason: "error" };
      }

      // 2) Insert into pipeline_atividades for lead timeline
      const canalLabel = canal === "ligacao" ? "Ligação" : canal === "whatsapp" ? "WhatsApp" : canal === "email" ? "E-mail" : canal;
      const resultLabel = resultado === "com_interesse" ? "Aproveitado"
        : resultado === "nao_atendeu" ? "Não atendeu"
        : resultado === "sem_interesse" ? "Sem interesse"
        : resultado === "numero_errado" ? "Número errado"
        : resultado === "agendar" ? "Reagendar"
        : resultado;

      // Build detailed title including sub-option for sem_interesse
      const semInteresseLabels: Record<string, string> = {
        nao_quer_produto: "Não quer o produto",
        ja_comprou: "Já comprou outro",
        sem_condicao: "Sem condição financeira",
        nao_momento: "Não é o momento",
      };
      const subLabel = resultado === "sem_interesse" && interesseTipo && semInteresseLabels[interesseTipo]
        ? ` (${semInteresseLabels[interesseTipo]})`
        : "";

      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: lead.id,
        created_by: user.id,
        tipo: "contato",
        titulo: `[Oferta Ativa] ${canalLabel}: ${resultLabel}${subLabel}`,
        descricao: feedback || null,
        status: "concluida",
        prioridade: "normal",
        data: new Date().toISOString().slice(0, 10),
      });

      // 3) Update pipeline_leads timestamps
      await supabase.from("pipeline_leads").update({
        updated_at: new Date().toISOString(),
        ultima_acao_at: new Date().toISOString(),
      } as any).eq("id", lead.id);

      // 4) If aproveitado with interesse type, move to appropriate pipeline stage
      if (resultado === "com_interesse" && interesseTipo) {
        const stageMap: Record<string, string> = {
          pediu_info: "Contato Iniciado",
          demonstrou_interesse: "Atendimento",
          quer_visitar: "Possível Visita",
          visita_marcada: "Visita Marcada",
        };
        const targetStageName = stageMap[interesseTipo];
        if (targetStageName) {
          const { data: stage } = await supabase
            .from("pipeline_stages")
            .select("id")
            .eq("nome", targetStageName)
            .eq("pipeline_tipo", "leads")
            .eq("ativo", true)
            .single();
          if (stage) {
            await supabase.from("pipeline_leads").update({
              stage_id: stage.id,
              temperatura: "quente",
            } as any).eq("id", lead.id);
          }
        }
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["oa-ranking"] });
      queryClient.invalidateQueries({ queryKey: ["oa-stats"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["corretor-daily-stats"] });

      return { success: true };
    } catch (err) {
      console.error("Custom registrar error:", err);
      return { success: false, reason: "error" };
    }
  }, [user, queryClient]);

  return { registrar };
}

/** Check if a lista is a custom (pipeline-based) list */
export function isCustomList(lista: OALista): boolean {
  return lista.id.startsWith("custom_") || lista.origem === "custom_list";
}
