import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayBRT } from "@/lib/brtTime";

export type LiaStatus = "novo" | "em_conversa" | "qualificado" | "descartado" | "opt_out";

export interface LiaEstado {
  telefone: string;
  nome: string | null;
  status: string | null;
  nivel: string | null;
  qualificado_em: string | null;
  descartado_em: string | null;
  motivo: string | null;
  last_user_at: string | null;
  last_msg_em: string | null;
  followup_count: number | null;
  referral: any;
  lead_id: string | null;
  optout: boolean | null;
}

export interface LiaConversa {
  telefone: string;
  role: string;
  conteudo: string | null;
  created_at: string;
}

export interface LiaFollowup {
  id: string;
  telefone: string | null;
  lead_id: string | null;
  template_key: string | null;
  mensagem: string | null;
  motivo: string | null;
  dentro_24h: boolean | null;
  tentativa: number | null;
  status: string | null;
  agendado_para: string | null;
  enviado_em: string | null;
  created_at: string;
}

export interface LiaTemplate {
  key: string;
  nome: string | null;
  descricao: string | null;
  corpo: string | null;
  dentro_24h: boolean | null;
  ativo: boolean | null;
}

export interface LiaPipelineLead {
  id: string;
  nome: string | null;
  telefone: string | null;
  temperatura: string | null;
  tags: string[] | null;
  corretor_id: string | null;
  aceite_status: string | null;
  stage_id: string | null;
  created_at: string;
}

/** Início do dia BRT em ISO (com offset -03:00). */
export function inicioDoDiaBRT(): string {
  return `${todayBRT()}T00:00:00-03:00`;
}

export function origemDoReferral(referral: any): string {
  if (!referral || typeof referral !== "object") return "Direto";
  return (
    referral.headline ||
    referral.source_id ||
    referral.source_url ||
    "Direto"
  );
}

export function useLiaEstados() {
  return useQuery({
    queryKey: ["lia-hub", "estados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lia_estado")
        .select(
          "telefone,nome,status,nivel,qualificado_em,descartado_em,motivo,last_user_at,last_msg_em,followup_count,referral,lead_id,optout"
        )
        .order("last_msg_em", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as LiaEstado[];
    },
    staleTime: 30_000,
  });
}

/** Últimas mensagens (para preview de "última mensagem" na tabela). */
export function useLiaUltimasMensagens() {
  return useQuery({
    queryKey: ["lia-hub", "ultimas-mensagens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lia_conversas")
        .select("telefone,role,conteudo,created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const map = new Map<string, LiaConversa>();
      for (const row of (data ?? []) as LiaConversa[]) {
        if (!map.has(row.telefone)) map.set(row.telefone, row);
      }
      return map;
    },
    staleTime: 30_000,
  });
}

/** Conversas do dia (BRT) para KPIs. */
export function useLiaConversasHoje() {
  return useQuery({
    queryKey: ["lia-hub", "conversas-hoje"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lia_conversas")
        .select("telefone,role,created_at")
        .gte("created_at", inicioDoDiaBRT())
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Pick<LiaConversa, "telefone" | "role" | "created_at">[];
    },
    staleTime: 30_000,
  });
}

export function useLiaConversa(telefone: string | null) {
  return useQuery({
    queryKey: ["lia-hub", "conversa", telefone],
    enabled: !!telefone,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lia_conversas")
        .select("telefone,role,conteudo,created_at")
        .eq("telefone", telefone!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as LiaConversa[];
    },
  });
}

export function useLiaFollowups() {
  return useQuery({
    queryKey: ["lia-hub", "followups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lia_followups")
        .select(
          "id,telefone,lead_id,template_key,mensagem,motivo,dentro_24h,tentativa,status,agendado_para,enviado_em,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as LiaFollowup[];
    },
    staleTime: 30_000,
  });
}

export function useLiaTemplates() {
  return useQuery({
    queryKey: ["lia-hub", "templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lia_templates")
        .select("key,nome,descricao,corpo,dentro_24h,ativo")
        .eq("ativo", true)
        .order("key");
      if (error) throw error;
      return (data ?? []) as LiaTemplate[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Leads do pipeline originados pela LIA (+ corretor e stage resolvidos). */
export function useLiaPipelineLeads() {
  return useQuery({
    queryKey: ["lia-hub", "pipeline-leads"],
    queryFn: async () => {
      const [leadsRes, stagesRes] = await Promise.all([
        supabase
          .from("pipeline_leads")
          .select("id,nome,telefone,temperatura,tags,corretor_id,aceite_status,stage_id,created_at")
          .eq("origem", "LIA")
          .limit(1000),
        supabase.from("pipeline_stages").select("id,nome,tipo,ordem"),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      if (stagesRes.error) throw stagesRes.error;

      const leads = (leadsRes.data ?? []) as LiaPipelineLead[];
      const corretorIds = Array.from(
        new Set(leads.map((l) => l.corretor_id).filter(Boolean) as string[])
      );

      let corretores = new Map<string, string>();
      if (corretorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,nome")
          .in("id", corretorIds);
        corretores = new Map((profs ?? []).map((p: any) => [p.id, p.nome as string]));
      }

      const stages = new Map<string, { nome: string; tipo: string; ordem: number }>(
        (stagesRes.data ?? []).map((s: any) => [
          s.id as string,
          { nome: s.nome as string, tipo: s.tipo as string, ordem: s.ordem as number },
        ])
      );

      return { leads, corretores, stages };
    },
    staleTime: 60_000,
  });
}

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-primary/10 text-primary border-primary/20" },
  em_conversa: { label: "Em conversa", cls: "bg-warning/10 text-warning border-warning/20" },
  qualificado: { label: "Qualificado", cls: "bg-success/10 text-success border-success/20" },
  descartado: { label: "Descartado", cls: "bg-muted text-muted-foreground border-border" },
  opt_out: { label: "Opt-out", cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

export const NIVEL_META: Record<string, { emoji: string; label: string; cls: string; dot: string }> = {
  quente: {
    emoji: "🔥",
    label: "Quente",
    cls: "bg-red-500/10 text-red-600 border-red-500/20",
    dot: "bg-red-500",
  },
  morno: {
    emoji: "🟡",
    label: "Morno",
    cls: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    dot: "bg-amber-500",
  },
  frio: {
    emoji: "🧊",
    label: "Frio",
    cls: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    dot: "bg-blue-500",
  },
};

export const NIVEIS: Array<keyof typeof NIVEL_META | string> = ["quente", "morno", "frio"];
