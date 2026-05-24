/**
 * ModoTimeVisitas — wrapper fino que reposiciona PipelineTeamVisitas no topo
 * do Modo Time. Não modifica o componente original.
 */
import { Suspense, lazy } from "react";

const PipelineTeamVisitas = lazy(() => import("@/components/pipeline/PipelineTeamVisitas"));

export default function ModoTimeVisitas() {
  return (
    <Suspense fallback={null}>
      <PipelineTeamVisitas />
    </Suspense>
  );
}
