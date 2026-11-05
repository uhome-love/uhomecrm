import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { StateWrapper } from "@/components/ui/StateWrapper";
import { CeoDashboardSkeleton } from "@/components/ui/skeleton-dashboard";
import DesktopHeader from "./DesktopHeader";
import DesktopTopKpis from "./DesktopTopKpis";
import DesktopApprovals from "./DesktopApprovals";
import WidgetRoleta from "./widgets/WidgetRoleta";
import WidgetMarketing from "./widgets/WidgetMarketing";
import DesktopVisitas from "./DesktopVisitas";
import DesktopNegocios from "./DesktopNegocios";
import DesktopOferta from "./DesktopOferta";
import DesktopDados from "./DesktopDados";


export default function DesktopDashboardContent({ model: m }: { model: CeoDashboardController }) {
  return <div className="bg-background p-4 -m-4 sm:p-6 sm:-m-6 min-h-full space-y-5">
    <DesktopHeader model={m} />
    <div className="space-y-5">
      <StateWrapper error={m.dashError} loading={m.loading && !m.profile} skeleton={<CeoDashboardSkeleton />} stale={m.partial}
        staleMessage={`Alguns dados não carregaram (${m.partialSources.join(", ")}). Os números abaixo podem estar incompletos.`}
        onRetry={m.reload} errorTitle="Não foi possível carregar o dashboard" errorDescription="Uma das consultas essenciais falhou. Os números não são confiáveis agora." className="space-y-5">
        <DesktopTopKpis model={m} />
        <DesktopApprovals model={m} />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          <WidgetRoleta model={m} />
          <WidgetMarketing model={m} />
        </div>
        <DesktopVisitas model={m} />
        <DesktopNegocios model={m} />
        <DesktopOferta model={m} />
        <DesktopDados model={m} />
      </StateWrapper>
    </div>
  </div>;
}