import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, FileText, Zap, StickyNote } from "lucide-react";
import { ReactNode } from "react";

interface Action {
  key: "ligar" | "whatsapp" | "scripts" | "registrar" | "anotar";
  label: string;
  icon: typeof Phone;
  onClick: () => void;
  variant?: "primary" | "default" | "whatsapp";
  disabled?: boolean;
  wrap?: (node: ReactNode) => ReactNode;
}

interface Props {
  hasPhone: boolean;
  onLigar: () => void;
  onWhatsapp: () => void;
  onScripts: () => void;
  onRegistrar: () => void;
  onAnotar: () => void;
  registrarWrapper?: (node: ReactNode) => ReactNode;
  primary?: Action["key"];
}

/**
 * Grid 2x2 de ações principais do drawer (Pipeline v2 Fase 4).
 * - Hierarquia: ação primária recebe destaque visual baseado em `primary`
 * - Ações inacessíveis (ex: telefone vazio) ficam disabled
 */
export default function DrawerActionGrid({
  hasPhone, onLigar, onWhatsapp, onScripts, onRegistrar, onAnotar, registrarWrapper, primary,
}: Props) {
  const items: Action[] = [
    { key: "ligar", label: "Ligar", icon: Phone, onClick: onLigar, disabled: !hasPhone },
    { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, onClick: onWhatsapp, variant: "whatsapp", disabled: !hasPhone },
    { key: "scripts", label: "Scripts", icon: FileText, onClick: onScripts },
    { key: "registrar", label: "Registrar", icon: Zap, onClick: onRegistrar, wrap: registrarWrapper },
    { key: "anotar", label: "Anotar", icon: StickyNote, onClick: onAnotar },
  ];

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map((a) => {
        const isPrimary = primary === a.key;
        const variantClass =
          a.variant === "whatsapp"
            ? "border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950"
            : "";
        const primaryClass = isPrimary
          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground shadow-sm"
          : "";
        const btn = (
          <Button
            key={a.key}
            variant="outline"
            size="sm"
            disabled={a.disabled}
            onClick={a.onClick}
            className={`h-10 text-xs gap-1.5 rounded-lg justify-start px-3 ${variantClass} ${primaryClass}`}
          >
            <a.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{a.label}</span>
          </Button>
        );
        return a.wrap ? <div key={a.key}>{a.wrap(btn)}</div> : btn;
      })}
    </div>
  );
}
