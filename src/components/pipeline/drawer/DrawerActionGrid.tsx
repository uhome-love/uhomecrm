import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, StickyNote, CalendarPlus, ListPlus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export type DrawerActionKey = "ligar" | "whatsapp" | "anotar";

interface Props {
  hasPhone: boolean;
  onLigar: () => void;
  onWhatsapp: () => void;
  onAnotar: () => void;
  /** Só no celular: atalhos redondos extras. */
  onVisita?: () => void;
  onTarefa?: () => void;
  /** Botão que ganha destaque primário (cor cheia) — geralmente derivado da próxima ação. */
  primary?: DrawerActionKey;
}

/**
 * Ações principais do drawer.
 * Desktop: 3 botões (Ligar / WhatsApp / Anotar).
 * Celular: botões redondos grandes estilo iPhone (Ligar / WhatsApp / Visita / Tarefa / Anotar).
 */
export default function DrawerActionGrid({
  hasPhone, onLigar, onWhatsapp, onAnotar, onVisita, onTarefa, primary,
}: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    const round: { key: string; label: string; icon: typeof Phone; onClick?: () => void; disabled?: boolean; tone: string }[] = [
      { key: "ligar", label: "Ligar", icon: Phone, onClick: onLigar, disabled: !hasPhone, tone: "bg-primary text-primary-foreground" },
      { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, onClick: onWhatsapp, disabled: !hasPhone, tone: "bg-emerald-600 text-white" },
      { key: "visita", label: "Visita", icon: CalendarPlus, onClick: onVisita, tone: "bg-muted text-foreground" },
      { key: "tarefa", label: "Tarefa", icon: ListPlus, onClick: onTarefa, tone: "bg-muted text-foreground" },
      { key: "anotar", label: "Anotar", icon: StickyNote, onClick: onAnotar, tone: "bg-muted text-foreground" },
    ];
    return (
      <div className="flex items-start justify-between gap-1 py-1">
        {round.filter(a => a.onClick).map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={a.onClick}
            disabled={a.disabled}
            aria-label={a.label}
            className="flex flex-1 flex-col items-center gap-1.5 min-w-0 disabled:opacity-40 active:scale-95 transition-transform"
          >
            <span className={`flex h-14 w-14 items-center justify-center rounded-full shadow-sm ${a.tone}`}>
              <a.icon className="h-6 w-6" strokeWidth={2} />
            </span>
            <span className="text-[12px] font-semibold text-foreground truncate max-w-full">{a.label}</span>
          </button>
        ))}
      </div>
    );
  }

  const items: { key: DrawerActionKey; label: string; icon: typeof Phone; onClick: () => void; disabled?: boolean; primaryColor: string }[] = [
    { key: "ligar", label: "Ligar", icon: Phone, onClick: onLigar, disabled: !hasPhone, primaryColor: "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:text-white" },
    { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, onClick: onWhatsapp, disabled: !hasPhone, primaryColor: "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white" },
    { key: "anotar", label: "Anotar", icon: StickyNote, onClick: onAnotar, primaryColor: "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground" },
  ];

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map((a) => {
        const isPrimary = primary === a.key && !a.disabled;
        return (
          <Button
            key={a.key}
            variant="outline"
            size="sm"
            disabled={a.disabled}
            onClick={a.onClick}
            className={`flex-col h-auto min-w-0 py-2 gap-1 text-[11px] font-medium rounded-lg px-1 ${isPrimary ? `${a.primaryColor} shadow-sm` : ""}`}
          >
            <a.icon className="h-4 w-4 shrink-0" />
            <span className="truncate max-w-full">{a.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
