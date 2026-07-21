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

/** Todos os empreendimentos canônicos ativos com segmento. */
export function useEmpreendimentosCanonicos() {
  return useQuery({
    queryKey: ["foco", "empreendimentos-canonicos"],
    queryFn: async (): Promise<EmpreendimentoCanonico[]> => {
      const { data, error } = await supabase
        .from("empreendimentos_canonicos")
        .select("id, nome, segmento_id, ativo, roleta_segmentos(nome)")
        .eq("ativo", true)
        .order("nome");
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
      const { data, error } = await supabase
        .from("v_corretor_empreendimento_performance")
        .select("auth_user_id, empreendimento_id, leads_recebidos, visitas_agendadas, visitas_realizadas, no_shows, vendas, vgv, dia")
        .gte("dia", from)
        .lte("dia", to);
      if (error) throw error;
      const agg = new Map<string, PerfRow>();
      for (const r of data || []) {
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
