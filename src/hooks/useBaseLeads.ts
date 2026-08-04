/**
 * useBaseLeads — Base Única de Leads (CEO)
 *
 * Fonte: public.base_leads (histórico HubSpot + Oferta Ativa absorvida).
 * Só admin/diretor/gestor enxergam (RLS).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BaseLeadsFiltro {
  empreendimento_canonico_id?: string | null;
  ano_min?: number | null;
  ano_max?: number | null;
  situacao?: string | null;
  nunca_trabalhado?: boolean;
  com_telefone?: boolean;
  busca?: string | null;
  /** Higiene: permitir descartes reengajáveis antigos (padrão true). */
  incluir_descartados?: boolean;
  /** Só descartes com mais de N dias entram (padrão 90). */
  descarte_min_dias?: number;
}

export interface BaseLeadRow {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  telefone: string | null;
  email: string | null;
  ultima_conversao_em: string | null;
  ultimo_formulario: string | null;
  empreendimento_texto: string | null;
  empreendimento_canonico_id: string | null;
  situacao_crm: string;
  vezes_trabalhado: number;
  total_conversoes: number;
  opt_out: boolean;
}

const PAGE_SIZE = 50;

function applyFiltro(q: any, f: BaseLeadsFiltro) {
  if (f.empreendimento_canonico_id) q = q.eq("empreendimento_canonico_id", f.empreendimento_canonico_id);
  if (f.situacao) q = q.eq("situacao_crm", f.situacao);
  if (f.nunca_trabalhado) q = q.eq("vezes_trabalhado", 0);
  if (f.com_telefone) q = q.not("telefone_key", "is", null);
  if (f.ano_min) q = q.gte("ultima_conversao_em", `${f.ano_min}-01-01`);
  if (f.ano_max) q = q.lte("ultima_conversao_em", `${f.ano_max}-12-31`);
  if (f.busca?.trim()) {
    const t = f.busca.trim().replace(/[%,]/g, "");
    q = q.or(`nome.ilike.%${t}%,email.ilike.%${t}%,telefone.ilike.%${t}%`);
  }
  return q;
}

