// ─────────────────────────────────────────────────────────────────
// DrawerVisitsTab — Aba Visitas editorial v4
// Agrupa em Agendadas / Realizadas com caixa de data destacada.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { MapPin, Calendar, Plus, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRT, parseDateBRTSafe as _x } from "@/lib/brtTime";
import { parseDateBRTSafe } from "@/lib/utils";
import { groupVisitsByStatus, type VisitaLike } from "@/lib/visitGrouping";

interface Visita extends VisitaLike {
  id: string;
  data_visita: string;
  hora_visita: string | null;
  empreendimento: string | null;
  local_visita: string | null;
  status: string;
  resultado_visita: string | null;
  observacoes: string | null;
}

interface Props {
  pipelineLeadId: string;
  onAgendarVisita: () => void;
  reloadToken?: number;
}

const STATUS_STYLE: Record<string, string> = {
  agendada: "bg-amber-100 text-amber-700",
  confirmada: "bg-emerald-100 text-emerald-700",
  pendente: "bg-amber-100 text-amber-700",
  realizada: "bg-indigo-100 text-indigo-700",
  cancelada: "bg-red-100 text-red-700",
  nao_compareceu: "bg-red-100 text-red-700",
  reagendada: "bg-purple-100 text-purple-700",
};

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  pendente: "Pendente",
  realizada: "Realizada",
  cancelada: "Cancelada",
  nao_compareceu: "Não compareceu",
  reagendada: "Reagendada",
};

const DOW = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MES_ABBR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export default function DrawerVisitsTab({ pipelineLeadId, onAgendarVisita, reloadToken }: Props) {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("visitas")
        .select("id, data_visita, hora_visita, empreendimento, local_visita, status, resultado_visita, observacoes")
        .eq("pipeline_lead_id", pipelineLeadId)
        .order("data_visita", { ascending: false });
      if (!cancelled) {
        setVisitas((data ?? []) as Visita[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pipelineLeadId, reloadToken]);

  const grouped = useMemo(() => groupVisitsByStatus(visitas), [visitas]);
  const countAgendadas = grouped.agendadas.length;
  const countRealizadas = grouped.realizadas.length;

  return (
    <div className="pb-8">
      <div className="px-7 pt-6 pb-4 flex justify-between items-end border-b border-zinc-100">
        <div>
          <div className="text-lg font-bold text-zinc-900 tracking-tight">Visitas</div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {countAgendadas > 0 && <>{countAgendadas} agendada{countAgendadas !== 1 ? "s" : ""} · </>}
            {countRealizadas} realizada{countRealizadas !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          onClick={onAgendarVisita}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-xs font-medium flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Agendar visita
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Clock className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : visitas.length === 0 ? (
        <div className="text-center py-16 px-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto mb-4">
            <MapPin className="h-7 w-7" />
          </div>
          <div className="text-base font-semibold text-zinc-900 mb-1.5">
            Nenhuma visita agendada
          </div>
          <div className="text-xs text-zinc-500 max-w-xs mx-auto mb-5 leading-relaxed">
            Agendar uma visita é o passo mais importante pra fechar o negócio. Cliente que visita compra 3x mais que o que só conversa.
          </div>
          <button
            onClick={onAgendarVisita}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5" /> Agendar primeira visita
          </button>
        </div>
      ) : (
        <div className="px-7 pt-4">
          {countAgendadas > 0 && (
            <section>
              <div className="flex items-center gap-2 mt-6 mb-3 first:mt-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  📅 Agendadas
                </span>
                <span className="bg-zinc-100 text-zinc-500 text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                  {countAgendadas}
                </span>
              </div>
              {grouped.agendadas.map(v => <VisitaCard key={v.id} visita={v} isFuture />)}
            </section>
          )}
          {countRealizadas > 0 && (
            <section>
              <div className="flex items-center gap-2 mt-6 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  ✅ Realizadas
                </span>
                <span className="bg-zinc-100 text-zinc-500 text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                  {countRealizadas}
                </span>
              </div>
              {grouped.realizadas.map(v => <VisitaCard key={v.id} visita={v} isFuture={false} />)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function VisitaCard({ visita, isFuture }: { visita: Visita; isFuture: boolean }) {
  const d = parseDateBRTSafe(visita.data_visita);
  const diaSemana = d ? DOW[d.getDay()] : "--";
  const dia = d ? formatBRT(d, "dd") : "--";
  const mes = d ? MES_ABBR[Number(formatBRT(d, "MM")) - 1] : "---";
  const hora = visita.hora_visita ? visita.hora_visita.slice(0, 5) : null;
  const status = visita.status || "agendada";
  const statusCls = STATUS_STYLE[status] ?? "bg-zinc-100 text-zinc-600";
  const statusLabel = STATUS_LABEL[status] ?? status;

  return (
    <div className="rounded-xl border border-zinc-200 p-4 mb-3 relative bg-white">
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${isFuture ? "bg-emerald-600" : "bg-zinc-400"}`} />

      <div className="flex items-start gap-3 mb-3">
        <div className={`w-14 rounded-xl p-2 text-center flex-shrink-0 ${
          isFuture
            ? "bg-gradient-to-br from-emerald-100/80 to-emerald-50/40 border border-emerald-200/50"
            : "bg-zinc-100 border border-zinc-200"
        }`}>
          <div className={`text-[11px] font-semibold uppercase ${isFuture ? "text-emerald-600" : "text-zinc-500"}`}>
            {diaSemana}
          </div>
          <div className={`text-[22px] font-bold leading-none my-0.5 ${isFuture ? "text-emerald-700" : "text-zinc-700"}`}>
            {dia}
          </div>
          <div className="text-[10px] text-zinc-500 uppercase">{mes}</div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs text-zinc-600 font-medium mb-1 flex items-center gap-1.5 flex-wrap">
            {hora && <span>{hora}</span>}
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-tight font-semibold ${statusCls}`}>
              {statusLabel}
            </span>
          </div>
          {visita.empreendimento && (
            <div className="text-sm font-semibold text-zinc-900 mb-1">{visita.empreendimento}</div>
          )}
          {visita.local_visita && (
            <div className="text-xs text-zinc-500 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {visita.local_visita}
            </div>
          )}
        </div>
      </div>

      {visita.observacoes && (
        <div className="text-xs text-zinc-600 bg-zinc-50 rounded-md p-2 mb-2 leading-relaxed">
          {visita.observacoes}
        </div>
      )}

      <div className="flex gap-1.5 pt-2.5 border-t border-zinc-100 flex-wrap">
        {isFuture ? (
          <>
            {visita.local_visita && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visita.local_visita)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-2.5 py-1 text-[11px] font-medium inline-flex items-center gap-1"
              >
                <MapPin className="h-3 w-3" /> Ver no mapa
              </a>
            )}
          </>
        ) : (
          visita.resultado_visita && (
            <div className="text-[11px] text-zinc-600 px-2.5 py-1 rounded-md bg-zinc-50 border border-zinc-200">
              Resultado: <span className="font-semibold">{visita.resultado_visita}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
