import { useMemo, useState } from "react";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import VisitaRow from "./VisitaRow";

interface Props {
  visitas: Visita[];
  onUpdateStatus: (id: string, status: VisitaStatus) => void;
  onDelete?: (id: string) => void;
}

interface CorretorGroup {
  corretorId: string;
  nome: string;
  initials: string;
  color: string;
  totalVisitas: number;
  totalDias: number;
  realizadas: number;
  dateGroups: DateSubGroup[];
}

interface DateSubGroup {
  dateStr: string;
  label: string;
  dayOfWeek: string;
  isToday: boolean;
  isPast: boolean;
  visitas: Visita[];
  realizadas: number;
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export default function VisitasByCorretor({ visitas, onUpdateStatus, onDelete }: Props) {
  const [collapsedCorretores, setCollapsedCorretores] = useState<Set<string>>(new Set());
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const corretorMap = new Map<string, { nome: string; visitas: Visita[] }>();

    for (const v of visitas) {
      const key = v.corretor_id;
      if (!corretorMap.has(key)) corretorMap.set(key, { nome: v.corretor_nome || "Sem corretor", visitas: [] });
      corretorMap.get(key)!.visitas.push(v);
    }

    const result: CorretorGroup[] = [];
    let colorIdx = 0;

    for (const [corretorId, data] of corretorMap) {
      const dateMap = new Map<string, Visita[]>();
      for (const v of data.visitas) {
        if (!dateMap.has(v.data_visita)) dateMap.set(v.data_visita, []);
        dateMap.get(v.data_visita)!.push(v);
      }

      const dateGroups: DateSubGroup[] = [];
      for (const [dateStr, vs] of dateMap) {
        const d = new Date(dateStr + "T12:00:00");
        vs.sort((a, b) => (a.hora_visita || "99:99").localeCompare(b.hora_visita || "99:99"));
        dateGroups.push({
          dateStr,
          label: format(d, "dd/MM", { locale: ptBR }),
          dayOfWeek: format(d, "EEEE", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
          isToday: isToday(d),
          isPast: isBefore(d, today),
          visitas: vs,
          realizadas: vs.filter(v => v.status === "realizada").length,
        });
      }

      dateGroups.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      const totalRealizadas = data.visitas.filter(v => v.status === "realizada").length;

      result.push({
        corretorId,
        nome: data.nome,
        initials: getInitials(data.nome),
        color: AVATAR_COLORS[colorIdx % AVATAR_COLORS.length],
        totalVisitas: data.visitas.length,
        totalDias: dateGroups.length,
        realizadas: totalRealizadas,
        dateGroups,
      });
      colorIdx++;
    }

    // Sort: most visitas first
    result.sort((a, b) => b.totalVisitas - a.totalVisitas);
    return result;
  }, [visitas]);

  const toggleCorretor = (id: string) => {
    setCollapsedCorretores(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleDate = (key: string) => {
    setCollapsedDates(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (visitas.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma visita encontrada.</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map(c => {
        const corretorOpen = !collapsedCorretores.has(c.corretorId);
        const taxa = c.totalVisitas > 0 ? Math.round((c.realizadas / c.totalVisitas) * 100) : 0;

        return (
          <div key={c.corretorId} className="rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm">
            {/* Corretor header */}
            <button
              onClick={() => toggleCorretor(c.corretorId)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              {corretorOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}

              {/* Avatar */}
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0", c.color)}>
                {c.initials}
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-foreground">{c.nome}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {c.totalVisitas} visita{c.totalVisitas !== 1 ? "s" : ""} · {c.totalDias} dia{c.totalDias !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2 w-32 shrink-0">
                <Progress value={taxa} className="flex-1 h-2" />
                <span className={cn(
                  "text-xs font-bold",
                  taxa >= 80 ? "text-green-600" : taxa >= 50 ? "text-amber-600" : "text-red-600"
                )}>
                  {taxa}%
                </span>
              </div>
            </button>

            {/* Date sub-groups */}
            {corretorOpen && (
              <div>
                {c.dateGroups.map(dg => {
                  const dateKey = `${c.corretorId}-${dg.dateStr}`;
                  const dateOpen = !collapsedDates.has(dateKey);

                  return (
                    <div key={dg.dateStr}>
                      {/* Date sub-header */}
                      <button
                        onClick={() => toggleDate(dateKey)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-5 py-2 text-left transition-colors border-t border-border/30",
                          dg.isToday
                            ? "bg-blue-50"
                            : dg.isPast
                              ? "bg-muted/20"
                              : "bg-white"
                        )}
                      >
                        {dateOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}

                        <div className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          dg.isToday ? "bg-blue-500" : dg.isPast ? "bg-gray-400" : "bg-emerald-400"
                        )} />

                        <span className="text-xs font-semibold text-foreground">{dg.dayOfWeek}</span>
                        <span className="text-xs text-muted-foreground">{dg.label}</span>

                        {dg.isToday && (
                          <Badge className="bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-0 border-blue-300 shrink-0">
                            hoje
                          </Badge>
                        )}

                        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                          {dg.visitas.length} visita{dg.visitas.length !== 1 ? "s" : ""}
                          {dg.realizadas > 0 && <span className="text-green-600 ml-1">{dg.realizadas} ✅</span>}
                        </span>
                      </button>

                      {/* Rows */}
                      {dateOpen && (
                        <div className="divide-y divide-border/30 border-t border-border/20">
                          {dg.visitas.map(v => {
                            const isPastPending = dg.isPast && (v.status === "marcada" || v.status === "confirmada");
                            return (
                              <VisitaRow
                                key={v.id}
                                visita={v}
                                onUpdateStatus={onUpdateStatus}
                                onDelete={onDelete}
                                showCorretor={false}
                                isPastPending={isPastPending}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
