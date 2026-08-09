import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { safeGet } from "./safeGet";
import type { FunilVis } from "./funilTypes";

/**
 * VisitasPanel — visitas criadas vs. realizadas no período (controlado por `vis`).
 * Modelo: das visitas CRIADAS no período, quantas realizaram / no-show / a realizar.
 * Garante realizada ≤ criada (realizada é desfecho da criada).
 */

interface VisitasData {
  criada: number;
  realizada: number;
  no_show: number;
  a_realizar: number;
}

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
  vis: FunilVis;
}

function readVisitas(obj: Record<string, unknown> | undefined): VisitasData {
  const v = safeGet<Record<string, unknown>>(obj ?? {}, "visitas", "Visitas bloco") ?? {};
  return {
    criada: Number(safeGet<number>(v, "criada", "Vis criada") ?? 0),
    realizada: Number(safeGet<number>(v, "realizada", "Vis realizada") ?? 0),
    no_show: Number(safeGet<number>(v, "no_show", "Vis no_show") ?? 0),
    a_realizar: Number(safeGet<number>(v, "a_realizar", "Vis a_realizar") ?? 0),
  };
}

export function VisitasPanel({ query, vis }: Props) {
  const loading = query.isLoading && !query.data;
  const data = query.data;

  const active =
    vis === "coorte"
      ? safeGet<Record<string, unknown>>(data ?? {}, "coorte", "Visitas coorte")
      : safeGet<Record<string, unknown>>(data ?? {}, "periodo_todo", "Visitas periodo");

  const d = readVisitas(active);
  const comprBase = d.realizada + d.no_show; // visitas que já tinham data
  const comparecimento = comprBase > 0 ? Math.round((d.realizada / comprBase) * 100) : null;
  const convCriadaReal = d.criada > 0 ? Math.round((d.realizada / d.criada) * 100) : null;

  return (
    <div className="central-card overflow-hidden">
      <div className="flex flex-col gap-0.5 border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">Visitas</span>
        <span className="text-xs text-muted-foreground">
          {vis === "coorte"
            ? "Das visitas dos leads da safra, o que criou e realizou"
            : "Todas as visitas criadas no período e seu desfecho"}
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2.5 p-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : d.criada === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Sem visitas no período.</div>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          {/* Barras criada → realizada (encaixadas) */}
          <div className="flex flex-col gap-2.5">
            <VisitaBar label="Criadas" value={d.criada} max={d.criada} tone="primary" />
            <VisitaBar
              label="Realizadas"
              value={d.realizada}
              max={d.criada}
              tone="success"
              badge={convCriadaReal != null ? `${convCriadaReal}%` : undefined}
            />
          </div>

          {/* Desfecho das criadas */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Chip label="Realizadas" value={d.realizada} tone="success" />
            <Chip label="No-show" value={d.no_show} tone="danger" />
            <Chip label="A realizar" value={d.a_realizar} tone="muted" />
          </div>

          {comparecimento != null ? (
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Taxa de comparecimento</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  comparecimento >= 60
                    ? "text-success"
                    : comparecimento >= 40
                      ? "text-warning-600"
                      : "text-danger-500"
                )}
              >
                {comparecimento}%
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function VisitaBar({
  label,
  value,
  max,
  tone,
  badge,
}: {
  label: string;
  value: number;
  max: number;
  tone: "primary" | "success";
  badge?: string;
}) {
  const pct = Math.max((value / Math.max(max, 1)) * 100, value > 0 ? 6 : 0);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="flex items-center gap-2">
          {badge ? (
            <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
              {badge}
            </span>
          ) : null}
          <span className="font-semibold tabular-nums text-foreground">
            {value.toLocaleString("pt-BR")}
          </span>
        </span>
      </div>
      <div className="h-7 w-full overflow-hidden rounded-lg bg-muted/50">
        <div
          className={cn(
            "h-full rounded-lg transition-all",
            tone === "primary"
              ? "bg-gradient-to-r from-primary to-primary/70"
              : "bg-gradient-to-r from-success to-success/70"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "muted";
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-2 py-2">
      <div
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "success"
            ? "text-success"
            : tone === "danger"
              ? "text-danger-500"
              : "text-foreground"
        )}
      >
        {value.toLocaleString("pt-BR")}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
