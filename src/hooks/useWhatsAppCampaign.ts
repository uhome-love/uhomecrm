import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/* ─── Types ─── */
export interface CampaignBatch {
  id: string;
  created_at: string;
  nome: string;
  oferta_id: string | null;
  oferta_nome: string | null;
  campanha: string | null;
  template_name: string;
  template_language: string;
  template_params: any;
  redirect_url: string | null;
  filtros: any;
  total_leads: number;
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_replied: number;
  total_clicked: number;
  total_aproveitado: number;
  total_failed: number;
  batch_size: number;
  interval_seconds: number;
  status: string;
  dispatched_by: string;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
}

export interface CampaignSend {
  id: string;
  batch_id: string;
  pipeline_lead_id: string | null;
  telefone: string | null;
  telefone_normalizado: string | null;
  nome: string | null;
  email: string | null;
  template_name: string | null;
  status_envio: string;
  message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  clicked_at: string | null;
  aproveitado_em: string | null;
  corretor_distribuido_id: string | null;
}

export interface EligibleLead {
  id: string;
  nome: string;
  telefone: string | null;
  telefone_normalizado: string | null;
  email: string | null;
  empreendimento: string | null;
  origem: string | null;
  campanha: string | null;
  tags: string[] | null;
  stage_id: string;
  created_at: string;
  updated_at: string;
  corretor_id: string | null;
}

/* ─── Fetch batches ─── */
export function useCampaignBatches() {
  return useQuery({
    queryKey: ["wa-campaign-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_campaign_batches" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as CampaignBatch[];
    },
    refetchInterval: 5000, // poll while dispatching
  });
}

/* ─── Fetch sends for a batch ─── */
export function useCampaignSends(batchId: string | null) {
  return useQuery({
    queryKey: ["wa-campaign-sends", batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await supabase
        .from("whatsapp_campaign_sends" as any)
        .select("*")
        .eq("batch_id", batchId)
        .neq("status_envio", "pending")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as CampaignSend[];
    },
    enabled: !!batchId,
    refetchInterval: 5000,
  });
}

/* ─── Live count of sends by status ─── */
export interface BatchCounts {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  clicked: number;
  aproveitado: number;
  failed: number;
  pending: number;
  skipped: number;
}

export function useCampaignSendCounts(batchId: string | null) {
  return useQuery({
    queryKey: ["wa-campaign-send-counts", batchId],
    queryFn: async (): Promise<BatchCounts> => {
      if (!batchId) return { total: 0, sent: 0, delivered: 0, read: 0, replied: 0, clicked: 0, aproveitado: 0, failed: 0, pending: 0, skipped: 0 };
      
      const statuses = ["sent", "delivered", "read", "replied", "clicked", "aproveitado", "failed", "pending", "skipped"] as const;
      const counts: Record<string, number> = {};
      let total = 0;

      await Promise.all(
        statuses.map(async (status) => {
          const { count, error } = await supabase
            .from("whatsapp_campaign_sends" as any)
            .select("id", { count: "exact", head: true })
            .eq("batch_id", batchId)
            .eq("status_envio", status);
          counts[status] = error ? 0 : (count || 0);
          total += counts[status];
        })
      );

      return {
        total,
        sent: counts.sent || 0,
        delivered: counts.delivered || 0,
        read: counts.read || 0,
        replied: counts.replied || 0,
        clicked: counts.clicked || 0,
        aproveitado: counts.aproveitado || 0,
        failed: counts.failed || 0,
        pending: counts.pending || 0,
        skipped: counts.skipped || 0,
      };
    },
    enabled: !!batchId,
    refetchInterval: 5000,
  });
}

/* ─── Fetch eligible leads (pipeline) ─── */
export function useFetchEligibleLeads() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (filters: {
      ofertaId?: string;
      campanha?: string;
      empreendimento?: string;
      periodosDias?: number;
      limite?: number;
      stageId?: string;
      origem?: string;
      tag?: string;
    }) => {
      let query = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, telefone_normalizado, email, empreendimento, origem, campanha, tags, stage_id, created_at, updated_at, corretor_id")
        .not("telefone_normalizado", "is", null)
        .is("motivo_descarte", null)
        .order("created_at", { ascending: false });

      if (filters.empreendimento) {
        query = query.eq("empreendimento", filters.empreendimento);
      }
      if (filters.campanha) {
        query = query.eq("campanha", filters.campanha);
      }
      if (filters.stageId) {
        query = query.eq("stage_id", filters.stageId);
      }
      if (filters.origem) {
        query = query.eq("origem", filters.origem);
      }
      if (filters.tag) {
        query = query.contains("tags", [filters.tag]);
      }
      if (filters.periodosDias) {
        const since = new Date();
        since.setDate(since.getDate() - filters.periodosDias);
        query = query.gte("created_at", since.toISOString());
      }

      const limite = filters.limite || 3000;
      query = query.limit(limite);

      const { data, error } = await query;
      if (error) throw error;

      // Deduplicate by telefone_normalizado
      const seen = new Set<string>();
      const unique = (data || []).filter((l: any) => {
        if (!l.telefone_normalizado) return false;
        if (seen.has(l.telefone_normalizado)) return false;
        seen.add(l.telefone_normalizado);
        return true;
      });

      return unique as EligibleLead[];
    },
  });
}

