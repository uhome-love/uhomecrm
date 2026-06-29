import { useRelatoriosCentral } from "@/hooks/useRelatoriosCentral";
import type { CentralUrlState } from "@/components/central-v2/useCentralUrlState";
import type { CentralSectionId } from "@/components/central-v2/sections";
import { GeralView } from "./GeralView";
import { SectionPipelineLeads } from "./sections/SectionPipelineLeads";
import { SectionOrigemSegmento } from "./sections/SectionOrigemSegmento";
import { SectionOA } from "./sections/SectionOA";
import { SectionVisitas } from "./sections/SectionVisitas";
import { SectionNegocios } from "./sections/SectionNegocios";
import { SectionVendas } from "./sections/SectionVendas";
import { SectionRanking } from "./sections/SectionRanking";
import { safeGet } from "./shared/safeGet";

interface Props {
  state: CentralUrlState;
}

/**
 * Renderiza a seção ativa da Central de Relatórios.
 * A view "Geral" mantém o agregado; as demais abas usam o mesmo hook
 * (com cache compartilhado via React Query) para a visão isolada.
 */
export function SectionRouterView({ state }: Props) {
  if (state.secao === "geral") {
    return <GeralView state={state} />;
  }
  return <IndividualSection secao={state.secao} state={state} />;
}

function IndividualSection({ secao, state }: { secao: CentralSectionId; state: CentralUrlState }) {
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
    <div className="flex flex-col gap-6">
      {secao === "pipeline-leads" && <SectionPipelineLeads query={rel.pipelineLeads} />}
      {secao === "oferta-ativa" && <SectionOA query={rel.ofertaAtiva} />}
      {secao === "visitas" && <SectionVisitas query={rel.visitas} />}
      {secao === "negocios" && (
        <SectionNegocios
          query={rel.negocios}
          assinados={assinados}
          assinadosLoading={rel.vendas.isLoading && !rel.vendas.data}
        />
      )}
      {secao === "vendas" && <SectionVendas query={rel.vendas} />}
      {secao === "ranking" && <SectionRanking query={rel.ranking} />}
    </div>
  );
}
