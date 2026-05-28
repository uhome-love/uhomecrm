import { useRelatoriosCentral } from "@/hooks/useRelatoriosCentral";
import type { CentralUrlState } from "@/components/central-v2/useCentralUrlState";
import { ExecutiveSummary } from "./sections/ExecutiveSummary";
import { SectionPipelineLeads } from "./sections/SectionPipelineLeads";
import { SectionOA } from "./sections/SectionOA";
import { SectionVisitas } from "./sections/SectionVisitas";
import { SectionNegocios } from "./sections/SectionNegocios";
import { SectionVendas } from "./sections/SectionVendas";
import { RankingTeaser } from "./sections/RankingTeaser";
import { safeGet } from "./shared/safeGet";

interface Props {
  state: CentralUrlState;
}

/**
 * GeralView — view default ao abrir a Central de Relatórios v2.
 *
 * Orquestra 5 RPCs em paralelo via useRelatoriosCentral e renderiza:
 *   1. ExecutiveSummary (VGV, Visitas Realizadas, Negócios Assinados)
 *   2. Pipeline de Leads
 *   3. Oferta Ativa
 *   4. Visitas
 *   5. Pipeline de Negócios (recebe `assinados` cruzado da RPC vendas)
 *   6. Vendas
 *   7. RankingTeaser → ?secao=ranking
 *
 * O id `central-relatorio-geral` é usado pelo exportador de PDF.
 */
export function GeralView({ state }: Props) {
  const rel = useRelatoriosCentral({
    periodo: state.periodo,
    de: state.de,
    ate: state.ate,
    equipe: state.equipe,
  });

  const assinados = safeGet<number>(
    rel.vendas.data ?? {},
    "vendas.count",
    "Neg.Assinados (cross from vendas)"
  );

  return (
    <div id="central-relatorio-geral" className="flex flex-col gap-6">
      <ExecutiveSummary vendas={rel.vendas} visitas={rel.visitas} />
      <SectionPipelineLeads query={rel.pipelineLeads} />
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