/** Lista paginada da base. */
export function useBaseLeads(filtro: BaseLeadsFiltro, page = 0) {
  return useQuery({
    queryKey: ["base-leads", filtro, page],
    queryFn: async () => {
      let q = supabase
        .from("base_leads")
        .select(
          "id,nome,sobrenome,telefone,email,ultima_conversao_em,ultimo_formulario,empreendimento_texto,empreendimento_canonico_id,situacao_crm,vezes_trabalhado,total_conversoes,opt_out",
          { count: "exact" },
        )
        .order("ultima_conversao_em", { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      q = applyFiltro(q, filtro);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as BaseLeadRow[], total: count ?? 0, pageSize: PAGE_SIZE };
    },
    staleTime: 60_000,
  });
}

/** KPIs da base (por situação). */
export function useBaseLeadsResumo() {
  return useQuery({
    queryKey: ["base-leads-resumo"],
    queryFn: async () => {
      const situacoes = ["inedito", "na_oferta_ativa", "no_pipeline", "ambos"] as const;
      const results = await Promise.all(
        situacoes.map(async (s) => {
          const { count } = await supabase
            .from("base_leads")
            .select("id", { count: "exact", head: true })
            .eq("situacao_crm", s);
          return [s, count ?? 0] as const;
        }),
      );
      const { count: total } = await supabase.from("base_leads").select("id", { count: "exact", head: true });
      const { count: semProduto } = await supabase
        .from("base_leads")
        .select("id", { count: "exact", head: true })
        .is("empreendimento_canonico_id", null);
      // Já passou por alguma campanha de Oferta Ativa (histórico), mesmo que hoje não esteja em nenhuma
      const { count: trabalhadoAntes } = await supabase
        .from("base_leads")
        .select("id", { count: "exact", head: true })
        .not("oferta_ativa_lead_id", "is", null);
      return {
        total: total ?? 0,
        semProduto: semProduto ?? 0,
        trabalhadoAntes: trabalhadoAntes ?? 0,
        ...Object.fromEntries(results),
      } as Record<string, number>;

    },
    staleTime: 5 * 60_000,
  });
}

/** Prévia de quantos leads o filtro devolve. */
export function usePreviewCampanha(filtro: BaseLeadsFiltro, enabled: boolean) {
  return useQuery({
    queryKey: ["base-leads-preview", filtro],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("preview_campanha_da_base", {
        p_filtro: {
          empreendimento_canonico_id: filtro.empreendimento_canonico_id ?? null,
          ano_min: filtro.ano_min ?? null,
          ano_max: filtro.ano_max ?? null,
          situacao: filtro.situacao ?? null,
          nunca_trabalhado: filtro.nunca_trabalhado ?? true,
          com_telefone: filtro.com_telefone ?? true,
        } as never,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    staleTime: 30_000,
  });
}

/** Cria a campanha temporária de Oferta Ativa a partir do filtro. */
export function useCriarCampanhaDaBase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      nome: string;
      filtro: BaseLeadsFiltro;
      expira_em: string;
      limite: number;
      liberar: boolean;
    }) => {
      const { data, error } = await supabase.rpc("criar_campanha_da_base", {
        p_nome: params.nome,
        p_filtro: {
          empreendimento_canonico_id: params.filtro.empreendimento_canonico_id ?? null,
          ano_min: params.filtro.ano_min ?? null,
          ano_max: params.filtro.ano_max ?? null,
          situacao: params.filtro.situacao ?? null,
          nunca_trabalhado: params.filtro.nunca_trabalhado ?? true,
          com_telefone: params.filtro.com_telefone ?? true,
        } as never,
        p_expira_em: params.expira_em,
        p_limite: params.limite,
        p_liberar: params.liberar,
      });
      if (error) throw error;
      return data as { ok: boolean; lista_id: string; total: number };
    },
    onSuccess: (r) => {
      toast.success(`Campanha criada com ${r?.total ?? 0} leads`);
      qc.invalidateQueries({ queryKey: ["base-leads"] });
      qc.invalidateQueries({ queryKey: ["oa-campanhas"] });
      qc.invalidateQueries({ queryKey: ["base-leads-resumo"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao criar campanha"),
  });
}

/** Campanhas (listas) com resultado consolidado. */
export function useCampanhasOA() {
  return useQuery({
    queryKey: ["oa-campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_oa_campanha_resultado")
        .select("*")
        .order("liberada_em", { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

/** Encerra manualmente as campanhas vencidas. */
export function useEncerrarCampanhasExpiradas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("encerrar_campanhas_expiradas");
      if (error) throw error;
      return data as { listas_encerradas: number; leads_devolvidos: number };
    },
    onSuccess: (r) => {
      toast.success(`${r?.listas_encerradas ?? 0} campanha(s) encerrada(s)`);
      qc.invalidateQueries({ queryKey: ["oa-campanhas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Encerra uma campanha específica agora (antecipa o prazo e devolve os leads à base). */
export function useEncerrarCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (listaId: string) => {
      const { error: upErr } = await supabase
        .from("oferta_ativa_listas")
        .update({ expira_em: new Date().toISOString() })
        .eq("id", listaId);
      if (upErr) throw upErr;
      const { data, error } = await supabase.rpc("encerrar_campanhas_expiradas");
      if (error) throw error;
      return data as { listas_encerradas: number; leads_devolvidos: number };
    },
    onSuccess: (r) => {
      toast.success(`Campanha encerrada · ${r?.leads_devolvidos ?? 0} lead(s) devolvido(s) à base`);
      qc.invalidateQueries({ queryKey: ["oa-campanhas"] });
      qc.invalidateQueries({ queryKey: ["base-leads"] });
      qc.invalidateQueries({ queryKey: ["base-leads-resumo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Formulários pendentes de revisão de produto. */
export function useFormMap(pendentes: boolean) {
  return useQuery({
    queryKey: ["base-form-map", pendentes],
    queryFn: async () => {
      let q = supabase
        .from("base_leads_form_map")
        .select("id,formulario,empreendimento_canonico_id,empreendimento_texto,extinto,revisado,total_leads")
        .order("total_leads", { ascending: false })
        .limit(500);
      if (pendentes) q = q.eq("revisado", false);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

/** Salva o mapeamento de um formulário e propaga para os leads da base. */
export function useSalvarFormMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; formulario: string; empreendimento_canonico_id: string | null; extinto: boolean }) => {
      const { error } = await supabase
        .from("base_leads_form_map")
        .update({
          empreendimento_canonico_id: p.empreendimento_canonico_id,
          extinto: p.extinto,
          revisado: true,
        })
        .eq("id", p.id);
      if (error) throw error;

      const { error: e2 } = await supabase
        .from("base_leads")
        .update({
          empreendimento_canonico_id: p.empreendimento_canonico_id,
          produto_extinto: p.extinto,
        })
        .eq("ultimo_formulario", p.formulario);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Produto mapeado");
      qc.invalidateQueries({ queryKey: ["base-form-map"] });
      qc.invalidateQueries({ queryKey: ["base-leads"] });
      qc.invalidateQueries({ queryKey: ["base-leads-resumo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Empreendimentos canônicos ativos (para selects). */
export function useEmpreendimentosCanonicos() {
  return useQuery({
    queryKey: ["empreendimentos-canonicos-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empreendimentos_canonicos")
        .select("id,nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
    staleTime: 30 * 60_000,
  });
}

/* ────────────────────────────────────────────────────────────────
 * Construtor de campanha v2 — filtros múltiplos, ordem, escopo
 * ──────────────────────────────────────────────────────────────── */

export interface CampanhaFiltroV2 {
  empreendimento_ids: string[];
  formularios: string[];
  ano_min: number | null;
  ano_max: number | null;
  situacao: string | null;
  nunca_trabalhado: boolean;
  com_telefone: boolean;
  com_email: boolean;
  ordem_selecao: "recentes" | "antigos" | "aleatorio";
  /** Permitir descartes reengajáveis antigos (padrão true). */
  incluir_descartados: boolean;
  /** Janela mínima do descarte, em dias (padrão 90). */
  descarte_min_dias: number;
}

export interface CampanhaConfigV2 {
  limite: number;
  /** null = prazo indeterminado (campanha sem expiração). */
  expira_em: string | null;
  liberar: boolean;
  observacao: string | null;
  template_id: string | null;
  max_tentativas: number;
  cooldown_dias: number;
  ordem_selecao: "recentes" | "antigos" | "aleatorio";
  escopo: { equipes: string[]; corretores: string[] };
}

export interface PreviewV2 {
  total: number;
  /** Total que bate no filtro antes da higiene automática. */
  bruto: number;
  /** Removidos por já existirem no pipeline (ativos, descartados ou arquivados). */
  removidos_crm: number;
  /** Removidos por terem lead ativo no pipeline. */
  removidos_ativos: number;
  /** Removidos por inativação permanente (descarte definitivo ou arquivado). */
  removidos_inativados: number;
  /** Removidos por descarte dentro da janela mínima. */
  removidos_descarte_recente: number;
  /** Removidos por já estarem numa fila de Oferta Ativa. */
  removidos_oa: number;
  amostra: {
    id: string;
    nome: string | null;
    sobrenome: string | null;
    telefone: string | null;
    email: string | null;
    empreendimento_texto: string | null;
    ultimo_formulario: string | null;
    ultima_conversao_em: string | null;
    situacao_crm: string | null;
  }[];
}

/** Prévia da campanha v2: total + amostra dos 10 primeiros. */
export function usePreviewCampanhaV2(filtro: CampanhaFiltroV2, enabled: boolean) {
  return useQuery({
    queryKey: ["base-leads-preview-v2", filtro],
    enabled,
    queryFn: async (): Promise<PreviewV2> => {
      const { data, error } = await supabase.rpc("preview_campanha_da_base_v2", {
        p_filtro: filtro as never,
      });
      if (error) throw error;
      const r = (data ?? {}) as Partial<PreviewV2>;
      return {
        total: r.total ?? 0,
        bruto: r.bruto ?? r.total ?? 0,
        removidos_crm: r.removidos_crm ?? 0,
        removidos_ativos: r.removidos_ativos ?? 0,
        removidos_inativados: r.removidos_inativados ?? 0,
        removidos_descarte_recente: r.removidos_descarte_recente ?? 0,
        removidos_oa: r.removidos_oa ?? 0,
        amostra: r.amostra ?? [],
      };
    },

    staleTime: 30_000,
  });
}

/** Cria a campanha personalizada. */
export function useCriarCampanhaV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { nome: string; filtro: CampanhaFiltroV2; config: CampanhaConfigV2 }) => {
      const { data, error } = await supabase.rpc("criar_campanha_da_base_v2", {
        p_nome: p.nome,
        p_filtro: p.filtro as never,
        p_config: p.config as never,
      });
      if (error) throw error;
      return data as unknown as { ok: boolean; lista_id: string; total: number };
    },
    onSuccess: (r) => {
      toast.success(`Campanha criada com ${r?.total ?? 0} leads`);
      qc.invalidateQueries({ queryKey: ["base-leads"] });
      qc.invalidateQueries({ queryKey: ["oa-campanhas"] });
      qc.invalidateQueries({ queryKey: ["oa-listas"] });
      qc.invalidateQueries({ queryKey: ["base-leads-resumo"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao criar campanha"),
  });
}

/** Formulários da base (para filtro multi). */
export function useFormulariosBase() {
  return useQuery({
    queryKey: ["base-form-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("base_leads_form_map")
        .select("formulario,total_leads")
        .order("total_leads", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as { formulario: string; total_leads: number }[];
    },
    staleTime: 10 * 60_000,
  });
}

/** Templates de script da Oferta Ativa (para vincular à campanha). */
export function useTemplatesOA() {
  return useQuery({
    queryKey: ["oa-templates-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oferta_ativa_templates")
        .select("id,nome,empreendimento")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; empreendimento: string | null }[];
    },
    staleTime: 10 * 60_000,
  });
}

/** Corretores ativos + equipes (gestores) para o escopo da campanha. */
export function useEscopoOpcoes() {
  return useQuery({
    queryKey: ["oa-escopo-opcoes"],
    queryFn: async () => {
      const [{ data: membros }, { data: perfis }] = await Promise.all([
        supabase.from("team_members").select("user_id,gerente_id").eq("status", "ativo"),
        supabase.from("profiles").select("user_id,nome").order("nome"),
      ]);
      const nomePorUser = new Map<string, string>(
        (perfis ?? []).map((p: { user_id: string; nome: string }) => [p.user_id, p.nome] as [string, string]),
      );

      const gerentes = Array.from(new Set((membros ?? []).map((m: { gerente_id: string }) => m.gerente_id).filter(Boolean)));
      const corretores = Array.from(new Set((membros ?? []).map((m: { user_id: string }) => m.user_id).filter(Boolean)));
      return {
        equipes: gerentes.map((g) => ({ id: g as string, nome: nomePorUser.get(g as string) ?? "Equipe" })),
        corretores: corretores
          .map((c) => ({ id: c as string, nome: nomePorUser.get(c as string) ?? "Corretor" }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      };
    },
    staleTime: 10 * 60_000,
  });
}
