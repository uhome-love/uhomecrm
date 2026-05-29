import type { UseQueryResult } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { safeGet } from "@/components/central-v2/shared/safeGet";
import { fmtMoney } from "@/lib/fmtMoney";

interface Props {
  vendas: UseQueryResult<Record<string, unknown>>;
  visitas: UseQueryResult<Record<string, unknown>>;
}

/**
 * Três números grandes que resumem o período no topo da Geral.
 * Cada card depende de uma RPC distinta e renderiza skeleton individual.
 *
 * Mapeamento:
 *  - VGV Total          → vendas.data.vendas.vgv  (shortWithTooltip)
 *  - Visitas Realizadas → visitas.data.visitas.realizadas
 *  - Negócios Assinados → vendas.data.vendas.count
 */
export function ExecutiveSummary({ vendas, visitas }: Props) {
  const vgv = safeGet<number>(vendas.data ?? {}, "vendas.vgv", "Exec VGV");
  const vgvFmt = vgv != null ? fmtMoney(vgv, "shortWithTooltip") : null;
  const realizadas = safeGet<number>(visitas.data ?? {}, "visitas.realizadas", "Exec visitas.realizadas");
  const assinados = safeGet<number>(vendas.data ?? {}, "vendas.count", "Exec vendas.count");

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <BigCard
        label="VGV do período"
        loading={vendas.isLoading && !vendas.data}
        value={vgvFmt?.display}
        title={vgvFmt?.title}
        error={!!vendas.error}
      />
      <BigCard
        label="Visitas realizadas"
        loading={visitas.isLoading && !visitas.data}
        value={realizadas != null ? Math.round(realizadas).toLocaleString("pt-BR") : undefined}
        error={!!visitas.error}
      />
      <BigCard
        label="Negócios assinados"
        loading={vendas.isLoading && !vendas.data}
        value={assinados != null ? Math.round(assinados).toLocaleString("pt-BR") : undefined}
        error={!!vendas.error}
      />
    </div>
  );
}

function BigCard({
  label,
  value,
  title,
  loading,
  error,
}: {
  label: string;
  value?: string;
  title?: string;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <div className="central-card p-5" title={title}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-9 w-32" />
      ) : (
        <div className="mt-1 font-display text-3xl text-foreground sm:text-4xl">
          {error ? "—" : (value ?? "—")}
        </div>
      )}
    </div>
  );
}
