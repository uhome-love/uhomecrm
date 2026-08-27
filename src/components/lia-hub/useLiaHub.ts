import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayBRT } from "@/lib/brtTime";
import { toast } from "sonner";

/**
 * AO VIVO SEM POLLING: em vez de ficar refazendo a busca a cada X segundos (aquele
 * "refresh interminável" que incomoda), assina o Realtime do Supabase e só atualiza
 * quando ALGO muda de verdade (mensagem nova, status, follow-up). O refresh é em
 * segundo plano (React Query mantém os dados na tela), então não pisca nem trava.
 * Uma rajada de eventos vira UM refresh só (debounce). Monte uma vez no LiaHub.
 */
export function useLiaRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) return; // já tem um refresh agendado nessa rajada
      timer = setTimeout(() => {
        timer = null;
        qc.invalidateQueries({ queryKey: ["lia-hub"] });
      }, 800);
    };
    const ch = supabase
      .channel("lia-hub-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "lia_estado" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "lia_conversas" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "lia_followups" }, bump)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [qc]);
}

export type LiaStatus = "novo" | "em_conversa" | "qualificado" | "descartado" | "opt_out";

// A LIA separa mensagens por "|||" (cada pedaço é uma mensagem no WhatsApp) e usa marcadores
// internos ([[midia:x]], [[nome:x]], [[sinal]], [[repassar]]) que o cliente NUNCA vê. No hub, isso
// tudo aparecia cru. Estas funções limpam pra exibição: partem em pedaços e escondem os marcadores.
export function partirMensagem(txt?: string | null): string[] {
  if (!txt) return [];
  return String(txt)
    .split("|||")
    .map((p) => p.trim())
    .map((p) => {
      const mid = p.match(/^\[\[\s*midia\s*:\s*(\w+)\s*\]\]$/i);
      if (mid) return `📎 enviou ${mid[1]}`;
      if (/^\[\[.*\]\]$/.test(p)) return ""; // marcador interno (sinal/nome/repassar): não mostra
      return p.replace(/\[\[\s*nome\s*:[^\]]*\]\]/gi, "").trim();
    })
    .filter(Boolean);
}
export function previewMensagem(txt?: string | null): string {
  const ps = partirMensagem(txt);
  return ps.length ? ps[ps.length - 1] : "";
}

export interface LiaEstado {
  telefone: string;
  nome: string | null;
  status: string | null;
  nivel: string | null;
  qualificado_em: string | null;
  descartado_em: string | null;
  motivo: string | null;
  repassado_em: string | null;
  reengajado_em: string | null;
  last_user_at: string | null;
  last_msg_em: string | null;
  followup_count: number | null;
  referral: any;
  lead_id: string | null;
  optout: boolean | null;
  agendou: boolean | null;
  agendamento: string | null;
  agendou_em: string | null;
  produto_slug: string | null;
  created_at: string | null;
}

/** Rótulo curto e legível de cada produto (imóvel) da LIA. Fallback = o próprio slug. */
export const PRODUTO_LABEL: Record<string, string> = {
  "casa-tua-canoas": "Casa Tua Canoas",
  "casa-tua-porto-alegre": "Casa Tua POA",
  "connect-joao-wallig": "Connect JW",
  "awa-wellness": "AWA",
};
export const produtoLabel = (slug?: string | null) =>
  slug ? (PRODUTO_LABEL[slug] ?? slug) : "Sem produto";

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
  arquivado: boolean | null;
}

/** Início do dia BRT em ISO (com offset -03:00). */
export function inicioDoDiaBRT(): string {
  return `${todayBRT()}T00:00:00-03:00`;
}

export function origemDoReferral(referral: any): string {
  if (!referral || typeof referral !== "object") return "Direto";
  // NUNCA mostrar o id cru da campanha/anúncio (número gigante feio). Rótulo amigável.
  if (referral.headline) return referral.headline;
  if (referral.source_type === "form_lead") return "Anúncio (formulário)";
  if (referral.source_type === "ad" || referral.campaign_id || referral.source_id || referral.ad_id) return "Anúncio";
  if (referral.source_url) return "Site";
  return "Direto";
}

export function useLiaEstados() {
  return useQuery({
    queryKey: ["lia-hub", "estados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lia_estado")
        .select(
          "telefone,nome,status,nivel,qualificado_em,descartado_em,motivo,repassado_em,reengajado_em,last_user_at,last_msg_em,followup_count,referral,lead_id,optout,agendou,agendamento,agendou_em,produto_slug,created_at"
        )
        .order("last_msg_em", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as LiaEstado[];
    },
    staleTime: 30_000,
    // sem polling: o ao vivo vem do Realtime (useLiaRealtime). Refaz só ao voltar pra aba.
    refetchOnWindowFocus: true,
  });
}

