import { Building2, Phone, Clock, Calendar } from "lucide-react";

interface Props {
  empreendimento?: string | null;
  /** Linha curta com origem / código de campanha / form id (ex: "meta_ads · 950290297631663"). */
  meta?: string | null;
  tentativasContato?: number;
  diasNaEtapa?: number;
  diasDesdeUltimoContato?: number;
  onEdit?: () => void;
}

/**
 * Caixa Empreendimento polida (Drawer Wide v4).
 * Header (ícone+nome+meta) + divider + grid de 3 métricas.
 */
export default function DrawerEmpreendimento({
  empreendimento, meta, tentativasContato, diasNaEtapa, diasDesdeUltimoContato, onEdit,
}: Props) {
  const metrics: { icon: typeof Phone; label: string; value: string }[] = [];
  if (typeof tentativasContato === "number") {
    metrics.push({ icon: Phone, label: "Tentativas", value: String(tentativasContato) });
  }
  if (typeof diasNaEtapa === "number") {
    metrics.push({ icon: Clock, label: "Na etapa", value: `${diasNaEtapa}d` });
  }
  if (typeof diasDesdeUltimoContato === "number") {
    metrics.push({ icon: Calendar, label: "Últ. contato", value: `${diasDesdeUltimoContato}d` });
  }

  if (!empreendimento && metrics.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      {(empreendimento || meta) && (
        <button
          type="button"
          onClick={onEdit}
          disabled={!onEdit}
          className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left ${onEdit ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"}`}
        >
          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-foreground truncate">
              {empreendimento || "Sem empreendimento"}
            </div>
            {meta && (
              <div
                className="text-[11px] text-muted-foreground line-clamp-2 min-w-0 break-words mt-0.5"
                title={meta}
              >
                {meta}
              </div>
            )}
          </div>
        </button>
      )}

      {/* Métricas */}
      {metrics.length > 0 && (
        <>
          {(empreendimento || meta) && <div className="h-px bg-border/40" />}
          <div className="grid grid-cols-3 divide-x divide-border/40">
            {metrics.map((m) => (
              <div key={m.label} className="px-2 py-2 text-center">
                <div className="text-[15px] font-bold text-foreground tabular-nums leading-none">{m.value}</div>
                <div className="text-[10px] text-muted-foreground mt-1 leading-none">{m.label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
