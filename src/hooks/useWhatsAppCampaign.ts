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
        .order("created_at")
        .limit(1000);
      if (error) throw error;
      return (data || []) as unknown as CampaignSend[];
    },
    enabled: !!batchId,
    refetchInterval: 5000,
  });
}

/* ─── Fetch eligible leads ─── */
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
        .not("motivo_descarte", "is", null) // only non-discarded — will invert below
        .order("created_at", { ascending: false });

      // Actually we want leads WITHOUT motivo_descarte
      query = supabase
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
        pipeline_lead_id: l.id,
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

/* ─── Dispatch batch ─── */
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
