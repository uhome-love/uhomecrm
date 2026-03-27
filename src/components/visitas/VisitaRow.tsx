import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Pencil, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";

function addToCalendar(v: Visita) {
  const dateStr = v.data_visita.replace(/-/g, "");
  const time = v.hora_visita ? v.hora_visita.replace(":", "") : "1000";
  const startDT = `${dateStr}T${time.padEnd(4, "0")}00`;
  const h = parseInt(time.slice(0, 2), 10);
  const m = time.slice(2, 4);
  const endH = String(h + 1).padStart(2, "0");
  const endDT = `${dateStr}T${endH}${m}00`;
  const local = v.local_visita
    ? ({ stand: "Stand do empreendimento", empresa: "Escritório", videochamada: "Videochamada", decorado: "Apartamento decorado", outro: "" }[v.local_visita] || v.local_visita)
    : "";
  const location = [local, v.empreendimento].filter(Boolean).join(" - ");
  const title = `Visita: ${v.nome_cliente}`;
  const details = [v.telefone && `Tel: ${v.telefone}`, v.observacoes].filter(Boolean).join("\\n");
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIOS) {
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `DTSTART:${startDT}`, `DTEND:${endDT}`, `SUMMARY:${title}`, `LOCATION:${location}`, `DESCRIPTION:${details.replace(/\n/g, "\\n")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visita-${v.nome_cliente.replace(/\s+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const gcUrl = new URL("https://calendar.google.com/calendar/render");
    gcUrl.searchParams.set("action", "TEMPLATE");
    gcUrl.searchParams.set("text", title);
    gcUrl.searchParams.set("dates", `${startDT}/${endDT}`);
    gcUrl.searchParams.set("details", details);
    if (location) gcUrl.searchParams.set("location", location);
    window.open(gcUrl.toString(), "_blank");
  }
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  marcada: "text-[#f59e0b] bg-[#fffbeb] border-[#fde68a]",
  confirmada: "text-[#3b82f6] bg-[#eff6ff] border-[#bfdbfe]",
  realizada: "text-[#10b981] bg-[#f0fdf4] border-[#bbf7d0]",
  reagendada: "text-[#6366f1] bg-[#eef2ff] border-[#c7d2fe]",
  cancelada: "text-[#52525b] bg-[#f7f7fb] border-[#e8e8f0]",
  no_show: "text-[#ef4444] bg-[#fef2f2] border-[#fecaca]",
};

const STATUS_LINE_COLORS: Record<string, string> = {
  marcada: "bg-[#f59e0b]",
  confirmada: "bg-[#3b82f6]",
  realizada: "bg-[#10b981]",
  reagendada: "bg-[#6366f1]",
  cancelada: "bg-[#71717a]",
  no_show: "bg-[#ef4444]",
};

const LOCAL_LABELS: Record<string, string> = {
  stand: "Stand", empresa: "Escritório", videochamada: "Videochamada",
  decorado: "Decorado", cartorio: "Cartório", outro: "Outro",
};

const RESPONSAVEL_LABELS: Record<string, { label: string; emoji: string }> = {
  gerente: { label: "Gerente", emoji: "👔" },
  proprio_corretor: { label: "Corretor", emoji: "👤" },
  corretor_parceiro: { label: "Parceiro", emoji: "🤝" },
  responsavel_construtora: { label: "Construtora", emoji: "🏗️" },
};

const TEAM_BADGE_STYLES: Record<string, { emoji: string; className: string }> = {
  gabrielle: { emoji: "🟢", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  bruno: { emoji: "🔵", className: "bg-blue-50 text-blue-700 border-blue-200" },
  gabriel: { emoji: "🟣", className: "bg-purple-50 text-purple-700 border-purple-200" },
};

export function getTeamBadgeStyle(equipe?: string) {
  if (!equipe) return null;
  const key = equipe.toLowerCase().replace(/^equipe\s+/i, "").trim();
  for (const [name, style] of Object.entries(TEAM_BADGE_STYLES)) {
    if (key.includes(name)) return { ...style, label: key.charAt(0).toUpperCase() + key.slice(1) };
  }
  return { emoji: "⚪", className: "bg-muted text-muted-foreground border-border", label: equipe };
}

function parseNegocioMeta(obs: string | null) {
  if (!obs) return { objetivo: null, responsavel: null };
  const parts = obs.split("|").map(s => s.trim());
  let objetivo: string | null = null;
  let responsavel: string | null = null;
  for (const p of parts) {
    if (p.startsWith("Objetivo:")) objetivo = p.replace("Objetivo:", "").trim();
    if (p.startsWith("Responsável:")) responsavel = p.replace("Responsável:", "").trim();
  }
  return { objetivo, responsavel };
}

/** Column header — hidden now, kept for backward compat */
export function VisitaRowHeader({ showCorretor, showTeam }: { showCorretor?: boolean; showTeam?: boolean }) {
  return null;
}

interface Props {
  visita: Visita;
  onUpdateStatus: (id: string, status: VisitaStatus) => void;
  onEdit?: (visita: Visita) => void;
  onDelete?: (id: string) => void;
  showCorretor?: boolean;
  showTeam?: boolean;
  isPastPending?: boolean;
}

export default function VisitaRow({ visita: v, onUpdateStatus, onEdit, onDelete, showCorretor, showTeam, isPastPending }: Props) {
  const isNegocio = v.tipo === "negocio";
  const negocioMeta = isNegocio ? parseNegocioMeta(v.observacoes) : { objetivo: null, responsavel: null };
  const teamStyle = showTeam ? getTeamBadgeStyle(v.equipe) : null;
  const local = LOCAL_LABELS[v.local_visita || ""] || v.local_visita || "";
  const produto = [v.empreendimento, local].filter(Boolean).join(" · ");
  const responsavelInfo = (v as any).responsavel_visita ? RESPONSAVEL_LABELS[(v as any).responsavel_visita] : null;
  const isCompartilhada = (v as any)._compartilhada === true;
  const parceiros: string[] = (v as any)._parceiros || [];

  return (
    <div
      className={cn(
        "group flex items-stretch transition-colors hover:bg-[#f7f7fb] dark:hover:bg-white/3",
        isPastPending && "bg-[#fef2f2]/50 dark:bg-red-950/15"
      )}
    >
      {/* Status color bar */}
      <div className={cn("w-1 shrink-0", STATUS_LINE_COLORS[v.status] || "bg-[#71717a]")} />

      {/* Main content */}
      <div className="flex-1 flex items-center gap-4 px-4 py-2.5 min-w-0 border-b border-[#e8e8f0]/50 dark:border-white/5">

        {/* Time */}
        <span className="text-[13px] font-bold text-[#0a0a0a] dark:text-white shrink-0 w-10 tabular-nums">
          {v.hora_visita ? v.hora_visita.slice(0, 5) : "—"}
        </span>

        {/* Client info */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-semibold text-[#0a0a0a] dark:text-white truncate leading-tight">{v.nome_cliente}</p>
            {isCompartilhada && (
              <span className="shrink-0 text-[9px] font-bold bg-[#6366f1]/10 text-[#6366f1] px-1.5 py-0.5 rounded-full border border-[#6366f1]/20" title={`Compartilhada: ${parceiros.join(" + ")}`}>
                🤝 Compartilhada
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {v.telefone && (
              <span className="text-[11px] text-[#a1a1aa]">{v.telefone}</span>
            )}
            {v.telefone && produto && <span className="text-[#e8e8f0]">·</span>}
            {produto && (
              <span className="text-[11px] text-[#52525b] dark:text-[#a1a1aa]">{produto}</span>
            )}
          </div>
          {isCompartilhada && parceiros.length > 0 && (
            <p className="text-[10px] text-[#6366f1] font-medium truncate">
              👥 {parceiros.join(" + ")}
            </p>
          )}
          {isNegocio && negocioMeta.objetivo && (
            <p className="text-[10px] text-amber-600 font-semibold truncate">🎯 {negocioMeta.objetivo}</p>
          )}
          {v.observacoes && !isNegocio && (
            <p className="text-[10px] text-[#a1a1aa] truncate italic max-w-[300px]" title={v.observacoes}>
              {v.observacoes}
            </p>
          )}
        </div>

        {/* Corretor + Team */}
        {(showCorretor || showTeam) && (
          <div className="flex flex-col items-end gap-0.5 shrink-0 min-w-0 w-[130px]">
            {showCorretor && v.corretor_nome && (
              <span className="text-[11px] text-[#52525b] dark:text-[#a1a1aa] truncate w-full text-right">
                {v.corretor_nome.split(" ").slice(0, 2).join(" ")}
              </span>
            )}
            {teamStyle && (
              <span className={cn("text-[10px] px-1.5 py-px rounded-full border whitespace-nowrap font-bold", teamStyle.className)}>
                {teamStyle.emoji} {teamStyle.label}
              </span>
            )}
            {responsavelInfo && (
              <span className="text-[10px] text-[#a1a1aa]">
                {responsavelInfo.emoji} {responsavelInfo.label}
              </span>
            )}
          </div>
        )}

        {/* Status badge */}
        <div className="shrink-0 flex items-center gap-1.5">
          <span className={cn(
            "text-[11px] font-semibold px-3 py-1 rounded-[7px] border whitespace-nowrap",
            STATUS_BADGE_STYLES[v.status] || "text-[#52525b] bg-[#f7f7fb] border-[#e8e8f0]"
          )}>
            {STATUS_LABELS[v.status]}
          </span>

          {/* Quick actions on hover */}
          {(v.status === "marcada" || v.status === "confirmada") && (
            <div className="hidden group-hover:flex items-center gap-0.5">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded hover:bg-[#10b981]/10" onClick={() => onUpdateStatus(v.id, "realizada")} title="Realizada">✅</Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded hover:bg-[#6366f1]/10" onClick={() => onUpdateStatus(v.id, "reagendada")} title="Reagendada">🔄</Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded hover:bg-[#ef4444]/10" onClick={() => onUpdateStatus(v.id, "no_show")} title="No Show">❌</Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded hover:bg-[#f7f7fb]" onClick={() => onUpdateStatus(v.id, "cancelada")} title="Cancelada">⚫</Button>
            </div>
          )}
        </div>

        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(v)} className="text-xs">
                <Pencil className="h-3 w-3 mr-1.5" /> Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => addToCalendar(v)} className="text-xs">
              <CalendarPlus className="h-3 w-3 mr-1.5" /> Adicionar ao Calendário
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {Object.entries(STATUS_LABELS)
              .filter(([k]) => k !== v.status)
              .map(([k, label]) => (
                <DropdownMenuItem key={k} onClick={() => onUpdateStatus(v.id, k as VisitaStatus)} className="text-xs">
                  {label}
                </DropdownMenuItem>
              ))}
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
    </div>
  );
}
