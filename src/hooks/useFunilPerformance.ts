// =============================================================================
// useFunilPerformance — fonte única da nova página Performance.
// Wrapper da RPC public.rpc_perf_funil (funil completo por corretor/equipe).
// =============================================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FunilLinha {
  corretor_auth_id: string;
  corretor_nome: string | null;
  avatar_url: string | null;
  /** equipe HISTÓRICA (do período do fato) */
  equipe: string | null;
  equipe_atual: string | null;
  gerente_auth_id: string | null;
  corretor_ativo: boolean;
  presenca_dias: number;
  presenca_faltas: number;
  presenca_saidas: number;
  dias_uteis: number;
  /** dias úteis já decorridos do período (base honesta da presença) */
  dias_uteis_decorridos: number;
  leads_recebidos: number;
  pipeline_ativo: number;
  descartes: number;
  /** visitas que existiram no período (agendadas nele OU realizadas nele) */
  visitas_total: number;
  visitas_agendadas: number;
  visitas_realizadas: number;
  visitas_no_show: number;
  negocios_abertos: number;
  /** VGV de negócios ativos (em negociação + contrato, sem queda) */
  vgv_gerado: number;
  vendas: number;
  vgv_assinado: number;
}

export interface FunilTotais {
  corretores: number;
  /** corretores ativos (base do % de presença) */
  corretores_ativos: number;
  presenca_dias: number;
  presenca_faltas: number;
  presenca_saidas: number;
  dias_uteis: number;
  dias_uteis_decorridos: number;
  leads_recebidos: number;
  pipeline_ativo: number;
  descartes: number;
  visitas_total: number;
  visitas_agendadas: number;
  visitas_realizadas: number;
  visitas_no_show: number;
  negocios_abertos: number;
  vgv_gerado: number;
  vendas: number;
  vgv_assinado: number;
}


const num = (v: unknown) => Number(v) || 0;

export interface FunilFiltro {
  start: string;
  end: string;
  gerenteId?: string | null;
  userId?: string | null;
}

export function useFunilPerformance(filtro: FunilFiltro, enabled = true) {
  const query = useQuery({
    queryKey: ["perf-funil", filtro.start, filtro.end, filtro.gerenteId, filtro.userId],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<FunilLinha[]> => {
      const { data, error } = await supabase.rpc("rpc_perf_funil" as never, {
        p_start: filtro.start,
        p_end: filtro.end,
        p_gerente_id: filtro.gerenteId ?? null,
        p_user_id: filtro.userId ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as Record<string, unknown>[]) || []).map((r) => ({
        corretor_auth_id: String(r.corretor_auth_id),
        corretor_nome: (r.corretor_nome as string) ?? null,
        avatar_url: (r.avatar_url as string) ?? null,
        equipe: (r.equipe as string) ?? null,
        equipe_atual: (r.equipe_atual as string) ?? (r.equipe as string) ?? null,
        gerente_auth_id: (r.gerente_auth_id as string) ?? null,
        corretor_ativo: Boolean(r.corretor_ativo),
        presenca_dias: num(r.presenca_dias),
        presenca_faltas: num(r.presenca_faltas),
        presenca_saidas: num(r.presenca_saidas),
        dias_uteis: num(r.dias_uteis),
        dias_uteis_decorridos: num(r.dias_uteis_decorridos) || num(r.dias_uteis),
        leads_recebidos: num(r.leads_recebidos),
        pipeline_ativo: num(r.pipeline_ativo),
        descartes: num(r.descartes),
        visitas_total: num(r.visitas_total),
        visitas_agendadas: num(r.visitas_agendadas),
        visitas_realizadas: num(r.visitas_realizadas),
        visitas_no_show: num(r.visitas_no_show),
        negocios_abertos: num(r.negocios_abertos),
        vgv_gerado: num(r.vgv_gerado),
        vendas: num(r.vendas),
        vgv_assinado: num(r.vgv_assinado),
      }));
    },
  });

  return {
    linhas: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/** Consolida em 1 linha por corretor (equipe exibida = equipe atual). */
export function consolidarFunil(linhas: FunilLinha[]): FunilLinha[] {
  const map = new Map<string, FunilLinha>();
  linhas.forEach((l) => {
    const cur = map.get(l.corretor_auth_id);
    if (!cur) {
      map.set(l.corretor_auth_id, { ...l, equipe: l.equipe_atual ?? l.equipe });
      return;
    }
    cur.leads_recebidos += l.leads_recebidos;
    cur.visitas_agendadas += l.visitas_agendadas;
    cur.visitas_realizadas += l.visitas_realizadas;
    cur.visitas_no_show += l.visitas_no_show;
    cur.vendas += l.vendas;
    cur.vgv_assinado += l.vgv_assinado;
    cur.pipeline_ativo += l.pipeline_ativo;
    cur.descartes += l.descartes;
    cur.negocios_abertos += l.negocios_abertos;
    cur.vgv_gerado += l.vgv_gerado;
    cur.presenca_dias = Math.max(cur.presenca_dias, l.presenca_dias);
  });
  return Array.from(map.values()).sort((a, b) => b.vgv_assinado - a.vgv_assinado);
}

export function somarFunil(linhas: FunilLinha[]): FunilTotais {
  const t: FunilTotais = {
    corretores: new Set(linhas.map((l) => l.corretor_auth_id)).size,
    presenca_dias: 0,
    dias_uteis: linhas[0]?.dias_uteis ?? 0,
    leads_recebidos: 0,
    pipeline_ativo: 0,
    descartes: 0,
    visitas_agendadas: 0,
    visitas_realizadas: 0,
    visitas_no_show: 0,
    negocios_abertos: 0,
    vgv_gerado: 0,
    vendas: 0,
    vgv_assinado: 0,
  };
  linhas.forEach((l) => {
    t.presenca_dias += l.presenca_dias;
    t.leads_recebidos += l.leads_recebidos;
    t.pipeline_ativo += l.pipeline_ativo;
    t.descartes += l.descartes;
    t.visitas_agendadas += l.visitas_agendadas;
    t.visitas_realizadas += l.visitas_realizadas;
    t.visitas_no_show += l.visitas_no_show;
    t.negocios_abertos += l.negocios_abertos;
    t.vgv_gerado += l.vgv_gerado;
    t.vendas += l.vendas;
    t.vgv_assinado += l.vgv_assinado;
  });
  return t;
}

/** Presença agregada em % (dias presentes ÷ dias úteis do time). */
export function presencaPct(t: FunilTotais): number {
  const base = t.dias_uteis * t.corretores;
  if (!base) return 0;
  return Math.min(100, (t.presenca_dias / base) * 100);
}

export function agruparFunilPorEquipe(linhas: FunilLinha[]) {
  const map = new Map<string, FunilLinha[]>();
  linhas.forEach((l) => {
    const k = l.equipe || "Sem equipe";
    map.set(k, [...(map.get(k) || []), l]);
  });
  return Array.from(map.entries())
    .map(([equipe, membros]) => ({ equipe, membros, totais: somarFunil(membros) }))
    .sort((a, b) => b.totais.vgv_assinado - a.totais.vgv_assinado);
}
