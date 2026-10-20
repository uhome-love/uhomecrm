import { Inbox } from "lucide-react";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StateWrapper } from "@/components/ui/StateWrapper";
import MobilePeriodSelector from "./MobilePeriodSelector";
import MobileLeads from "./MobileLeads";
import MobileVisitas from "./MobileVisitas";
import MobileNegocios from "./MobileNegocios";
import MobileOferta from "./MobileOferta";
import MobileDados from "./MobileDados";
import MobileApprovals from "./MobileApprovals";

export default function MobileDashboardContent({ model: m }: { model: CeoDashboardController }) {
  return <div className="ceo-mobile min-w-0 px-[18px] pt-4 pb-8">
    <div className="mb-6 flex items-center justify-between gap-3">
      <MobilePeriodSelector />
      <Button variant="outline" onClick={() => m.setDispatchOpen(true)} disabled={m.filaCeoCount === 0} className="h-11 shrink-0 gap-2 border-primary/20 bg-primary/5 px-3 text-xs text-primary"><Inbox />Fila CEO{m.filaCeoCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground">{m.filaCeoCount}</span>}</Button>
    </div>
    <StateWrapper error={m.dashError} loading={m.loading && !m.profile}
      skeleton={<div className="space-y-6">{[0, 1, 2].map((i) => <div key={i} className="space-y-3"><Skeleton className="h-6 w-36" /><Skeleton className="h-36 w-full rounded-xl" /><Skeleton className="h-12 w-full" /></div>)}</div>}
      stale={m.partial} staleMessage={`Alguns dados não carregaram (${m.partialSources.join(", ")}). Os números abaixo podem estar incompletos.`}
      onRetry={m.reload} errorTitle="Não foi possível carregar o dashboard" errorDescription="Uma das consultas essenciais falhou. Os números não são confiáveis agora." className="space-y-7">
      <MobileApprovals model={m} />
      <MobileLeads model={m} />
      <MobileVisitas model={m} />
      <MobileNegocios model={m} />
      <MobileOferta model={m} />
      <MobileDados model={m} />
    </StateWrapper>
  </div>;
}