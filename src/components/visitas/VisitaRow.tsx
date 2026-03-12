import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Pencil, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import { useState } from "react";

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
  stand: "Stand",
  empresa: "Escritório",
  videochamada: "Videochamada",
  decorado: "Decorado",
  cartorio: "Cartório",
  outro: "Outro",
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

/** Column header for the list view */
export function VisitaRowHeader({ showCorretor, showTeam }: { showCorretor?: boolean; showTeam?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 bg-muted/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
      <span className="w-14 text-center shrink-0">Hora</span>
      <span className="w-1 shrink-0" />
      <span style={{ width: "clamp(100px, 16%, 180px)" }} className="shrink-0">Cliente</span>
      <span style={{ width: "clamp(90px, 14%, 150px)" }} className="shrink-0 hidden md:block">Produto</span>
      <span style={{ width: "clamp(70px, 10%, 110px)" }} className="shrink-0 hidden md:block">Local</span>
      {showCorretor && <span style={{ width: "clamp(90px, 13%, 140px)" }} className="shrink-0 hidden lg:block">Corretor</span>}
      {showTeam && <span style={{ width: "clamp(70px, 10%, 100px)" }} className="shrink-0 hidden lg:block">Time</span>}
      {(showCorretor || showTeam) && <span style={{ width: "clamp(80px, 10%, 110px)" }} className="shrink-0 hidden lg:block">Responsável</span>}
      <span className="flex-1" />
      <span className="text-right shrink-0">Status / Ações</span>
      <span className="w-7 shrink-0" />
    </div>
  );
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

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-3.5 transition-all hover:bg-accent/30",
        isPastPending && "bg-red-50/60 dark:bg-red-950/20"
      )}
    >
      {/* Hora */}
      <span className="text-[13px] font-black font-mono text-foreground shrink-0 w-14 text-center tracking-tight">
        {v.hora_visita ? v.hora_visita.slice(0, 5) : "—"}
      </span>

      {/* Status color line */}
      <div className={cn("w-[3px] h-9 rounded-full shrink-0", STATUS_LINE_COLORS[v.status] || "bg-gray-300")} />

      {/* Cliente */}
      <div className="min-w-0 shrink-0" style={{ width: "clamp(100px, 16%, 180px)" }}>
        <p className="text-[13px] font-bold text-foreground truncate leading-tight tracking-tight">{v.nome_cliente}</p>
        {v.telefone && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-medium">
            <span className="opacity-60">📞</span> {v.telefone}
          </p>
        )}
        {v.observacoes && !isNegocio && (
          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5 italic max-w-[180px]" title={v.observacoes}>
            💬 {v.observacoes}
          </p>
        )}
      </div>

      {/* Produto (Empreendimento) */}
      <div className="hidden md:block min-w-0 shrink-0" style={{ width: "clamp(90px, 14%, 150px)" }}>
        <p className="text-xs font-semibold text-foreground/70 truncate">
          🏢 {v.empreendimento || <span className="text-muted-foreground/50 font-normal">—</span>}
        </p>
        {isNegocio && negocioMeta.objetivo && (
          <p className="text-[10px] text-amber-600 font-semibold truncate mt-0.5">🎯 {negocioMeta.objetivo}</p>
        )}
      </div>

      {/* Local da Visita */}
      <div className="hidden md:block min-w-0 shrink-0" style={{ width: "clamp(70px, 10%, 110px)" }}>
        <p className="text-xs text-muted-foreground truncate font-medium">
          📍 {LOCAL_LABELS[v.local_visita || ""] || v.local_visita || "—"}
        </p>
      </div>

      {/* Corretor */}
      {showCorretor && (
        <div className="hidden lg:block min-w-0 shrink-0" style={{ width: "clamp(90px, 13%, 140px)" }}>
          <p className="text-xs font-semibold text-foreground truncate">
            👤 {v.corretor_nome?.split(" ").slice(0, 2).join(" ") || "—"}
          </p>
        </div>
      )}

      {/* Time */}
      {showTeam && (
        <div className="hidden lg:flex items-center min-w-0 shrink-0" style={{ width: "clamp(70px, 10%, 100px)" }}>
          {teamStyle ? (
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap font-bold", teamStyle.className)}>
              {teamStyle.emoji} {teamStyle.label}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}
        </div>
      )}

      {/* Responsável */}
      {(showCorretor || showTeam) && (
        <div className="hidden lg:flex items-center min-w-0 shrink-0" style={{ width: "clamp(80px, 10%, 110px)" }}>
          {(v as any).responsavel_visita ? (
            <span className="text-[11px] font-semibold text-foreground whitespace-nowrap">
              {RESPONSAVEL_LABELS[(v as any).responsavel_visita]?.emoji || "👤"}{" "}
              {RESPONSAVEL_LABELS[(v as any).responsavel_visita]?.label || (v as any).responsavel_visita}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Status badge + inline action buttons */}
      <div className="shrink-0 flex items-center gap-1.5 justify-end">
        <Badge className={cn("text-[10px] px-2.5 py-0.5 border font-bold whitespace-nowrap shadow-sm", STATUS_BADGE_COLORS[v.status] || "bg-muted text-muted-foreground")}>
          {STATUS_EMOJIS[v.status]} {STATUS_LABELS[v.status]}
        </Badge>

        {(v.status === "marcada" || v.status === "confirmada") && (
          <>
            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 border-green-300 text-green-700 hover:bg-green-50 rounded-lg font-bold shadow-sm" onClick={() => onUpdateStatus(v.id, "realizada")} title="Realizada">✅</Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 border-purple-300 text-purple-700 hover:bg-purple-50 rounded-lg font-bold shadow-sm" onClick={() => onUpdateStatus(v.id, "reagendada")} title="Reagendada">🔄</Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 border-red-300 text-red-700 hover:bg-red-50 rounded-lg font-bold shadow-sm" onClick={() => onUpdateStatus(v.id, "no_show")} title="No Show">❌</Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg font-bold shadow-sm" onClick={() => onUpdateStatus(v.id, "cancelada")} title="Cancelada">⚫</Button>
          </>
        )}
      </div>

      {/* Menu */}
      <div className="shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
