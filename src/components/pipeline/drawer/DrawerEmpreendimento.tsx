import { Building2, Phone, Clock, Calendar } from "lucide-react";

interface Props {
  empreendimento?: string | null;
  tentativasContato?: number;
  diasNaEtapa?: number;
  diasDesdeUltimoContato?: number;
}

/**
 * Caixa "Empreendimento" — 3 métricas operacionais (Pipeline v2 Fase 4).
 * Esconde métricas sem dados (ex: sem etapa, sem contato).
 */
export default function DrawerEmpreendimento({
  empreendimento,
  tentativasContato,
  diasNaEtapa,
  diasDesdeUltimoContato,
}: Props) {
  const metrics: { icon: typeof Phone; label: string; value: string }[] = [];
  if (typeof tentativasContato === "number") {
    metrics.push({ icon: Phone, label: "Tentativas", value: String(tentativasContato) });
  }
  if (typeof diasNaEtapa === "number") {
    metrics.push({ icon: Clock, label: "Dias na etapa", value: `${diasNaEtapa}d` });
  }
  if (typeof diasDesdeUltimoContato === "number") {
    metrics.push({ icon: Calendar, label: "Últ. contato", value: `${diasDesdeUltimoContato}d` });
  }

  if (!empreendimento && metrics.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-3 space-y-2">
      {empreendimento && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span className="truncate">{empreendimento}</span>
        </div>
      )}
      {metrics.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
              <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wide">
                <m.icon className="h-2.5 w-2.5" />
                {m.label}
              </div>
              <div className="text-sm font-bold text-foreground tabular-nums mt-0.5">{m.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
