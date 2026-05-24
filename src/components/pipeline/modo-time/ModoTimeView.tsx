/**
 * ModoTimeView — container do Modo Time do gestor.
 *
 * Fase 2.3:
 *  - Alertas no topo (até 3 cards)
 *  - Visitas da equipe (PipelineTeamVisitas reposicionado)
 *  - Tabela agregada do time
 *  - Switcher "Meus Leads": mostra tabela com 1 linha do gestor
 *    (calculada client-side via calcGestorOwnRow). Click NA linha → Kanban filtrado.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTimeAgregado, type TimeAgregadoRow } from "@/hooks/useTimeAgregado";
import { useTimeAlertas, type AlertaAction } from "@/hooks/useTimeAlertas";
import ModoTimeHeader from "./ModoTimeHeader";
import ModoTimeTabela from "./ModoTimeTabela";
import ModoTimeAlertas from "./ModoTimeAlertas";
import ModoTimeVisitas from "./ModoTimeVisitas";
import { loadModoTimeView, saveModoTimeView, type ModoTimeView as ViewMode } from "./ModoTimeSwitcher";

interface Props {
  gestorId: string;
  /** Quantos leads o gestor tem como dono (pipeline_leads.corretor_id = gestor.user_id). */
  ownLeadsCount: number;
  /** Click numa linha → filtra Kanban por aquele corretor + troca pra aba kanban. */
  onSelectCorretor: (corretorId: string) => void;
  /** Linha agregada do próprio gestor (calculada client-side em PipelineKanban). */
  gestorOwnRow: TimeAgregadoRow | null;
  /** Click num alerta → aplica filtro no Kanban e troca aba. */
  onApplyAlertAction: (action: AlertaAction) => void;
}

export default function ModoTimeView({
  gestorId,
  ownLeadsCount,
  onSelectCorretor,
  gestorOwnRow,
  onApplyAlertAction,
}: Props) {
  const { data: rows = [], isLoading, error } = useTimeAgregado(gestorId);
  const hasOwnLeads = ownLeadsCount > 0;
  const [view, setView] = useState<ViewMode>(() => loadModoTimeView(gestorId));

  // Se o gestor não tem leads próprios, força "meu_time"
  useEffect(() => {
    if (!hasOwnLeads && view === "meus_leads") setView("meu_time");
  }, [hasOwnLeads, view]);

  const handleViewChange = (v: ViewMode) => {
    setView(v);
    saveModoTimeView(gestorId, v);
  };

  const alertas = useTimeAlertas(rows);

  const displayRows = useMemo<TimeAgregadoRow[]>(() => {
    if (view === "meus_leads") return gestorOwnRow ? [gestorOwnRow] : [];
    return rows;
  }, [view, rows, gestorOwnRow]);

  const subtitle =
    view === "meu_time" && rows.length > 0
      ? `${rows.length} ${rows.length === 1 ? "corretor" : "corretores"} no time`
      : view === "meus_leads"
      ? "Seus leads como corretor"
      : undefined;

  return (
    <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
      <ModoTimeHeader
        view={view}
        onViewChange={handleViewChange}
        hasOwnLeads={hasOwnLeads}
        subtitle={subtitle}
      />

      {view === "meu_time" && (
        <>
          <ModoTimeAlertas alertas={alertas} onActionClick={onApplyAlertAction} />
          <ModoTimeVisitas />
        </>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar agregado do time: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && (
        <ModoTimeTabela rows={displayRows} onRowClick={onSelectCorretor} />
      )}
    </div>
  );
}
