import { Link } from "react-router-dom";
import { ArrowRight, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useDashboardGerenteV4Dia,
  type MiniPipelineCard,
  type MiniPipelineFase,
} from "@/hooks/useDashboardGerenteV4Dia";

interface Props {
  gestorId: string | undefined;
}

const BORDER_BY_FASE: Record<string, string> = {
  novo_negocio: "border-l-slate-400",
  proposta: "border-l-indigo-500",
  negociacao: "border-l-amber-500",
  documentacao: "border-l-emerald-500",
};

function formatVgvShort(v: number): string {
  if (!v || v <= 0) return "R$ 0";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function cardVgv(c: MiniPipelineCard): number {
  return Number(c.vgv ?? 0);
}

function Column({ fase }: { fase: MiniPipelineFase }) {
  const border = BORDER_BY_FASE[fase.fase] ?? "border-l-slate-300";
  const extra = fase.count_total - fase.top_cards.length;

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-foreground truncate">{fase.fase_label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{fase.count_total}</span>
      </div>

      {fase.count_total === 0 ? (
        <div className="flex items-center justify-center h-20 text-muted-foreground/60 text-sm">
          —
        </div>
      ) : (
        <div className="space-y-1.5">
          {fase.top_cards.map((c) => (
            <div
              key={c.negocio_id}
              className={cn(
                "rounded-md border border-border border-l-4 bg-muted/30 px-2 py-1.5",
                border,
              )}
            >
              <p className="text-xs font-medium text-foreground truncate">
                {c.cliente_nome ?? "—"}
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {formatVgvShort(cardVgv(c))}
              </p>
            </div>
          ))}
          {extra > 0 && (
            <div className="rounded-md border border-dashed border-border px-2 py-1.5 text-[10px] text-muted-foreground text-center">
              + {extra} outros
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function V4PanelNegocios({ gestorId }: Props) {
  const { data, isLoading } = useDashboardGerenteV4Dia(gestorId, "hoje");
  const fases = data?.mini_pipeline ?? [];

  const vgvVisivel = fases.reduce(
    (acc, f) => acc + f.top_cards.reduce((s, c) => s + cardVgv(c), 0),
    0,
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Negócios em andamento</h3>
        <Link
          to="/negocios"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
        >
          Ver pipeline <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex-1 min-h-[200px]">
        {isLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : fases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Briefcase className="h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum negócio em andamento</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {fases.map((f) => (
              <Column key={f.fase} fase={f} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
        VGV pipeline (visível): <span className="font-semibold text-foreground tabular-nums">{formatVgvShort(vgvVisivel)}</span>
      </div>
    </div>
  );
}
