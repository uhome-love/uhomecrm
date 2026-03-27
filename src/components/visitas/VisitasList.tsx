import { useMemo, useState } from "react";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import VisitaRow from "./VisitaRow";
import { EmptyState } from "@/components/ui/EmptyState";

interface Props {
  visitas: Visita[];
  onUpdateStatus: (id: string, status: VisitaStatus) => void;
  onEdit?: (visita: Visita) => void;
  onDelete?: (id: string) => void;
  showCorretor?: boolean;
  showTeam?: boolean;
  mode?: "upcoming" | "past" | "all";
}

interface DateGroup {
  dateStr: string;
  label: string;
  dayOfWeek: string;
  isToday: boolean;
  isPast: boolean;
  visitas: Visita[];
  realizadas: number;
  total: number;
}

/** Merge visits that share nome_cliente + data_visita + hora_visita into one entry */
function mergeSharedVisits(visitas: Visita[]): Visita[] {
  const keyMap = new Map<string, Visita[]>();

  for (const v of visitas) {
    const key = `${v.nome_cliente?.toLowerCase().trim()}|${v.data_visita}|${v.hora_visita || ""}`;
    if (!keyMap.has(key)) keyMap.set(key, []);
    keyMap.get(key)!.push(v);
  }

  const merged: Visita[] = [];
  for (const group of keyMap.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
    } else {
      // Use the first as primary, attach partner names
      const primary = { ...group[0] };
      const parceiros = group
        .filter((_, i) => i > 0)
        .map(v => v.corretor_nome || "Corretor")
        .filter(Boolean);
      const allNames = [primary.corretor_nome || "Corretor", ...parceiros];
      (primary as any)._compartilhada = true;
      (primary as any)._parceiros = allNames;
      (primary as any)._allIds = group.map(v => v.id);
      merged.push(primary);
    }
  }

  return merged;
}

function buildGroups(visitas: Visita[]): DateGroup[] {
  const today = startOfDay(new Date());
  const deduped = mergeSharedVisits(visitas);
  const map = new Map<string, Visita[]>();

  for (const v of deduped) {
    const key = v.data_visita;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(v);
  }

  const result: DateGroup[] = [];
  for (const [dateStr, vs] of map) {
    const d = new Date(dateStr + "T12:00:00");
    const realizadas = vs.filter(v => v.status === "realizada").length;
    vs.sort((a, b) => (a.hora_visita || "99:99").localeCompare(b.hora_visita || "99:99"));

    result.push({
      dateStr,
      label: format(d, "dd 'de' MMMM", { locale: ptBR }),
      dayOfWeek: format(d, "EEEE", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
      isToday: isToday(d),
      isPast: isBefore(d, today) && !isToday(d),
      visitas: vs,
      realizadas,
      total: vs.length,
    });
  }

  return result;
}

function DateGroupCard({
  g, isOpen, onToggle, showCorretor, showTeam, onUpdateStatus, onEdit, onDelete,
}: {
  g: DateGroup;
  isOpen: boolean;
  onToggle: () => void;
  showCorretor?: boolean;
  showTeam?: boolean;
  onUpdateStatus: (id: string, status: VisitaStatus) => void;
  onEdit?: (visita: Visita) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className={cn(
      "rounded-[12px] border overflow-hidden bg-white dark:bg-[#141e30]",
      g.isToday ? "border-[#4F46E5]/30" : "border-[#e8e8f0] dark:border-white/10"
    )}>
      {/* Day header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors",
          g.isToday
            ? "bg-[#4F46E5]/5 hover:bg-[#4F46E5]/8"
            : g.isPast
              ? "bg-[#f7f7fb] dark:bg-white/3 hover:bg-[#f0f0f5]"
              : "hover:bg-[#f7f7fb] dark:hover:bg-white/3"
        )}
      >
        {isOpen
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#a1a1aa]" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#a1a1aa]" />
        }

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn(
            "text-[13px] font-bold tracking-[-0.2px]",
            g.isToday ? "text-[#0a0a0a] dark:text-white" : g.isPast ? "text-[#71717a]" : "text-[#0a0a0a] dark:text-white"
          )}>
            {g.dayOfWeek}
          </span>
          <span className="text-[12px] text-[#a1a1aa]">· {g.label}</span>
          {g.isToday && (
            <span className="text-[10px] font-bold bg-[#4F46E5] text-white px-2 py-0.5 rounded-full">
              HOJE
            </span>
          )}
        </div>

        <span className="text-[11px] text-[#a1a1aa] shrink-0">
          {g.total} visita{g.total !== 1 ? "s" : ""}
          {g.realizadas > 0 && <span className="text-[#10b981] font-semibold ml-1.5">· {g.realizadas} realizada{g.realizadas !== 1 ? "s" : ""}</span>}
        </span>
      </button>

      {/* Visitas */}
      {isOpen && (
        <div>
          {g.visitas.map(v => {
            const isPastPending = g.isPast && (v.status === "marcada" || v.status === "confirmada");
            return (
              <VisitaRow
                key={v.id}
                visita={v}
                onUpdateStatus={onUpdateStatus}
                onEdit={onEdit}
                onDelete={onDelete}
                showCorretor={showCorretor}
                showTeam={showTeam}
                isPastPending={isPastPending}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function VisitasList({ visitas, onUpdateStatus, onEdit, onDelete, showCorretor, showTeam, mode = "upcoming" }: Props) {
  const displayGroups = useMemo(() => {
    const groups = buildGroups(visitas);
    if (mode === "past") {
      return groups.filter(g => g.isPast).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    }
    if (mode === "all") {
      return groups.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    }
    return groups.filter(g => !g.isPast).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [visitas, mode]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const groups = buildGroups(visitas);
    for (const g of groups) {
      if (g.isPast) initial.add(g.dateStr);
    }
    return initial;
  });

  const toggle = (dateStr: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr);
      return next;
    });
  };

  if (displayGroups.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays size={22} strokeWidth={1.5} />}
        title="Nenhuma visita neste período"
        description="As visitas agendadas aparecerão aqui organizadas por dia"
      />
    );
  }

  return (
    <div className="space-y-2">
      {displayGroups.map(g => (
        <DateGroupCard
          key={g.dateStr}
          g={g}
          isOpen={!collapsed.has(g.dateStr)}
          onToggle={() => toggle(g.dateStr)}
          showCorretor={showCorretor}
          showTeam={showTeam}
          onUpdateStatus={onUpdateStatus}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
