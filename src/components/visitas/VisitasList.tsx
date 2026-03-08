import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, FileSpreadsheet, CheckCircle2, Trash2, Phone, Eye, ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { format, isToday, isTomorrow, isThisWeek, isBefore, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_LABELS, STATUS_COLORS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import { useVisitaToPdn } from "@/hooks/useVisitaToPdn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const BORDER_COLORS: Record<string, string> = {
  marcada: "border-l-blue-500",
  confirmada: "border-l-emerald-500",
  realizada: "border-l-gray-400",
  reagendada: "border-l-amber-500",
  cancelada: "border-l-red-400",
  no_show: "border-l-red-700",
};

interface Props {
  visitas: Visita[];
  onUpdateStatus: (id: string, status: VisitaStatus) => void;
  onEdit?: (visita: Visita) => void;
  onDelete?: (id: string) => void;
  showCorretor?: boolean;
}

interface TemporalGroup {
  label: string;
  key: string;
  visitas: Visita[];
  collapsible?: boolean;
}

export default function VisitasList({ visitas, onUpdateStatus, onEdit, onDelete, showCorretor }: Props) {
  const { convertToPdn } = useVisitaToPdn();
  const [showPast, setShowPast] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const result: TemporalGroup[] = [];
    const buckets: Record<string, Visita[]> = {
      past: [], today: [], tomorrow: [], thisWeek: [], future: [],
    };

    for (const v of visitas) {
      const d = new Date(v.data_visita + "T12:00:00");
      if (isBefore(d, today)) buckets.past.push(v);
      else if (isToday(d)) buckets.today.push(v);
      else if (isTomorrow(d)) buckets.tomorrow.push(v);
      else if (isThisWeek(d, { weekStartsOn: 1 })) buckets.thisWeek.push(v);
      else buckets.future.push(v);
    }

    if (buckets.today.length) result.push({ label: `HOJE — ${format(today, "dd/MM", { locale: ptBR })}`, key: "today", visitas: buckets.today });
    if (buckets.tomorrow.length) result.push({ label: `AMANHÃ — ${format(tomorrow, "dd/MM", { locale: ptBR })}`, key: "tomorrow", visitas: buckets.tomorrow });
    if (buckets.thisWeek.length) result.push({ label: "ESTA SEMANA", key: "thisWeek", visitas: buckets.thisWeek });
    if (buckets.future.length) result.push({ label: "PRÓXIMAS", key: "future", visitas: buckets.future });
    if (buckets.past.length) result.push({ label: `PASSADAS (${buckets.past.length})`, key: "past", visitas: buckets.past, collapsible: true });

    return result;
  }, [visitas]);

  if (visitas.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma visita encontrada.</p>;
  }

  const getDateLabel = (v: Visita) => {
    const d = new Date(v.data_visita + "T12:00:00");
    const today = startOfDay(new Date());
    if (isToday(d)) return null; // group header shows it
    if (isTomorrow(d)) return null;
    if (isBefore(d, today) && (v.status === "marcada" || v.status === "confirmada")) {
      return { text: "⚠️ Pendente", className: "bg-destructive/10 text-destructive border-destructive/20" };
    }
    return null;
  };

  const renderRow = (v: Visita) => {
    const hasPdn = !!(v as any).linked_pdn_id;
    const isHovered = hoveredId === v.id;
    const d = new Date(v.data_visita + "T12:00:00");
    const isPastPending = isBefore(d, startOfDay(new Date())) && (v.status === "marcada" || v.status === "confirmada");
    const urgency = getDateLabel(v);

    return (
      <tr
        key={v.id}
        className={cn(
          "group border-b border-border/50 transition-colors border-l-[3px]",
          BORDER_COLORS[v.status] || "border-l-transparent",
          isToday(d) && "bg-primary/[0.03]",
          isPastPending && "bg-destructive/[0.03]",
          "hover:bg-muted/40"
        )}
        onMouseEnter={() => setHoveredId(v.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        {/* Cliente */}
        <td className="py-2 px-3">
          <p className="text-xs font-semibold text-foreground leading-tight">{v.nome_cliente}</p>
          {v.telefone && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{v.telefone}</p>
          )}
        </td>

        {/* Corretor */}
        {showCorretor && (
          <td className="py-2 px-3">
            <span className="text-[11px] text-muted-foreground">{v.corretor_nome || "—"}</span>
          </td>
        )}

        {/* Empreendimento */}
        <td className="py-2 px-3">
          <span className="text-[11px] text-muted-foreground">{v.empreendimento || "—"}</span>
        </td>

        {/* Data/Hora */}
        <td className="py-2 px-3 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-foreground">
              {format(d, "dd/MM", { locale: ptBR })}
            </span>
            {v.hora_visita && (
              <span className="text-[11px] text-muted-foreground">{v.hora_visita.slice(0, 5)}</span>
            )}
            {urgency && (
              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 ml-1", urgency.className)}>
                {urgency.text}
              </Badge>
            )}
          </div>
        </td>

        {/* Status */}
        <td className="py-2 px-3">
          <div className="flex items-center gap-1">
            <Badge className={cn("text-[10px] px-1.5 py-0 h-5", STATUS_COLORS[v.status])}>
              {STATUS_LABELS[v.status]}
            </Badge>
            {hasPdn && (
              <Tooltip>
                <TooltipTrigger><ClipboardList className="h-3.5 w-3.5 text-emerald-600" /></TooltipTrigger>
                <TooltipContent><p className="text-xs">Vinculado ao PDN</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </td>

        {/* Inline actions + menu */}
        <td className="py-2 px-2 text-right whitespace-nowrap">
          <div className={cn("flex items-center justify-end gap-1 transition-opacity", isHovered ? "opacity-100" : "opacity-0")}>
            {/* Contextual quick actions */}
            {v.status === "marcada" && (
              <>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onUpdateStatus(v.id, "confirmada")}>
                  ✅ Confirmar
                </Button>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onUpdateStatus(v.id, "no_show")}>
                  No Show
                </Button>
              </>
            )}
            {v.status === "confirmada" && (
              <>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onUpdateStatus(v.id, "realizada")}>
                  ✓ Realizada
                </Button>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onUpdateStatus(v.id, "no_show")}>
                  No Show
                </Button>
              </>
            )}
            {v.status === "realizada" && !hasPdn && (
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-primary border-primary/30" onClick={() => convertToPdn(v)}>
                <FileSpreadsheet className="h-3 w-3 mr-0.5" /> PDN
              </Button>
            )}
          </div>
          {/* Always visible menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className={cn("h-6 w-6 p-0 inline-flex", isHovered ? "" : "")}>
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              {Object.entries(STATUS_LABELS)
                .filter(([k]) => k !== v.status)
                .map(([k, label]) => (
                  <DropdownMenuItem key={k} onClick={() => onUpdateStatus(v.id, k as VisitaStatus)} className="text-xs">
                    {label}
                  </DropdownMenuItem>
                ))}
              {v.status === "realizada" && !hasPdn && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => convertToPdn(v)} className="text-xs text-primary">
                    <FileSpreadsheet className="h-3 w-3 mr-1.5" /> Enviar para PDN
                  </DropdownMenuItem>
                </>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { if (window.confirm("Tem certeza?")) onDelete(v.id); }}
                    className="text-xs text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-1.5" /> Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-1">
        {groups.map(group => {
          const isPast = group.key === "past";
          if (isPast && !showPast) {
            return (
              <button
                key={group.key}
                onClick={() => setShowPast(true)}
                className="w-full flex items-center gap-2 py-2 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                Ver {group.visitas.length} visitas passadas
              </button>
            );
          }

          return (
            <div key={group.key}>
              {/* Sticky group header */}
              <div className={cn(
                "sticky top-0 z-10 flex items-center gap-2 py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider border-b",
                group.key === "today" ? "bg-primary/5 text-primary border-primary/20" :
                group.key === "tomorrow" ? "bg-amber-500/5 text-amber-600 border-amber-500/20" :
                isPast ? "bg-muted/50 text-muted-foreground border-border" :
                "bg-muted/30 text-muted-foreground border-border"
              )}>
                {isPast && (
                  <button onClick={() => setShowPast(false)} className="hover:text-foreground">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                )}
                {group.label}
              </div>

              <div className="rounded-lg border border-border/50 overflow-hidden mb-2">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/50">
                      <th className="text-[10px] font-semibold text-muted-foreground uppercase text-left py-1.5 px-3 w-[22%]">Cliente</th>
                      {showCorretor && <th className="text-[10px] font-semibold text-muted-foreground uppercase text-left py-1.5 px-3 w-[14%]">Corretor</th>}
                      <th className="text-[10px] font-semibold text-muted-foreground uppercase text-left py-1.5 px-3 w-[16%]">Empreendimento</th>
                      <th className="text-[10px] font-semibold text-muted-foreground uppercase text-left py-1.5 px-3 w-[14%]">Data/Hora</th>
                      <th className="text-[10px] font-semibold text-muted-foreground uppercase text-left py-1.5 px-3 w-[14%]">Status</th>
                      <th className="text-[10px] font-semibold text-muted-foreground uppercase text-right py-1.5 px-3 w-[20%]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.visitas.map(renderRow)}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
