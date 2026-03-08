import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, FileSpreadsheet, Trash2, ChevronDown, ChevronRight, ClipboardList, Phone } from "lucide-react";
import { format, isToday, isTomorrow, isThisWeek, isBefore, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_LABELS, STATUS_COLORS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import { useVisitaToPdn } from "@/hooks/useVisitaToPdn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STATUS_BADGE_COLORS: Record<string, string> = {
  marcada: "bg-amber-100 text-amber-700 border-amber-300",
  confirmada: "bg-blue-100 text-blue-700 border-blue-300",
  realizada: "bg-green-100 text-green-700 border-green-300",
  reagendada: "bg-purple-100 text-purple-700 border-purple-300",
  cancelada: "bg-gray-100 text-gray-600 border-gray-300",
  no_show: "bg-red-100 text-red-700 border-red-300",
};

const STATUS_EMOJIS: Record<string, string> = {
  marcada: "🟡", confirmada: "🔵", realizada: "✅", reagendada: "🔄", cancelada: "⚫", no_show: "❌",
};

const GROUP_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  today: { bg: "bg-blue-50", border: "border-l-4 border-l-blue-500", text: "text-blue-700" },
  tomorrow: { bg: "bg-gray-50", border: "border-l-4 border-l-gray-400", text: "text-gray-700" },
  thisWeek: { bg: "bg-muted/30", border: "border-l-4 border-l-muted-foreground/30", text: "text-muted-foreground" },
  future: { bg: "bg-muted/20", border: "border-l-4 border-l-muted-foreground/20", text: "text-muted-foreground" },
  past: { bg: "bg-red-50", border: "border-l-4 border-l-red-500", text: "text-red-700" },
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
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 13 && digits.startsWith("55")) return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  return phone;
}

export default function VisitasList({ visitas, onUpdateStatus, onEdit, onDelete, showCorretor }: Props) {
  const { convertToPdn } = useVisitaToPdn();
  const [showPast, setShowPast] = useState(true);
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

    // Past with pending status first (urgent)
    const pastPending = buckets.past.filter(v => v.status === "marcada" || v.status === "confirmada");
    const pastResolved = buckets.past.filter(v => v.status !== "marcada" && v.status !== "confirmada");
    if (pastPending.length) result.push({ label: `⚠️ PASSADAS SEM STATUS (${pastPending.length})`, key: "past", visitas: pastPending });
    if (buckets.today.length) result.push({ label: `HOJE — ${format(today, "dd/MM", { locale: ptBR })} (${buckets.today.length} visita${buckets.today.length > 1 ? "s" : ""})`, key: "today", visitas: buckets.today });
    if (buckets.tomorrow.length) result.push({ label: `AMANHÃ — ${format(tomorrow, "dd/MM", { locale: ptBR })} (${buckets.tomorrow.length} visita${buckets.tomorrow.length > 1 ? "s" : ""})`, key: "tomorrow", visitas: buckets.tomorrow });
    if (buckets.thisWeek.length) result.push({ label: `ESTA SEMANA (${buckets.thisWeek.length})`, key: "thisWeek", visitas: buckets.thisWeek });
    if (buckets.future.length) result.push({ label: `PRÓXIMAS (${buckets.future.length})`, key: "future", visitas: buckets.future });
    if (pastResolved.length) result.push({ label: `PASSADAS RESOLVIDAS (${pastResolved.length})`, key: "pastResolved", visitas: pastResolved });

    return result;
  }, [visitas]);

  if (visitas.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma visita encontrada.</p>;
  }

  const renderRow = (v: Visita) => {
    const hasPdn = !!(v as any).linked_pdn_id;
    const isHovered = hoveredId === v.id;
    const d = new Date(v.data_visita + "T12:00:00");
    const isPastPending = isBefore(d, startOfDay(new Date())) && (v.status === "marcada" || v.status === "confirmada");

    return (
      <div
        key={v.id}
        className={cn(
          "group flex items-center gap-3 px-4 py-3 border-b border-border/50 transition-colors hover:bg-muted/30",
          isPastPending && "bg-red-50/50"
        )}
        onMouseEnter={() => setHoveredId(v.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        {/* Time */}
        <div className="w-14 shrink-0 text-center">
          <span className="text-sm font-bold font-mono text-foreground">
            {v.hora_visita ? v.hora_visita.slice(0, 5) : "—"}
          </span>
        </div>

        {/* Client + Phone */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{v.nome_cliente}</p>
          {v.telefone && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {formatPhone(v.telefone)}
            </p>
          )}
        </div>

        {/* Empreendimento */}
        <div className="w-32 shrink-0 hidden sm:block">
          <span className="text-xs text-muted-foreground truncate block">{v.empreendimento || "—"}</span>
        </div>

        {/* Corretor */}
        {showCorretor && (
          <div className="w-28 shrink-0 hidden md:block">
            <span className="text-xs text-muted-foreground truncate block">{v.corretor_nome || "—"}</span>
          </div>
        )}

        {/* Status badge */}
        <div className="w-24 shrink-0">
          <Badge className={cn("text-[10px] px-2 py-0.5 border font-semibold", STATUS_BADGE_COLORS[v.status] || "bg-muted text-muted-foreground")}>
            {STATUS_EMOJIS[v.status]} {STATUS_LABELS[v.status]}
          </Badge>
        </div>

        {/* Inline quick actions */}
        <div className={cn("flex items-center gap-1 shrink-0 transition-opacity", isHovered ? "opacity-100" : "opacity-0")}>
          {(v.status === "marcada" || v.status === "confirmada") && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 gap-1 border-green-300 text-green-700 hover:bg-green-50" onClick={() => onUpdateStatus(v.id, "realizada")}>
                ✅ Realizada
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 gap-1 border-red-300 text-red-700 hover:bg-red-50" onClick={() => onUpdateStatus(v.id, "no_show")}>
                ❌ No Show
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 gap-1 border-purple-300 text-purple-700 hover:bg-purple-50" onClick={() => onUpdateStatus(v.id, "reagendada")}>
                🔄 Reagendar
              </Button>
            </>
          )}
          {v.status === "realizada" && !hasPdn && (
            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 text-primary border-primary/30" onClick={() => convertToPdn(v)}>
              <FileSpreadsheet className="h-3 w-3 mr-0.5" /> PDN
            </Button>
          )}
        </div>

        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            {Object.entries(STATUS_LABELS)
              .filter(([k]) => k !== v.status)
              .map(([k, label]) => (
                <DropdownMenuItem key={k} onClick={() => onUpdateStatus(v.id, k as VisitaStatus)} className="text-xs">
                  {STATUS_EMOJIS[k]} {label}
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
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {groups.map(group => {
          const style = GROUP_STYLES[group.key] || GROUP_STYLES.future;
          const isPastResolved = group.key === "pastResolved";

          if (isPastResolved && !showPast) {
            return (
              <button
                key={group.key}
                onClick={() => setShowPast(true)}
                className="w-full flex items-center gap-2 py-2 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                Ver {group.visitas.length} visitas passadas resolvidas
              </button>
            );
          }

          return (
            <div key={group.key} className="overflow-hidden">
              {/* Group header */}
              <div className={cn(
                "flex items-center gap-2 py-2 px-4 text-[11px] font-bold uppercase tracking-wider rounded-t-lg",
                style.bg, style.border, style.text
              )}>
                {isPastResolved && (
                  <button onClick={() => setShowPast(false)} className="hover:text-foreground">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                )}
                {group.label}
              </div>

              {/* Rows */}
              <div className="rounded-b-lg border border-t-0 border-border/50 bg-card">
                {group.visitas.map(renderRow)}
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
