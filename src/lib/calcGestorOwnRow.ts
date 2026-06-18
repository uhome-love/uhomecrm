/**
 * calcGestorOwnRow — Calcula client-side a linha agregada do gestor (como se
 * fosse um corretor) para o switcher "Meus Leads" do Modo Time.
 *
 * Não chama RPC nova (limite de migrations). Usa pipeline.leads + tarefasMap
 * que já estão carregados no PipelineKanban.
 *
 * Dívidas conhecidas:
 *  - sem_contato_5d: requer pipeline_atividades (não disponível client-side) → 0
 *  - conversao_pct: requer leads_recebidos últimos 90d (histórico) → null
 *  - vgv_pipeline: aproximação via sum(valor_estimado) dos leads com negocio_id
 *  - segmento_principal: null (mesma dívida da RPC)
 */
import type { PipelineLead } from "@/hooks/usePipeline";
import type { TimeAgregadoRow } from "@/hooks/useTimeAgregado";
import { getLeadStatusFilter, type ProximaTarefa } from "@/lib/taskQueryUtils";

const EXCLUDED_TIPOS = new Set(["descarte", "convertido", "venda", "contrato_gerado"]);

export function calcGestorOwnRow(params: {
  gestorAuthId: string;
  gestorNome: string;
  gestorAvatarUrl: string | null;
  leads: PipelineLead[];
  tarefasMap: Record<string, ProximaTarefa | null>;
  stageTipoById: Record<string, string | undefined>;
}): TimeAgregadoRow {
  const { gestorAuthId, gestorNome, gestorAvatarUrl, leads, tarefasMap, stageTipoById } = params;

  // Leads operacionais do gestor (mesmos critérios da RPC: exclui descarte/convertido/venda/contrato_gerado)
  const meus = leads.filter(
    (l) => l.corretor_id === gestorAuthId && !EXCLUDED_TIPOS.has(stageTipoById[l.stage_id] || ""),
  );

  let semTarefa = 0;
  let atrasados = 0;
  let emDia = 0;
  let paraHoje = 0;
  let negocios = 0;
  let vgvPipeline = 0;

  const todayYMD = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  for (const l of meus) {
    const t = tarefasMap[l.id] || null;
    if (!t || !t.tipo) {
      semTarefa += 1;
    } else if (t.vence_em === todayYMD) {
      paraHoje += 1;
    }
    const status = getLeadStatusFilter(l, t, stageTipoById[l.stage_id]);
    if (status === "tarefa_atrasada") atrasados += 1;
    else if (status === "em_dia") emDia += 1;

    if ((l as any).negocio_id) {
      negocios += 1;
      vgvPipeline += Number((l as any).valor_estimado || 0);
    }
  }

  // Alerta principal (mesma hierarquia da RPC)
  let alertaPrincipal: string | null = null;
  if (atrasados >= 5) alertaPrincipal = `${atrasados} tarefas atrasadas`;
  else if (semTarefa >= 10) alertaPrincipal = `${semTarefa} leads sem tarefa`;

  return {
    corretor_id: gestorAuthId,
    nome: gestorNome,
    avatar_url: gestorAvatarUrl,
    segmento_principal: null,
    total_leads: meus.length,
    total_recebidos: meus.length,
    sem_tarefa: semTarefa,
    atrasados,
    em_dia: emDia,
    para_hoje: paraHoje,
    sem_contato_5d: 0,
    negocios,
    vgv_pipeline: vgvPipeline,
    conversao_pct: null,
    alerta_principal: alertaPrincipal,
  };
}
