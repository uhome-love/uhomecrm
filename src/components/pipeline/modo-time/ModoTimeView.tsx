/**
 * ModoTimeView — container do Modo Time do gestor.
 *
 * Fase 2.2: header + switcher + tabela agregada do time.
 * Fase 2.3 (futuro): alertas + visitas no topo.
 *
 * "Meus Leads" no switcher: nesta fase, ao selecionar essa view,
 * navegamos para o Kanban filtrado pelo próprio gestor (mais simples e
 * operacionalmente equivalente — não duplica lógica de agregação).
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTimeAgregado } from "@/hooks/useTimeAgregado";
import ModoTimeHeader from "./ModoTimeHeader";
import ModoTimeTabela from "./ModoTimeTabela";
import { loadModoTimeView, saveModoTimeView, type ModoTimeView as ViewMode } from "./ModoTimeSwitcher";

interface Props {
  gestorId: string;
  /** Quantos leads o gestor tem como dono (pipeline_leads.corretor_id = gestor.user_id). */
  ownLeadsCount: number;
  /** Click numa linha → filtra Kanban por aquele corretor + troca pra aba kanban. */
  onSelectCorretor: (corretorId: string) => void;
}

export default function ModoTimeView({ gestorId, ownLeadsCount, onSelectCorretor }: Props) {
  const { data: rows = [], isLoading, error } = useTimeAgregado(gestorId);
  const hasOwnLeads = ownLeadsCount > 0;
  const [view, setView] = useState<ViewMode>(() => loadModoTimeView(gestorId));

  // Se o gestor não tem leads próprios, força "meu_time" mesmo que localStorage tenha "meus_leads".
  useEffect(() => {
    if (!hasOwnLeads && view === "meus_leads") setView("meu_time");
  }, [hasOwnLeads, view]);

  const handleViewChange = (v: ViewMode) => {
    setView(v);
    saveModoTimeView(gestorId, v);
    if (v === "meus_leads") {
      // Atalho: filtra Kanban pelo próprio gestor e troca aba.
      onSelectCorretor(gestorId);
    }
  };

  const subtitle =
    view === "meu_time" && rows.length > 0
      ? `${rows.length} ${rows.length === 1 ? "corretor" : "corretores"} no time`
      : undefined;

  return (
    <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
      <ModoTimeHeader
        view={view}
        onViewChange={handleViewChange}
        hasOwnLeads={hasOwnLeads}
        subtitle={subtitle}
      />

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
        <ModoTimeTabela rows={rows} onRowClick={onSelectCorretor} />
      )}
    </div>
  );
}
