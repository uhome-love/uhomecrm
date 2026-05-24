/**
 * ModoTimeSwitcher — toggle "Meu Time | Meus Leads" no header do Modo Time.
 *
 * Botão "Meus Leads" só aparece quando o gestor tem leads próprios
 * (`hasOwnLeads === true`). Persistência em localStorage por usuário.
 */
import { cn } from "@/lib/utils";

export type ModoTimeView = "meu_time" | "meus_leads";

interface Props {
  value: ModoTimeView;
  onChange: (v: ModoTimeView) => void;
  hasOwnLeads: boolean;
}

export default function ModoTimeSwitcher({ value, onChange, hasOwnLeads }: Props) {
  const base = "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors";
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-neutral-100 border border-neutral-200">
      <button
        type="button"
        onClick={() => onChange("meu_time")}
        className={cn(
          base,
          value === "meu_time"
            ? "bg-white text-[#0A0E1A] shadow-sm"
            : "text-neutral-500 hover:text-neutral-700",
        )}
      >
        Meu Time
      </button>
      {hasOwnLeads && (
        <button
          type="button"
          onClick={() => onChange("meus_leads")}
          className={cn(
            base,
            value === "meus_leads"
              ? "bg-white text-[#0A0E1A] shadow-sm"
              : "text-neutral-500 hover:text-neutral-700",
          )}
        >
          Meus Leads
        </button>
      )}
    </div>
  );
}

export function loadModoTimeView(userId: string | null | undefined): ModoTimeView {
  if (!userId || typeof localStorage === "undefined") return "meu_time";
  try {
    const v = localStorage.getItem(`uhome:modo-time-view:${userId}`);
    return v === "meus_leads" ? "meus_leads" : "meu_time";
  } catch {
    return "meu_time";
  }
}

export function saveModoTimeView(userId: string | null | undefined, v: ModoTimeView) {
  if (!userId || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`uhome:modo-time-view:${userId}`, v);
  } catch {
    /* ignore */
  }
}
