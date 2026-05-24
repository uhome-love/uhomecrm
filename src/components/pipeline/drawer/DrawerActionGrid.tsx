import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, FileText, StickyNote } from "lucide-react";
import { ReactNode } from "react";

export type DrawerActionKey = "ligar" | "whatsapp" | "scripts" | "anotar";

interface Props {
  hasPhone: boolean;
  onLigar: () => void;
  onWhatsapp: () => void;
  onScripts: () => void;
  onAnotar: () => void;
  /** Botão que ganha destaque primário (cor cheia) — geralmente derivado da próxima ação. */
  primary?: DrawerActionKey;
}

/**
 * Grid 2x2 limpo de ações principais do drawer (Pipeline v2 Fix Drawer Wide v3).
 * 4 botões fixos: Ligar / WhatsApp / Scripts / Anotar.
 * Hierarquia contextual: o botão correspondente à próxima ação vira primário (cor cheia).
 */
export default function DrawerActionGrid({
  hasPhone, onLigar, onWhatsapp, onScripts, onAnotar, primary,
}: Props) {
  const items: { key: DrawerActionKey; label: string; icon: typeof Phone; onClick: () => void; disabled?: boolean; primaryColor: string }[] = [
    { key: "ligar", label: "Ligar", icon: Phone, onClick: onLigar, disabled: !hasPhone, primaryColor: "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:text-white" },
    { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, onClick: onWhatsapp, disabled: !hasPhone, primaryColor: "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white" },
    { key: "scripts", label: "Scripts", icon: FileText, onClick: onScripts, primaryColor: "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground" },
    { key: "anotar", label: "Anotar", icon: StickyNote, onClick: onAnotar, primaryColor: "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map((a) => {
        const isPrimary = primary === a.key && !a.disabled;
        return (
          <Button
            key={a.key}
            variant="outline"
            size="sm"
            disabled={a.disabled}
            onClick={a.onClick}
            className={`h-10 text-xs gap-1.5 rounded-lg justify-start px-3 ${isPrimary ? `${a.primaryColor} shadow-sm` : ""}`}
          >
            <a.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{a.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
