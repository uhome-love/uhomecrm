import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Snowflake, Thermometer, Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * TemperaturaChip — Nova Gestão. O corretor MARCA a temperatura do lead (valor:
 * o feeling dele), sempre visível e clicável. Padrão = "não definida" (neutro,
 * convida a marcar — NÃO é morno, pra não fingir que todo lead é morno).
 * Frio = azul · Morno = amarelo · Quente = vermelho. Só aparece de Qualificação
 * pra frente (antes disso não houve contato → temperatura seria chute).
 */

type Tier = "nao_definida" | "frio" | "morno" | "quente";

function tierOf(v?: string | null): Tier {
  const s = (v || "").toLowerCase();
  if (s === "quente" || s === "muito_quente" || s === "urgente") return "quente";
  if (s === "frio" || s === "gelado") return "frio";
  if (s === "morno") return "morno";
  return "nao_definida";
}

const META: Record<Tier, { label: string; icon: LucideIcon; chip: string; item: string }> = {
  nao_definida: {
    label: "–",
    icon: Thermometer,
    chip: "bg-muted/40 text-muted-foreground/70 border-dashed border-border hover:bg-muted hover:text-muted-foreground",
    item: "text-muted-foreground",
  },
  frio: {
    label: "Frio",
    icon: Snowflake,
    chip: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30",
    item: "text-blue-600 dark:text-blue-400",
  },
  morno: {
    label: "Morno",
    icon: Thermometer,
    chip: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
    item: "text-amber-600 dark:text-amber-400",
  },
  quente: {
    label: "Quente",
    icon: Flame,
    chip: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30",
    item: "text-red-600 dark:text-red-400",
  },
};

interface Props {
  leadId: string;
  value?: string | null;
}

export default function TemperaturaChip({ leadId, value }: Props) {
  const [tier, setTier] = useState<Tier>(tierOf(value));
  const [busy, setBusy] = useState(false);

  const set = async (t: Exclude<Tier, "nao_definida">) => {
    if (busy || t === tier) return;
    const prev = tier;
    setTier(t); // otimista
    setBusy(true);
    const { error } = await supabase
      .from("pipeline_leads")
      .update({ temperatura: t } as never)
      .eq("id", leadId);
    setBusy(false);
    if (error) {
      setTier(prev);
      toast.error("Não foi possível mudar a temperatura.");
      return;
    }
    // Recarrega o board para a ordenação por prioridade refletir na hora.
    window.dispatchEvent(new CustomEvent("pipeline-reload"));
  };

  const m = META[tier];
  const Icon = m.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title="Temperatura do lead"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors",
            m.chip
          )}
        >
          <Icon className="h-3 w-3" strokeWidth={2} /> {m.label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36" onClick={(e) => e.stopPropagation()}>
        {(["frio", "morno", "quente"] as const).map((t) => {
          const mm = META[t];
          const I = mm.icon;
          const on = t === tier;
          return (
            <DropdownMenuItem
              key={t}
              onClick={() => set(t)}
              className={cn("gap-2 text-sm", mm.item)}
            >
              <I className="h-4 w-4" strokeWidth={2} /> {mm.label}
              {on && <Check className="ml-auto h-3.5 w-3.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
