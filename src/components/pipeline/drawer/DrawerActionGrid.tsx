import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, StickyNote } from "lucide-react";

export type DrawerActionKey = "ligar" | "whatsapp" | "anotar";

interface Props {
  hasPhone: boolean;
  onLigar: () => void;
  onWhatsapp: () => void;
  onAnotar: () => void;
  /** Botão que ganha destaque primário (cor cheia) — geralmente derivado da próxima ação. */
  primary?: DrawerActionKey;
}

/**
 * Linha limpa de ações principais do drawer.
 * 3 botões numa linha: Ligar / WhatsApp / Anotar.
 * Hierarquia contextual: o botão correspondente à próxima ação vira primário (cor cheia).
 */
export default function DrawerActionGrid({
  hasPhone, onLigar, onWhatsapp, onAnotar, primary,
}: Props) {
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