/* ─── Fetch eligible leads from Oferta Ativa (NOT in pipeline) ─── */
export function useFetchOAEligibleLeads() {
  return useMutation({
    mutationFn: async (filters: {
      listaIds: string[];
      limite?: number;
    }) => {
      if (!filters.listaIds.length) return [];

      // 1. Fetch OA leads from selected lists with phone
      const limite = filters.limite || 3000;
      let allOALeads: any[] = [];

      for (const listaId of filters.listaIds) {
        const { data, error } = await supabase
          .from("oferta_ativa_leads")
          .select("id, nome, telefone, telefone2, email, telefone_normalizado, empreendimento, campanha, origem, lista_id, status, created_at, updated_at")
          .eq("lista_id", listaId)
          .not("telefone_normalizado", "is", null)
          .in("status", ["na_fila", "em_cooldown", "aproveitado"])
          .order("created_at", { ascending: false })
          .limit(limite);
        if (error) throw error;
        if (data) allOALeads.push(...data);
      }

      // 2. Collect all normalized phones from OA leads
      const oaPhones = [...new Set(allOALeads.map((l: any) => l.telefone_normalizado).filter(Boolean))];
      if (oaPhones.length === 0) return [];

      // 3. Check which phones already exist in pipeline_leads (batch of 500)
      const existingPhones = new Set<string>();
      for (let i = 0; i < oaPhones.length; i += 500) {
        const batch = oaPhones.slice(i, i + 500);
        const { data: pipelineMatches } = await supabase
          .from("pipeline_leads")
          .select("telefone_normalizado")
          .in("telefone_normalizado", batch);
        if (pipelineMatches) {
          for (const m of pipelineMatches) {
            if (m.telefone_normalizado) existingPhones.add(m.telefone_normalizado);
          }
        }
      }

      // 4. Filter: only leads NOT in pipeline
      const seen = new Set<string>();
      const unique = allOALeads.filter((l: any) => {
        if (!l.telefone_normalizado) return false;
        if (existingPhones.has(l.telefone_normalizado)) return false;
        if (seen.has(l.telefone_normalizado)) return false;
        seen.add(l.telefone_normalizado);
        return true;
      });

      // 5. Map to EligibleLead shape
      return unique.slice(0, limite).map((l: any) => ({
        id: l.id,
        nome: l.nome || "Sem nome",
        telefone: l.telefone || null,
        telefone_normalizado: l.telefone_normalizado,
        email: l.email || null,
        empreendimento: l.empreendimento || null,
        origem: l.origem || "oferta_ativa",
        campanha: l.campanha || null,
        tags: null,
        stage_id: "",
        created_at: l.created_at,
        updated_at: l.updated_at,
        corretor_id: null,
      })) as EligibleLead[];
    },
  });
}

