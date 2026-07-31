import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CorretorRow {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  equipe: string | null;
  gerente_id: string | null;
  alocacao: string[];
}

export interface EmpreendimentoCanonico {
  id: string;
  nome: string;
  segmento_id: string | null;
  segmento_nome: string | null;
  ativo: boolean;
}

/** Empreendimentos canônicos com segmento. Default: só ativos. */
export function useEmpreendimentosCanonicos(opts: { includeInactive?: boolean } = {}) {
  const includeInactive = !!opts.includeInactive;
  return useQuery({
    queryKey: ["foco", "empreendimentos-canonicos", includeInactive ? "all" : "ativos"],
    queryFn: async (): Promise<EmpreendimentoCanonico[]> => {
      let q = supabase
        .from("empreendimentos_canonicos")
        .select("id, nome, segmento_id, ativo, roleta_segmentos(nome)")
        .order("nome");
      if (!includeInactive) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        nome: r.nome,
        segmento_id: r.segmento_id,
        segmento_nome: r.roleta_segmentos?.nome ?? null,
        ativo: r.ativo,
      }));
    },
    staleTime: 5 * 60_000,
  });
}

/** Mutation: liga/desliga empreendimento (só CEO/Admin/Diretor). */
export function useSetEmpreendimentoAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; ativo: boolean }) => {
      const { error } = await supabase.rpc("set_empreendimento_ativo", {
        p_empreendimento_id: input.id,
        p_ativo: input.ativo,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.ativo ? "Empreendimento ativado" : "Empreendimento desativado");
      qc.invalidateQueries({ queryKey: ["foco", "empreendimentos-canonicos"] });
      qc.invalidateQueries({ queryKey: ["foco", "empreendimentos-com-leads"] });
    },
    onError: (e: any) => {
      const msg = String(e?.message || e);
      if (msg.toLowerCase().includes("apenas")) toast.error("Apenas CEO/Diretor pode alterar");
      else toast.error("Erro: " + msg);
    },
  });
}

/** Contagem de leads por empreendimento nos últimos N dias (default 30d). */
export function useLeadsPorEmpreendimento(days = 30) {
  return useQuery({
    queryKey: ["foco", "empreendimentos-com-leads", days],
    queryFn: async (): Promise<Record<string, number>> => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("pipeline_leads")
        .select("empreendimento_canonico_id")
        .gte("created_at", since)
        .not("empreendimento_canonico_id", "is", null)
        .limit(20000);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data || []) {
        const k = (r as any).empreendimento_canonico_id as string;
        if (k) map[k] = (map[k] || 0) + 1;
      }
      return map;
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Lista corretores (role='corretor') com equipe e alocação atual.
 * Filtrado por gestor quando `gerenteId` fornecido.
 */
export function useCorretoresComAlocacao(scope: "all" | "gerente", gerenteId?: string) {
  return useQuery({
    queryKey: ["foco", "corretores", scope, gerenteId ?? "all"],
    queryFn: async (): Promise<CorretorRow[]> => {
      // corretores ativos (via user_roles)
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "corretor");
      if (rolesErr) throw rolesErr;
      const ids = Array.from(new Set((roles || []).map((r) => r.user_id).filter(Boolean)));
      if (ids.length === 0) return [];

      const [profRes, teamRes, allocRes] = await Promise.all([
        supabase.from("profiles").select("user_id, nome, avatar_url").in("user_id", ids),
        supabase.from("team_members").select("user_id, equipe, gerente_id, status").in("user_id", ids).eq("status", "ativo"),
        supabase.from("corretor_alocacao").select("user_id, empreendimentos").in("user_id", ids),
      ]);
      if (profRes.error) throw profRes.error;
      if (teamRes.error) throw teamRes.error;
      if (allocRes.error) throw allocRes.error;

      const teamMap = new Map<string, { equipe: string | null; gerente_id: string | null }>();
      for (const t of teamRes.data || []) {
        // se aparecer em mais de um time, prioriza o filtrado ou o primeiro
        if (!teamMap.has(t.user_id!)) teamMap.set(t.user_id!, { equipe: t.equipe, gerente_id: t.gerente_id });
      }
      const allocMap = new Map<string, string[]>();
      for (const a of allocRes.data || []) allocMap.set(a.user_id, a.empreendimentos || []);

      let rows: CorretorRow[] = (profRes.data || []).map((p: any) => ({
        user_id: p.user_id,
        nome: p.nome || "—",
        avatar_url: p.avatar_url ?? null,
        equipe: teamMap.get(p.user_id)?.equipe ?? null,
        gerente_id: teamMap.get(p.user_id)?.gerente_id ?? null,
        alocacao: allocMap.get(p.user_id) || [],
      }));

      if (scope === "gerente" && gerenteId) {
        rows = rows.filter((r) => r.gerente_id === gerenteId);
      }

      rows.sort((a, b) => {
        const teamA = a.equipe || "zzz";
        const teamB = b.equipe || "zzz";
        if (teamA !== teamB) return teamA.localeCompare(teamB);
        return a.nome.localeCompare(b.nome);
      });
      return rows;
    },
    staleTime: 60_000,
  });
}

/** Grava alocação de um corretor via RPC. */
export function useSetAlocacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; empreendimentos: string[]; observacao?: string | null }) => {
      const { data, error } = await supabase.rpc("set_corretor_alocacao", {
        p_user_id: input.userId,
        p_empreendimentos: input.empreendimentos,
        p_observacao: input.observacao ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Alocação salva");
      qc.invalidateQueries({ queryKey: ["foco", "corretores"] });
    },
    onError: (e: any) => {
      const msg = String(e?.message || e);
      if (msg.includes("forbidden")) toast.error("Você não tem permissão para alocar este corretor");
      else toast.error("Erro ao salvar: " + msg);
    },
  });
}

