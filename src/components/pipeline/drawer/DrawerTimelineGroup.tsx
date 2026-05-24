// ─────────────────────────────────────────────────────────────────
// DrawerTimelineGroup — agrupamento de eventos por dia (v4)
//
// Cabeçalho do dia ("HOJE" / "ONTEM" / weekday / "22 DE MAIO") +
// ícones em círculo 36px com bg sutil por tipo + linha conectora.
// ─────────────────────────────────────────────────────────────────
import { formatBRT } from "@/lib/brtTime";
import { formatDayHeader, dayKeyBRT } from "@/lib/leadHelpers";
import type { ReactNode } from "react";
import {
  Phone, MessageSquare, CheckCircle2, StickyNote, MapPin, ArrowRight,
  Send, FileText, ClipboardList, PhoneCall, Plus, Megaphone, Video, Clock,
  Search as SearchIcon, Building2
} from "lucide-react";

export interface DrawerTimelineItem {
  id: string;
  title: string;
  description?: string;
  date: string;
  /** tipo canônico do evento (ligacao, whatsapp, nota, visita, etc) */
  tipo?: string;
  /** opcional: kind genérico pra fallback (atividade, historico, tarefa, etc) */
  kind?: "atividade" | "historico" | "tarefa" | "anotacao" | "imovel_event" | "system";
  /** ação extra à direita (ex: botão deletar) */
  trailing?: ReactNode;
}

interface Props {
  items: DrawerTimelineItem[];
  /** Renderiza o item inteiro caso o pai queira customizar (override total). */
  renderItem?: (item: DrawerTimelineItem) => ReactNode;
}

const TYPE_STYLE: Record<string, { bg: string; color: string; icon: any }> = {
  ligacao:        { bg: "bg-red-50 dark:bg-red-950/30",        color: "text-red-600 dark:text-red-400",        icon: Phone },
  call:           { bg: "bg-red-50 dark:bg-red-950/30",        color: "text-red-600 dark:text-red-400",        icon: Phone },
  nao_atendeu:    { bg: "bg-red-50 dark:bg-red-950/30",        color: "text-red-600 dark:text-red-400",        icon: PhoneCall },
  whatsapp:       { bg: "bg-indigo-50 dark:bg-indigo-950/30",  color: "text-indigo-600 dark:text-indigo-400",  icon: MessageSquare },
  mensagem:       { bg: "bg-indigo-50 dark:bg-indigo-950/30",  color: "text-indigo-600 dark:text-indigo-400",  icon: MessageSquare },
  contato:        { bg: "bg-indigo-50 dark:bg-indigo-950/30",  color: "text-indigo-600 dark:text-indigo-400",  icon: MessageSquare },
  email:          { bg: "bg-indigo-50 dark:bg-indigo-950/30",  color: "text-indigo-600 dark:text-indigo-400",  icon: Send },
  followup:       { bg: "bg-indigo-50 dark:bg-indigo-950/30",  color: "text-indigo-600 dark:text-indigo-400",  icon: Send },
  visita:         { bg: "bg-sky-50 dark:bg-sky-950/30",        color: "text-sky-600 dark:text-sky-400",        icon: MapPin },
  reuniao:        { bg: "bg-sky-50 dark:bg-sky-950/30",        color: "text-sky-600 dark:text-sky-400",        icon: Video },
  tarefa:         { bg: "bg-emerald-50 dark:bg-emerald-950/30",color: "text-emerald-600 dark:text-emerald-400",icon: CheckCircle2 },
  entrada:        { bg: "bg-emerald-50 dark:bg-emerald-950/30",color: "text-emerald-600 dark:text-emerald-400",icon: Plus },
  aceito:         { bg: "bg-emerald-50 dark:bg-emerald-950/30",color: "text-emerald-600 dark:text-emerald-400",icon: CheckCircle2 },
  nota:           { bg: "bg-amber-50 dark:bg-amber-950/30",    color: "text-amber-600 dark:text-amber-400",    icon: StickyNote },
  anotacao:       { bg: "bg-amber-50 dark:bg-amber-950/30",    color: "text-amber-600 dark:text-amber-400",    icon: StickyNote },
  historico:      { bg: "bg-violet-50 dark:bg-violet-950/30",  color: "text-violet-600 dark:text-violet-400",  icon: ArrowRight },
  campanha_atrio: { bg: "bg-violet-50 dark:bg-violet-950/30",  color: "text-violet-600 dark:text-violet-400",  icon: Megaphone },
  proposta:       { bg: "bg-sky-50 dark:bg-sky-950/30",        color: "text-sky-600 dark:text-sky-400",        icon: FileText },
  retorno:        { bg: "bg-indigo-50 dark:bg-indigo-950/30",  color: "text-indigo-600 dark:text-indigo-400",  icon: Clock },
  pendencia_doc:  { bg: "bg-zinc-100 dark:bg-zinc-800",        color: "text-zinc-600 dark:text-zinc-300",      icon: ClipboardList },
  imovel_event:   { bg: "bg-violet-50 dark:bg-violet-950/30",  color: "text-violet-600 dark:text-violet-400",  icon: Building2 },
  search_performed:{ bg: "bg-violet-50 dark:bg-violet-950/30", color: "text-violet-600 dark:text-violet-400",  icon: SearchIcon },
};

