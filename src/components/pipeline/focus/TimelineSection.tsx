import { useState, useEffect } from "react";
import { useTimelineEvents } from "./useTimelineEvents";
import TimelineEventItem from "./TimelineEventItem";
import { Loader2, History, ChevronDown } from "lucide-react";

interface Props {
  leadId: string;
  /** Bump esse número quando uma ação concluída (atividade/tarefa) deve refrescar a timeline. */
  refreshKey?: number;
}

const DEFAULT_LIMIT = 15;

export default function TimelineSection({ leadId, refreshKey }: Props) {
  const { events, loading, reload } = useTimelineEvents(leadId);
  const [showAll, setShowAll] = useState(false);

  // Reload externo via refreshKey
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);



  const visible = showAll ? events : events.slice(0, DEFAULT_LIMIT);
  const hasMore = events.length > DEFAULT_LIMIT && !showAll;

  return (
    <div
      className="rounded-2xl p-5 sm:p-6 h-full flex flex-col"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(79,70,229,0.15)", border: "1px solid rgba(79,70,229,0.3)" }}
          >
            <History className="w-3.5 h-3.5 text-indigo-300" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Linha do tempo</h3>
            <p className="text-[11px] text-gray-500">Tudo que aconteceu com este lead</p>
          </div>
        </div>
        {!loading && (
          <span className="text-[10px] text-gray-500" style={{ fontFamily: "var(--font-focus-mono, monospace)" }}>
            {events.length} {events.length === 1 ? "evento" : "eventos"}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto -mr-2 pr-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            <span className="text-xs">Carregando histórico...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
            <History className="w-6 h-6 opacity-40" />
            <span className="text-xs italic">Nenhum evento registrado ainda.</span>
          </div>
        ) : (
          <div>
            {visible.map((ev) => (
              <TimelineEventItem key={ev.id} event={ev} />
            ))}
            {hasMore && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-colors text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/5 border border-dashed border-indigo-500/20"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Ver mais {events.length - DEFAULT_LIMIT} eventos
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
