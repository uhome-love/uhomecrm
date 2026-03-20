import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface EmailTemplate {
  id: string;
  nome: string;
  assunto: string;
  html_content: string;
  text_content: string | null;
  categoria: string;
  placeholders: string[];
  ativo: boolean;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaign {
  id: string;
  nome: string;
  assunto: string;
  remetente: string | null;
  preview_text: string | null;
  template_id: string | null;
  html_content: string | null;
  text_content: string | null;
  filtros: Record<string, any>;
  status: string;
  agendado_para: string | null;
  criado_por: string;
  total_destinatarios: number;
  total_enviados: number;
  total_entregues: number;
  total_aberturas: number;
  total_cliques: number;
  total_bounces: number;
  total_unsubscribes: number;
  total_erros: number;
  created_at: string;
  updated_at: string;
}

export interface EmailSettings {
  [key: string]: string;
}

export function useEmailSettings() {
  const [settings, setSettings] = useState<EmailSettings>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("email_settings").select("key, value") as any;
    const s: EmailSettings = {};
    (data || []).forEach((r: any) => { s[r.key] = r.value || ""; });
    setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateSetting = useCallback(async (key: string, value: string) => {
    const { error } = await supabase
      .from("email_settings")
      .update({ value, updated_at: new Date().toISOString() } as any)
      .eq("key", key) as any;
    if (error) toast.error("Erro ao salvar");
    else {
      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success("Configuração salva");
    }
  }, []);

  return { settings, loading, updateSetting, reload: load };
}

export function useEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false }) as any;
    setTemplates((data || []) as EmailTemplate[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createTemplate = useCallback(async (tpl: Partial<EmailTemplate>) => {
    const { error } = await supabase.from("email_templates").insert(tpl as any) as any;
    if (error) { toast.error("Erro ao criar template"); return false; }
    toast.success("Template criado");
    load();
    return true;
  }, [load]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<EmailTemplate>) => {
    const { error } = await supabase
      .from("email_templates")
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq("id", id) as any;
    if (error) { toast.error("Erro ao atualizar"); return false; }
    toast.success("Template atualizado");
    load();
    return true;
  }, [load]);

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase.from("email_templates").delete().eq("id", id) as any;
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Template excluído"); load(); }
  }, [load]);

  return { templates, loading, createTemplate, updateTemplate, deleteTemplate, reload: load };
}

export function useEmailCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("email_campaigns")
      .select("*")
      .order("created_at", { ascending: false }) as any;
    setCampaigns((data || []) as EmailCampaign[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-poll every 5s when any campaign is actively sending
  useEffect(() => {
    const hasSending = campaigns.some(c => c.status === "enviando");
    if (!hasSending) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [campaigns, load]);

  const createCampaign = useCallback(async (c: Partial<EmailCampaign>) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("email_campaigns")
      .insert({ ...c, criado_por: user.id } as any)
      .select()
      .single() as any;
    if (error) { toast.error("Erro ao criar campanha"); return null; }
    toast.success("Campanha criada");
    load();
    return data;
  }, [user, load]);

  const updateCampaign = useCallback(async (id: string, updates: Partial<EmailCampaign>) => {
    const { error } = await supabase
      .from("email_campaigns")
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq("id", id) as any;
    if (error) { toast.error("Erro ao atualizar"); return false; }
    load();
    return true;
  }, [load]);

  const deleteCampaign = useCallback(async (id: string) => {
    const { error } = await supabase.from("email_campaigns").delete().eq("id", id) as any;
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Campanha excluída"); load(); }
  }, [load]);

  const sendCampaign = useCallback(async (campaignId: string) => {
    const { data, error } = await supabase.functions.invoke("mailgun-send", {
      body: { mode: "campaign", campaign_id: campaignId },
    });
    if (error) { toast.error("Erro ao disparar campanha"); return false; }
    if (data?.error) { toast.error(data.error); return false; }
    toast.success(data?.status === "enviada"
      ? `Campanha concluída: ${data.enviados} emails processados`
      : `Campanha iniciada: ${data?.enviados || 0} emails processados e envio contínuo ativo`);
    load();
    return true;
  }, [load]);

  return { campaigns, loading, createCampaign, updateCampaign, deleteCampaign, sendCampaign, reload: load };
}
