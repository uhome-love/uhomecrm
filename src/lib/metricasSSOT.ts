/**
 * metricasSSOT.ts — Fonte Única de Verdade (SSOT) de métricas
 *
 * Ponto ÚNICO de acesso às métricas do CRM. Toda página nova (Performance,
 * PDN, relatórios, HOMI) deve consumir daqui — nunca recalcular VGV/visitas
 * a partir de `negocios`/`visitas` direto.
 *
 * Backend:
 *   v_corretor_equipe → equipe canônica (mantém equipe histórica de desligados)
 *   v_fato_venda      → venda com rateio 50/50 de parceria (fase='ganho' + data_assinatura BRT)
 *   v_fato_visita     → visitas com corretor/equipe resolvidos
 *   v_fato_lead       → leads com origem/campanha/empreendimento canônico
 *   rpc_metricas()    → agregação por corretor no período
 */

import { supabase } from "@/integrations/supabase/client";

export interface MetricaCorretor {
  corretor_auth_id: string;
  corretor_nome: string | null;
  /** equipe HISTÓRICA (do período em que o fato aconteceu) */
  equipe: string | null;
  /** equipe atual do corretor no cadastro */
  equipe_atual: string | null;
  gerente_auth_id: string | null;
  corretor_ativo: boolean;
  leads_recebidos: number;
  /** visitas criadas/agendadas no período (data de criação) */
  visitas_agendadas: number;
  /** agendadas que ainda não aconteceram (marcada/confirmada/reagendada) */
  visitas_a_realizar: number;
  visitas_realizadas: number;
  visitas_no_show: number;
  vendas: number;
  vgv_assinado: number;
}


export interface MetricasFiltro {
  /** YYYY-MM-DD (BRT) */
  start: string;
  /** YYYY-MM-DD (BRT) */
  end: string;
  userId?: string | null;
  gerenteId?: string | null;
  /** default true — corretores desligados seguem no histórico da equipe antiga */
  incluirInativos?: boolean;
}

const num = (v: unknown) => Number(v) || 0;

export async function fetchMetricas(filtro: MetricasFiltro): Promise<MetricaCorretor[]> {
  const { data, error } = await supabase.rpc("rpc_metricas" as never, {
    p_start: filtro.start,
    p_end: filtro.end,
    p_user_id: filtro.userId ?? null,
    p_gerente_id: filtro.gerenteId ?? null,
    p_incluir_inativos: filtro.incluirInativos ?? true,
  } as never);

  if (error) throw error;

  return ((data as unknown as Record<string, unknown>[]) || []).map((r) => ({
    corretor_auth_id: String(r.corretor_auth_id),
    corretor_nome: (r.corretor_nome as string) ?? null,
    equipe: (r.equipe as string) ?? null,
    gerente_auth_id: (r.gerente_auth_id as string) ?? null,
    corretor_ativo: Boolean(r.corretor_ativo),
    leads_recebidos: num(r.leads_recebidos),
    visitas_agendadas: num(r.visitas_agendadas ?? r.visitas_marcadas),
    visitas_a_realizar: num(r.visitas_a_realizar),
    visitas_realizadas: num(r.visitas_realizadas),
    visitas_no_show: num(r.visitas_no_show),
    vendas: num(r.vendas),
    vgv_assinado: num(r.vgv_assinado),
  }));
}

export interface MetricasTotais {
  leads_recebidos: number;
  visitas_agendadas: number;
  visitas_a_realizar: number;
  visitas_realizadas: number;
  visitas_no_show: number;
  vendas: number;
  vgv_assinado: number;
  corretores: number;
}

export function somarMetricas(linhas: MetricaCorretor[]): MetricasTotais {
  return linhas.reduce<MetricasTotais>(
    (acc, l) => ({
      leads_recebidos: acc.leads_recebidos + l.leads_recebidos,
      visitas_agendadas: acc.visitas_agendadas + l.visitas_agendadas,
      visitas_a_realizar: acc.visitas_a_realizar + l.visitas_a_realizar,
      visitas_realizadas: acc.visitas_realizadas + l.visitas_realizadas,
      visitas_no_show: acc.visitas_no_show + l.visitas_no_show,
      vendas: acc.vendas + l.vendas,
      vgv_assinado: acc.vgv_assinado + l.vgv_assinado,
      corretores: acc.corretores + 1,
    }),
    { leads_recebidos: 0, visitas_agendadas: 0, visitas_a_realizar: 0, visitas_realizadas: 0, visitas_no_show: 0, vendas: 0, vgv_assinado: 0, corretores: 0 }
  );
}

/** Agrupa por equipe (desligados entram na equipe histórica). */
export function agruparPorEquipe(linhas: MetricaCorretor[]) {
  const map = new Map<string, MetricaCorretor[]>();
  linhas.forEach((l) => {
    const k = l.equipe || "Sem equipe";
    map.set(k, [...(map.get(k) || []), l]);
  });
  return Array.from(map.entries())
    .map(([equipe, membros]) => ({ equipe, membros, totais: somarMetricas(membros) }))
    .sort((a, b) => b.totais.vgv_assinado - a.totais.vgv_assinado);
}
