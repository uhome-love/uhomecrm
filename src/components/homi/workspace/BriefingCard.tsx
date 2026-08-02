import { AlertTriangle, CalendarCheck, Clock, Snowflake, Loader2 } from "lucide-react";
import { useHomiBriefing, type BriefingItem } from "@/hooks/useHomiBriefing";

const ICONES = {
  atrasadas: AlertTriangle,
  hoje: Clock,
  visitas: CalendarCheck,
  esfriando: Snowflake,
} as const;

const TONS: Record<BriefingItem["chave"], string> = {
  atrasadas: "text-destructive",
  hoje: "text-primary",
  visitas: "text-emerald-600 dark:text-emerald-400",
  esfriando: "text-amber-600 dark:text-amber-400",
};

/** Cartão de abertura: o que importa hoje, sem precisar perguntar. */
export default function BriefingCard({ onPrompt }: { onPrompt: (t: string) => void }) {
  const { itens, loading } = useHomiBriefing();

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Montando seu dia...
      </div>
    );
  }

  const total = itens.reduce((s, i) => s + i.valor, 0);
  if (total === 0) return null;

  return (
    <div className="w-full rounded-xl border border-border bg-muted/30 p-3">
      <p className="mb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Seu dia agora
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {itens.map((item) => {
          const Icone = ICONES[item.chave];
          return (
            <button
              key={item.chave}
              type="button"
              onClick={() => onPrompt(item.prompt)}
              disabled={item.valor === 0}
              className="flex flex-col items-start gap-0.5 rounded-lg border border-border bg-background p-2.5 text-left transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Icone className={`h-3.5 w-3.5 ${TONS[item.chave]}`} />
              <span className="text-lg font-semibold leading-none">{item.valor}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