/**
 * Performance corretor × empreendimento no período.
 * Retorna linhas agregadas (uma por combinação).
 */
export interface PerfRow {
  auth_user_id: string;
  empreendimento_id: string | null;
  leads: number;
  visitas_agendadas: number;
  visitas_realizadas: number;
  no_shows: number;
  vendas: number;
  vgv: number;
}

export function useFocoPerformance(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["foco", "performance", from, to],
    enabled,
    queryFn: async (): Promise<PerfRow[]> => {
      const { fetchAllRows } = await import("@/lib/paginatedFetch");
      const data = await fetchAllRows<any>((fromIdx, toIdx) =>
        supabase
          .from("v_corretor_empreendimento_performance")
          .select("auth_user_id, empreendimento_id, leads_recebidos, visitas_agendadas, visitas_realizadas, no_shows, vendas, vgv, dia")
          .gte("dia", from)
          .lte("dia", to)
          .range(fromIdx, toIdx),
      );
      const agg = new Map<string, PerfRow>();
      for (const r of data) {
        const k = `${r.auth_user_id}::${r.empreendimento_id ?? "null"}`;
        const cur = agg.get(k) || {
          auth_user_id: r.auth_user_id,
          empreendimento_id: r.empreendimento_id,
          leads: 0,
          visitas_agendadas: 0,
          visitas_realizadas: 0,
          no_shows: 0,
          vendas: 0,
          vgv: 0,
        };
        cur.leads += r.leads_recebidos || 0;
        cur.visitas_agendadas += r.visitas_agendadas || 0;
        cur.visitas_realizadas += r.visitas_realizadas || 0;
        cur.no_shows += r.no_shows || 0;
        cur.vendas += r.vendas || 0;
        cur.vgv += Number(r.vgv || 0);
        agg.set(k, cur);
      }
      return Array.from(agg.values());
    },
    staleTime: 60_000,
  });
}


/** Alocação do corretor logado (empreendimentos + segmentos derivados). */
export interface MinhaAlocacaoRow {
  empreendimento_id: string;
  empreendimento_nome: string;
  segmento_id: string | null;
  segmento_nome: string | null;
  ativo: boolean;
}

export function useMinhaAlocacao() {
  return useQuery({
    queryKey: ["foco", "minha-alocacao"],
    queryFn: async (): Promise<MinhaAlocacaoRow[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [];
      const { data: alloc, error } = await supabase
        .from("corretor_alocacao")
        .select("empreendimentos")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      const ids = (alloc?.empreendimentos as string[] | null) || [];
      if (ids.length === 0) return [];
      const { data: emps, error: e2 } = await supabase
        .from("empreendimentos_canonicos")
        .select("id, nome, segmento_id, ativo, roleta_segmentos(nome)")
        .in("id", ids);
      if (e2) throw e2;
      return (emps || []).map((r: any) => ({
        empreendimento_id: r.id,
        empreendimento_nome: r.nome,
        segmento_id: r.segmento_id,
        segmento_nome: r.roleta_segmentos?.nome ?? null,
        ativo: r.ativo,
      }));
    },
    // Foco muda durante o dia (gestor altera com o app do corretor aberto).
    // Refresh por EVENTO (abrir tela / voltar ao app / botão Atualizar) —
    // sem polling, para não ficar recarregando sozinho o tempo todo.
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    placeholderData: (prev: any) => prev,

  });
}