/* ─── Create batch ─── */
export function useCreateCampaignBatch() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      nome: string;
      ofertaId?: string;
      ofertaNome?: string;
      campanha?: string;
      templateName: string;
      templateLanguage?: string;
      templateParams?: any;
      redirectUrl?: string;
      filtros?: any;
      batchSize?: number;
      intervalSeconds?: number;
      leads: EligibleLead[];
    }) => {
      // Create batch record
      const { data: batch, error: batchErr } = await supabase
        .from("whatsapp_campaign_batches" as any)
        .insert({
          nome: params.nome,
          oferta_id: params.ofertaId || null,
          oferta_nome: params.ofertaNome || null,
          campanha: params.campanha || null,
          template_name: params.templateName,
          template_language: params.templateLanguage || "pt_BR",
          template_params: params.templateParams || {},
          redirect_url: params.redirectUrl || null,
          filtros: params.filtros || {},
          total_leads: params.leads.length,
          batch_size: params.batchSize || 500,
          interval_seconds: params.intervalSeconds || 10,
          status: "draft",
          dispatched_by: user!.id,
        } as any)
        .select()
        .single();

      if (batchErr) throw batchErr;

      // Create send records
      const sendRows = params.leads.map((l) => ({
        batch_id: (batch as any).id,
        pipeline_lead_id: l.stage_id ? l.id : null, // OA leads have stage_id="" → no FK
        telefone: l.telefone,
        telefone_normalizado: l.telefone_normalizado,
        nome: l.nome,
        email: l.email,
        template_name: params.templateName,
        origem: "whatsapp_api",
        campanha: params.campanha || null,
        status_envio: "pending",
      }));

      // Insert in chunks of 500
      for (let i = 0; i < sendRows.length; i += 500) {
        const chunk = sendRows.slice(i, i + 500);
        const { error: insertErr } = await supabase
          .from("whatsapp_campaign_sends" as any)
          .insert(chunk as any);
        if (insertErr) throw insertErr;
      }

      return batch as unknown as CampaignBatch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-campaign-batches"] });
      toast.success("Campanha criada com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao criar campanha: " + err.message);
    },
  });
}

/* ─── Dispatch batch (single call) ─── */
export function useDispatchBatch() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { batchId: string; action?: string; sendIds?: string[] }) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-campaign-dispatch", {
        body: {
          action: params.action || "dispatch",
          batch_id: params.batchId,
          send_ids: params.sendIds,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["wa-campaign-batches"] });
      qc.invalidateQueries({ queryKey: ["wa-campaign-sends"] });
      if (data?.test) {
        toast.success(`Teste enviado: ${data.sent} mensagens`);
      } else if (data?.completed) {
        toast.success("Lote concluído!");
      } else {
        toast.success(`Processado: ${data?.processed || 0} enviados, ${data?.failed || 0} falhas`);
      }
    },
    onError: (err: any) => {
      toast.error("Erro no disparo: " + err.message);
    },
  });
}

/* ─── Dispatch batch with auto-loop (calls repeatedly until done) ─── */
export function useDispatchBatchLoop() {
  const qc = useQueryClient();
  const [loopRunning, setLoopRunning] = useState(false);
  const abortRef = useRef(false);

  const stop = () => { abortRef.current = true; };

  const start = async (batchId: string) => {
    if (loopRunning) return;
    setLoopRunning(true);
    abortRef.current = false;
    let totalProcessed = 0;
    let totalFailed = 0;
    let round = 0;

    try {
      while (!abortRef.current) {
        round++;
        console.log(`[dispatch-loop] round ${round}, batchId=${batchId}`);

        const { data, error } = await supabase.functions.invoke("whatsapp-campaign-dispatch", {
          body: { action: "dispatch", batch_id: batchId },
        });

        if (error) {
          console.error("[dispatch-loop] error:", error);
          toast.error("Erro no disparo: " + error.message);
          break;
        }

        if (data?.stopped) {
          toast.info(`Disparo ${data.reason === "paused" ? "pausado" : "cancelado"}`);
          break;
        }

        if (data?.completed) {
          toast.success(`Disparo concluído! Total: ${totalProcessed} enviados, ${totalFailed} falhas`);
          break;
        }

        totalProcessed += data?.processed || 0;
        totalFailed += data?.failed || 0;

        // Refresh UI counts
        qc.invalidateQueries({ queryKey: ["wa-campaign-batches"] });
        qc.invalidateQueries({ queryKey: ["wa-campaign-sends"] });
        qc.invalidateQueries({ queryKey: ["wa-send-counts"] });

        // Small pause between rounds
        await new Promise((r) => setTimeout(r, 2000));
      }
    } finally {
      setLoopRunning(false);
      qc.invalidateQueries({ queryKey: ["wa-campaign-batches"] });
      qc.invalidateQueries({ queryKey: ["wa-campaign-sends"] });
      qc.invalidateQueries({ queryKey: ["wa-send-counts"] });
    }
  };

  return { start, stop, loopRunning };
}

/* ─── Update batch status ─── */
export function useUpdateBatchStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ batchId, status }: { batchId: string; status: string }) => {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (status === "paused") updateData.paused_at = new Date().toISOString();

      const { error } = await supabase
        .from("whatsapp_campaign_batches" as any)
        .update(updateData)
        .eq("id", batchId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-campaign-batches"] });
    },
  });
}