const FALLBACK_STYLE = { bg: "bg-zinc-100 dark:bg-zinc-800", color: "text-zinc-600 dark:text-zinc-300", icon: FileText };

function styleFor(item: DrawerTimelineItem) {
  if (item.tipo && TYPE_STYLE[item.tipo]) return TYPE_STYLE[item.tipo];
  if (item.kind === "historico") return TYPE_STYLE.historico;
  if (item.kind === "anotacao") return TYPE_STYLE.nota;
  if (item.kind === "tarefa") return TYPE_STYLE.tarefa;
  if (item.kind === "imovel_event") return TYPE_STYLE.imovel_event;
  return FALLBACK_STYLE;
}

export default function DrawerTimelineGroup({ items, renderItem }: Props) {
  // Agrupa preservando ordem original (items vem ordenado DESC do pai)
  const groups: { key: string; label: string; events: DrawerTimelineItem[] }[] = [];
  for (const ev of items) {
    const key = dayKeyBRT(ev.date);
    let g = groups.find(x => x.key === key);
    if (!g) {
      g = { key, label: formatDayHeader(ev.date) || key, events: [] };
      groups.push(g);
    }
    g.events.push(ev);
  }

  if (groups.length === 0) {
    return (
      <div className="text-center text-xs text-muted-foreground italic py-8">
        Nenhum evento registrado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key}>
          {/* Cabeçalho do dia */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
              {g.label}
            </span>
            <div className="flex-1 h-px bg-border/40" />
          </div>

          {/* Eventos do dia */}
          <div className="relative pl-1">
            {/* linha conectora vertical (atrás dos círculos) */}
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border/40 pointer-events-none" />
            <div className="space-y-3">
              {g.events.map((ev) => renderItem ? renderItem(ev) : <DefaultTimelineRow key={ev.id} item={ev} />)}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function DefaultTimelineRow({ item }: { item: DrawerTimelineItem }) {
  const s = styleFor(item);
  const Icon = s.icon;
  const time = formatBRT(item.date, "HH:mm");
  return (
    <div className="relative flex gap-3 group/timeline">
      <div className={`relative z-10 h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${s.bg} ${s.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground leading-snug">{item.title}</p>
            {item.description && (
              <p className="text-[12px] text-muted-foreground whitespace-pre-wrap leading-snug mt-0.5">
                {item.description}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/70 mt-0.5 tabular-nums">{time}</p>
          </div>
          {item.trailing && (
            <div className="shrink-0 opacity-0 group-hover/timeline:opacity-100 transition-opacity">
              {item.trailing}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
