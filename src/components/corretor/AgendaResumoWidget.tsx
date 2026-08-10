import { useNavigate } from "react-router-dom";
import { useFilaDoDia, type MotivoFila } from "@/hooks/useFilaDoDia";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Target, Bell, ArrowRight, Zap, Layers } from "lucide-react";

/**
 * AgendaResumoWidget — resumo da nova Agenda dentro da Minha Rotina.
 * Mostra as prioridades do dia (topo da fila) + o resumo de lembretes, e leva
 * pra Agenda completa. Substitui a antiga central de tarefas lateral.
 */

const MOTIVO_DOT: Record<MotivoFila, string> = {
  negocio: "bg-emerald-500",
  pos_visita: "bg-orange-500",
  novo_lead: "bg-blue-500",
  no_show: "bg-red-500",
  retorno_hoje: "bg-amber-500",
  quente_esfriando: "bg-rose-500",
  sem_proximo_passo: "bg-violet-500",
};
const MOTIVO_LABEL: Record<MotivoFila, string> = {
  negocio: "Negócio", pos_visita: "Pós-visita", novo_lead: "Novo lead",
  no_show: "No-show", retorno_hoje: "Retorno", quente_esfriando: "Esfriando",
  sem_proximo_passo: "Sem próximo passo",
};


export default function AgendaResumoWidget() {
  const { data, isLoading } = useFilaDoDia();
  const navigate = useNavigate();

  const prioridades = data?.prioridades ?? [];
  const cadencia = data?.cadencia?.total ?? 0;
  const totalFila = prioridades.length + cadencia;
  const atrasados = data?.lembretes.atrasados.length ?? 0;
  const hoje = data?.lembretes.hoje.length ?? 0;
  const topo = prioridades.slice(0, 3);

  const abrir = (extra = "") => navigate(`/minhas-tarefas${extra}`);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <button type="button" onClick={() => abrir()} className="flex w-full items-center gap-2 text-left">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Target className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-foreground">Sua fila de hoje</span>
          <span className="block text-[11px] text-muted-foreground">quem o CRM sugere atacar agora</span>
        </span>
        {totalFila > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">{totalFila}</span>
        )}
      </button>

      <div className="mt-3 space-y-1.5">
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)
        ) : topo.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/[0.04] px-3 py-2.5 text-[12px] text-muted-foreground">
            <Layers className="h-4 w-4 shrink-0 text-primary" />
            {cadencia > 0 ? `${cadencia} leads da cadência pra hoje` : "Fila zerada — mandou bem! 🎉"}
          </div>
        ) : (
          topo.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => navigate(`/pipeline-leads?lead=${l.id}`)}
              className="flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-left hover:bg-muted/40"
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", MOTIVO_DOT[l.motivo])} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-foreground">{l.nome}</span>
                <span className="block truncate text-[10.5px] text-muted-foreground">{MOTIVO_LABEL[l.motivo]} · {l.stage_nome}</span>
              </span>
              <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />
            </button>
          ))
        )}
      </div>

      {/* Lembretes resumo */}
      <button
        type="button"
        onClick={() => abrir()}
        className="mt-3 flex w-full items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-left hover:bg-muted/60"
      >
        <Bell className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="flex-1 text-[12px] text-foreground">
          {atrasados > 0 && <span className="font-semibold text-red-600">{atrasados} atrasado{atrasados !== 1 ? "s" : ""}</span>}
          {atrasados > 0 && " · "}
          <span className="font-medium">{hoje} lembrete{hoje !== 1 ? "s" : ""} hoje</span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => abrir()}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12.5px] font-bold text-primary-foreground hover:bg-primary/90"
      >
        Abrir Agenda <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
