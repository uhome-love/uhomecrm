import { useRelatoriosCentral } from "@/hooks/useRelatoriosCentral";
import type { CentralUrlState } from "@/components/central-v2/useCentralUrlState";
import { ExecutiveSummary } from "./sections/ExecutiveSummary";
import { SectionPipelineLeads } from "./sections/SectionPipelineLeads";
import { SectionOrigemSegmento } from "./sections/SectionOrigemSegmento";
import { SectionOA } from "./sections/SectionOA";
import { SectionVisitas } from "./sections/SectionVisitas";
import { SectionNegocios } from "./sections/SectionNegocios";
import { SectionVendas } from "./sections/SectionVendas";
import { RankingTeaser } from "./sections/RankingTeaser";
import { FunnelChart, type FunnelStage } from "./shared/FunnelChart";
import { TrendAreaChart, type ChartPoint } from "./shared/MiniChart";
import { safeGet } from "./shared/safeGet";
import { fmtMoney } from "@/lib/fmtMoney";

interface Props {
  state: CentralUrlState;
}

function buildVgvSeries(data: Record<string, unknown> | undefined): ChartPoint[] {
  const porDia = safeGet<Record<string, { vgv?: number }>>(data ?? {}, "extras.por_dia", "Geral por_dia");
  if (!porDia || typeof porDia !== "object") return [];
  return Object.entries(porDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, v]) => {
      const [, m, d] = dia.split("-");
      return { label: m && d ? `${d}/${m}` : dia, value: Number(v?.vgv ?? 0) };
    });
}

/**
 * GeralView — visão executiva consolidada.
 * Hero de KPIs + funil de conversão + tendência de VGV + cada seção resumida.
 */
export function GeralView({ state }: Props) {
  const rel = useRelatoriosCentral({
    periodo: state.periodo,
    de: state.de,
    ate: state.ate,
    equipe: state.equipe,
  });

  const assinados = safeGet<number>(rel.vendas.data ?? {}, "vendas.count", "Neg.Assinados (cross from vendas)");

  const leads = safeGet<number>(rel.pipelineLeads.data ?? {}, "leads.recebidos", "Funnel leads") ?? 0;
  const visitasReal = safeGet<number>(rel.visitas.data ?? {}, "visitas.realizadas", "Funnel visitas") ?? 0;
  const negCriados = safeGet<number>(rel.negocios.data ?? {}, "negocios.criados", "Funnel negocios") ?? 0;
  const vendasQtd = safeGet<number>(rel.vendas.data ?? {}, "vendas.count", "Funnel vendas") ?? 0;

  const funnelLoading =
    (rel.pipelineLeads.isLoading && !rel.pipelineLeads.data) ||
    (rel.visitas.isLoading && !rel.visitas.data) ||
    (rel.negocios.isLoading && !rel.negocios.data) ||
    (rel.vendas.isLoading && !rel.vendas.data);

  const funnel: FunnelStage[] = [
    { label: "Leads recebidos", value: Number(leads) },
    { label: "Visitas realizadas", value: Number(visitasReal) },
    { label: "Negócios criados", value: Number(negCriados) },
    { label: "Vendas assinadas", value: Number(vendasQtd) },
  ];

  const vgvSeries = buildVgvSeries(rel.vendas.data);

  return (
    <div id="central-relatorio-geral" className="flex flex-col gap-6">
      <ExecutiveSummary vendas={rel.vendas} visitas={rel.visitas} />

      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelChart
          title="Funil de conversão"
          loading={funnelLoading}
          stages={funnel}
          emptyLabel="Sem movimentação no período."
        />
        <TrendAreaChart
          title="VGV assinado por dia"
          loading={rel.vendas.isLoading && !rel.vendas.data}
          data={vgvSeries}
          valueFormatter={(v) => fmtMoney(v, "short")}
          emptyLabel="Sem vendas assinadas no período."
        />
      </div>

      <SectionPipelineLeads query={rel.pipelineLeads} />
      <SectionOrigemSegmento query={rel.pipelineLeads} />

      <SectionOA query={rel.ofertaAtiva} />
      <SectionVisitas query={rel.visitas} />
      <SectionNegocios
        query={rel.negocios}
        assinados={assinados}
        assinadosLoading={rel.vendas.isLoading && !rel.vendas.data}
      />
      <SectionVendas query={rel.vendas} />
      <RankingTeaser />
    </div>
  );
}
