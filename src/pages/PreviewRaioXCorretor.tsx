import { RaioXCorretorView } from "@/pages/RaioXCorretorPage";
import type { RaioXCorretorFull } from "@/hooks/useRaioXCorretor";

/**
 * PreviewRaioXCorretor — rota PÚBLICA (sem login) só para conferir o layout do
 * Raio-X do Corretor com dados de EXEMPLO. A versão real (dados verdadeiros,
 * escopo por RLS) é RaioXCorretorPage em /raio-x-corretor.
 */

const MOCK: RaioXCorretorFull = {
  corretor: {
    user_id: "mock", profile_id: "mock", nome: "Rafaela Sandin",
    avatar_url: null, cargo: "Corretora",
    gerente_nome: "Bruno Schuler", desde: "2025-03-10",
  },
  janela: { start: "2026-08-01", end: "2026-09-01" },
  janelaAnterior: { start: "2026-07-01", end: "2026-07-17" },
  leads: { recebidos: 62, descartados: 21, descartados_do_periodo: 13, descartados_antigos: 8, estagnados: 14, ativos: 137, cpl_medio: 41.7, custo_total: 2585.4, cpl_fonte: "referencia", cpl_referencia_label: "jul/26" },
  visitas: { criadas: 12, realizadas: 7, no_show: 3, a_realizar: 2, taxa_comparecimento: 70, taxa_lead_visita: 19.4 },
  negocios: { criados: 4, ativos: 8, em_documentacao: 3, em_negociacao: 4, em_contrato: 1, vendas: 2, vgv: 1740000, ticket_medio: 870000, taxa_visita_venda: 28.6, taxa_lead_venda: 3.2, custo_por_venda: 1292.7, vendas_em_parceria: 1 },
  presenca: { manha: 14, tarde: 13, noturna: 4, total: 31, faltas: 1, roleta_manha: 12, roleta_tarde: 11, roleta_noturna: 5, dias_com_presenca: 15 },
  crm: {
    atividades: 148, leads_tocados: 71, atividades_por_lead: 2.1, lembretes_criados: 54,
    lembretes_concluidos: 41, lembretes_atrasados: 6, pct_lembretes_cumpridos: 75.9,
    pct_atrasados: 22.2, pct_estagnados: 10.2, adiamentos: 9, leads_sem_atividade: 12,
  },
  anterior: {
    leads: { recebidos: 48, descartados: 25, descartados_do_periodo: 9, descartados_antigos: 16, estagnados: 0, ativos: 0, cpl_medio: 46.2, custo_total: 2217.6, cpl_fonte: "referencia", cpl_referencia_label: "jul/26" },
    visitas: { criadas: 9, realizadas: 4, no_show: 4, a_realizar: 1, taxa_comparecimento: 50, taxa_lead_visita: 18.8 },
    negocios: { criados: 3, ativos: 0, em_documentacao: 0, em_negociacao: 0, em_contrato: 0, vendas: 1, vgv: 690000, ticket_medio: 690000, taxa_visita_venda: 25, taxa_lead_venda: 2.1, custo_por_venda: 2217.6, vendas_em_parceria: 0 },
    presenca: { manha: 12, tarde: 12, noturna: 2, total: 26, faltas: 3, roleta_manha: 10, roleta_tarde: 10, roleta_noturna: 2, dias_com_presenca: 13 },
    crm: {
      atividades: 112, leads_tocados: 58, atividades_por_lead: 1.9, lembretes_criados: 47,
      lembretes_concluidos: 30, lembretes_atrasados: 0, pct_lembretes_cumpridos: 63.8,
      pct_atrasados: 0, pct_estagnados: 0, adiamentos: 14, leads_sem_atividade: 0,
    },
  },
  empreendimentos: [
    { nome: "Lake Eyre", visitas: 5, realizadas: 4, no_show: 1, comparecimento: 80, vendas: 1, vgv: 950000, resolvido: true },
    { nome: "Golden Lake", visitas: 4, realizadas: 2, no_show: 1, comparecimento: 66.7, vendas: 1, vgv: 790000, resolvido: true },
    { nome: "Lake Baikal", visitas: 3, realizadas: 1, no_show: 1, comparecimento: 50, vendas: 0, vgv: 0, resolvido: true },
    { nome: "Não identificado", visitas: 2, realizadas: 1, no_show: 1, comparecimento: 50, vendas: 0, vgv: 0, resolvido: false },
  ],
  origensVenda: [
    { origem: "Meta Ads", vendas: 1, vgv: 950000 },
    { origem: "Indicação", vendas: 1, vgv: 790000 },
  ],
  evolucao: [
    { mes: "2025-09", label: "set/25", leads: 31, visitas_realizadas: 3, vendas: 0, vgv: 0 },
    { mes: "2025-10", label: "out/25", leads: 44, visitas_realizadas: 5, vendas: 1, vgv: 610000 },
    { mes: "2025-11", label: "nov/25", leads: 38, visitas_realizadas: 4, vendas: 0, vgv: 0 },
    { mes: "2025-12", label: "dez/25", leads: 26, visitas_realizadas: 2, vendas: 0, vgv: 0 },
    { mes: "2026-01", label: "jan/26", leads: 51, visitas_realizadas: 6, vendas: 1, vgv: 720000 },
    { mes: "2026-02", label: "fev/26", leads: 47, visitas_realizadas: 5, vendas: 0, vgv: 0 },
    { mes: "2026-03", label: "mar/26", leads: 58, visitas_realizadas: 7, vendas: 2, vgv: 1480000 },
    { mes: "2026-04", label: "abr/26", leads: 49, visitas_realizadas: 5, vendas: 1, vgv: 690000 },
    { mes: "2026-05", label: "mai/26", leads: 55, visitas_realizadas: 6, vendas: 1, vgv: 830000 },
    { mes: "2026-06", label: "jun/26", leads: 43, visitas_realizadas: 4, vendas: 0, vgv: 0 },
    { mes: "2026-07", label: "jul/26", leads: 48, visitas_realizadas: 4, vendas: 1, vgv: 690000 },
    { mes: "2026-08", label: "ago/26", leads: 62, visitas_realizadas: 7, vendas: 2, vgv: 1740000 },
  ],
  cobertura_custo: 100,
};

export default function PreviewRaioXCorretor() {
  return <RaioXCorretorView data={MOCK} periodoLabel="Mês atual" />;
}