/** Lista de slugs de imóvel presentes na base (para montar o FiltroImovel). */
export function produtosDeEstados(estados?: { produto_slug?: string | null }[] | null): string[] {
  const set = new Set<string>();
  for (const e of estados ?? []) if (e.produto_slug) set.add(e.produto_slug);
  return Array.from(set).sort();
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
      // Leads que a LIA está LINKADA (qualquer origem: LIA, ig, fb…). Não filtra por origem="LIA",
      // senão perde o lead que já era do corretor (veio do Instagram) e a LIA atendeu depois.
      const { data: links } = await supabase.from("lia_estado").select("lead_id").not("lead_id", "is", null);
      const linkedIds = Array.from(new Set((links ?? []).map((r: any) => r.lead_id).filter(Boolean))) as string[];

      const [leadsRes, stagesRes] = await Promise.all([
        linkedIds.length
          ? supabase
              .from("pipeline_leads")
              .select("id,nome,telefone,temperatura,tags,corretor_id,aceite_status,stage_id,created_at,arquivado")
              .in("id", linkedIds)
              .limit(1000)
          : Promise.resolve({ data: [] as any[], error: null } as any),
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
        // corretor_id do pipeline === profiles.user_id (o id de auth), NÃO profiles.id
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,nome")
          .in("user_id", corretorIds);
        corretores = new Map((profs ?? []).map((p: any) => [p.user_id as string, p.nome as string]));
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

export interface LiaCusto {
  ok: boolean;
  investimento: number;
  anuncios?: number;
  anuncios_com_gasto?: number;
  motivo?: string;
  atualizado_em?: string;
}

/** Investimento real dos anúncios que trouxeram os leads da LIA (via edge function lia-custo). */
export function useLiaCusto() {
  return useQuery({
    queryKey: ["lia-hub", "custo"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("lia-custo");
      if (error) throw error;
      return data as LiaCusto;
    },
    staleTime: 10 * 60_000,
  });
}

/** Motivos fixos de descarte manual pelo hub (o operador escolhe um). */
export const MOTIVOS_DESCARTE = [
  "Não respondeu (sumiu após follow-ups)",
  "Fora de perfil (não serve pro produto)",
  "Sem interesse real",
  "Número inválido / não é WhatsApp",
  "Duplicado",
] as const;

/** Descarta manualmente um lead da LIA que NÃO foi qualificado: marca o estado como
 * descartado com motivo (some da fila ativa) e cancela os follow-ups em aberto pra
 * parar a cadência. Reversível (ver useReativarLead). Só admin/diretor (RLS). */
export function useDescartarLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ telefone, motivo }: { telefone: string; motivo: string }) => {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from("lia_estado")
        .update({ status: "descartado", descartado_em: agora, motivo, updated_at: agora })
        .eq("telefone", telefone);
      if (error) throw error;
      // para a linha de follow-up: cancela o que estava pendente/aprovado pra este contato
      await supabase
        .from("lia_followups")
        .update({ status: "cancelado", updated_at: agora })
        .eq("telefone", telefone)
        .in("status", ["pendente", "aprovado"]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lia-hub"] }),
  });
}

/** Desfaz o descarte: volta o lead pra "em conversa" e limpa o motivo. Reversível. */
export function useReativarLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ telefone }: { telefone: string }) => {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from("lia_estado")
        .update({ status: "em_conversa", descartado_em: null, motivo: null, updated_at: agora })
        .eq("telefone", telefone);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lia-hub"] }),
  });
}

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-primary/10 text-primary border-primary/20" },
  em_conversa: { label: "Em conversa", cls: "bg-warning/10 text-warning border-warning/20" },
  qualificado: { label: "Qualificado", cls: "bg-success/10 text-success border-success/20" },
  descartado: { label: "Descartado", cls: "bg-muted text-muted-foreground border-border" },
  opt_out: { label: "Opt-out", cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

/** Meta de status do lead considerando o MOTIVO: quem foi devolvido pro corretor recebe uma flag
 * própria "🤝 Com corretor" (verde), em vez de "Descartado" genérico. */
export function statusMetaLead(e: { status?: string | null; motivo?: string | null }): { label: string; cls: string } {
  if (e.status === "descartado" && (e.motivo ?? "").toLowerCase().includes("corretor")) {
    return { label: "🤝 Com corretor", cls: "bg-success/10 text-success border-success/20" };
  }
  return STATUS_META[e.status ?? ""] ?? { label: e.status ?? "—", cls: "bg-muted text-muted-foreground border-border" };
}

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

/**
 * Descarta ou inativa um contato dentro da caixa isolada da LIA.
 * Não altera `pipeline_leads` — o lead do CRM segue como está.
 */
export function useLiaDescartar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      telefone: string;
      tipo: "reengajavel" | "definitivo";
      motivo: string;
    }) => {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("lia_estado")
        .update({
          status: "descartado",
          descartado_em: nowIso,
          motivo: p.motivo,
          ...(p.tipo === "definitivo" ? { optout: true } : {}),
        })
        .eq("telefone", p.telefone);
      if (error) throw error;

      if (p.tipo === "definitivo") {
        const { error: errFu } = await supabase
          .from("lia_followups")
          .update({ status: "cancelado" })
          .eq("telefone", p.telefone)
          .eq("status", "pendente");
        if (errFu) throw errFu;
      }
    },
    onSuccess: (_d, p) => {
      toast.success(p.tipo === "definitivo" ? "Contato inativado" : "Contato descartado");
      qc.invalidateQueries({ queryKey: ["lia-hub"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível descartar"),
  });
}

/** Exclusão definitiva dos dados da LIA daquele telefone (apenas CEO/admin). */
export function useLiaExcluir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (telefone: string) => {
      const fu = await supabase.from("lia_followups").delete().eq("telefone", telefone);
      if (fu.error) throw fu.error;
      const cv = await supabase.from("lia_conversas").delete().eq("telefone", telefone);
      if (cv.error) throw cv.error;
      const st = await supabase.from("lia_estado").delete().eq("telefone", telefone);
      if (st.error) throw st.error;
    },
    onSuccess: () => {
      toast.success("Contato excluído da LIA");
      qc.invalidateQueries({ queryKey: ["lia-hub"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível excluir"),
  });
}
