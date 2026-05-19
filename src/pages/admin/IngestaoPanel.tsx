import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";
import {
  useKpisPorFn,
  useDestinoCounts,
  useDiarioStacked,
  useTripwireStatus,
  useAvulsoImovelWeb,
  useEventosRecentes,
  useEdgeHealthAlertasAtivos,
  type Periodo,
} from "@/hooks/useIngestaoStats";
import { useIngestaoEdgeStats } from "@/hooks/useIngestaoEdgeStats";
import { PeriodoFilter } from "@/components/admin/ingestao/PeriodoFilter";
import { KpiCardsReceive } from "@/components/admin/ingestao/KpiCardsReceive";
import { DestinoLeadsCard } from "@/components/admin/ingestao/DestinoLeadsCard";
import { AlertasSidebar } from "@/components/admin/ingestao/AlertasSidebar";
import { EventosRecentesTable } from "@/components/admin/ingestao/EventosRecentesTable";

export default function IngestaoPanel() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [periodo, setPeriodo] = useState<Periodo>("24h");
  const [paused, setPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const kpis = useKpisPorFn(periodo, paused);
  const destino = useDestinoCounts(periodo, paused);
  const diario = useDiarioStacked(paused);
  const tripwire = useTripwireStatus(paused);
  const avulso = useAvulsoImovelWeb(periodo, paused);
  const eventos = useEventosRecentes(periodo, paused);
  const edgeStats = useIngestaoEdgeStats(periodo, paused);

  useEffect(() => {
    if (kpis.dataUpdatedAt) setLastUpdate(new Date(kpis.dataUpdatedAt));
  }, [kpis.dataUpdatedAt]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ingestão de Leads</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento das funções receive-* · dedup · distribuição · tripwire (BRT)
          </p>
        </div>
        <PeriodoFilter
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          paused={paused}
          onTogglePause={() => setPaused((p) => !p)}
          lastUpdate={lastUpdate}
        />
      </div>

      <KpiCardsReceive kpis={kpis.data} loading={kpis.isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DestinoLeadsCard
            destino={destino.data}
            diario={diario.data}
            loading={destino.isLoading || diario.isLoading}
          />
        </div>
        <AlertasSidebar
          tripwire={tripwire.data}
          edgeStats={edgeStats.data}
          avulsoCount={avulso.data}
        />
      </div>

      <EventosRecentesTable rows={eventos.data} loading={eventos.isLoading} />
    </div>
  );
}
