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

const STATUS_LINE_COLORS: Record<string, string> = {
  marcada: "bg-amber-400",
  confirmada: "bg-blue-500",
  realizada: "bg-green-500",
  reagendada: "bg-purple-500",
  cancelada: "bg-gray-400",
  no_show: "bg-red-500",
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
  const produto = [v.empreendimento, local].filter(Boolean).join(" • ");
  const responsavelInfo = (v as any).responsavel_visita ? RESPONSAVEL_LABELS[(v as any).responsavel_visita] : null;

  return (
    <div
      className={cn(
        "group flex items-stretch transition-colors hover:bg-accent/30",
        isPastPending && "bg-red-50/50 dark:bg-red-950/15"
      )}
    >
      {/* Status color bar — wider + rounded */}
      <div className={cn("w-1 shrink-0 rounded-r-sm", STATUS_LINE_COLORS[v.status] || "bg-gray-300")} />

      {/* Main content */}
      <div className="flex-1 flex items-center gap-4 px-4 py-2.5 min-w-0 border-b border-border/20">

        {/* 1️⃣ Time — prominent */}
        <span className="text-sm font-semibold font-mono text-foreground shrink-0 w-12 text-center tabular-nums tracking-tight">
          {v.hora_visita ? v.hora_visita.slice(0, 5) : "—"}
        </span>

        {/* 2️⃣ Client info stacked */}
        <div className="min-w-0 flex-1 space-y-0.5">
          {/* Name */}
          <p className="text-[13px] font-bold text-foreground truncate leading-tight">{v.nome_cliente}</p>

          {/* Phone + Product/local on the same line */}
          <div className="flex items-center gap-3 flex-wrap">
            {v.telefone && (
              <span className="text-[11px] text-foreground/60 font-medium truncate leading-snug">
                📞 {v.telefone}
              </span>
            )}
            {produto && (
              <span className="text-[11px] text-foreground/55 font-medium truncate leading-snug">
                🏢 {produto}
              </span>
            )}
          </div>

          {/* Negocio objetivo */}
          {isNegocio && negocioMeta.objetivo && (
            <p className="text-[10px] text-amber-600 font-semibold truncate leading-snug">🎯 {negocioMeta.objetivo}</p>
          )}

          {/* Observações */}
          {v.observacoes && !isNegocio && (
            <p className="text-[10px] text-muted-foreground/60 truncate leading-snug italic max-w-[300px]" title={v.observacoes}>
              💬 {v.observacoes}
            </p>
          )}
        </div>

        {/* 5️⃣ Corretor + 6️⃣ Team column */}
        {(showCorretor || showTeam) && (
          <div className="hidden md:flex flex-col items-start gap-0.5 shrink-0 min-w-0 w-[130px]">
            {showCorretor && v.corretor_nome && (
              <span className="text-[11px] font-semibold text-foreground/80 truncate w-full leading-snug">
                👤 {v.corretor_nome.split(" ").slice(0, 2).join(" ")}
              </span>
            )}
            {teamStyle && (
              <span className={cn("text-[10px] px-1.5 py-px rounded-full border whitespace-nowrap font-bold leading-snug", teamStyle.className)}>
                {teamStyle.emoji} {teamStyle.label}
              </span>
            )}
            {responsavelInfo && (
              <span className="text-[10px] text-muted-foreground/60 font-medium leading-snug">
                {responsavelInfo.emoji} {responsavelInfo.label}
              </span>
            )}
          </div>
        )}

        {/* 7️⃣ Status badge */}
        <div className="shrink-0 flex items-center gap-1.5">
          <Badge className={cn("text-[10px] px-2 py-0.5 border font-bold whitespace-nowrap", STATUS_BADGE_COLORS[v.status])}>
            {STATUS_EMOJIS[v.status]} {STATUS_LABELS[v.status]}
          </Badge>

          {/* Quick action buttons — on hover */}
          {(v.status === "marcada" || v.status === "confirmada") && (
            <div className="hidden group-hover:flex items-center gap-0.5">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded hover:bg-green-500/10" onClick={() => onUpdateStatus(v.id, "realizada")} title="Realizada">✅</Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded hover:bg-purple-500/10" onClick={() => onUpdateStatus(v.id, "reagendada")} title="Reagendada">🔄</Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded hover:bg-red-500/10" onClick={() => onUpdateStatus(v.id, "no_show")} title="No Show">❌</Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded hover:bg-muted" onClick={() => onUpdateStatus(v.id, "cancelada")} title="Cancelada">⚫</Button>
            </div>
          )}
        </div>

        {/* Menu — on hover */}
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
                  {STATUS_EMOJIS[k]} {label}
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
