import type { ReactNode } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoletaRequisitos } from "@/hooks/useRoletaRequisitos";
import type { RoletaPerformanceStatus } from "@/hooks/useRoletaPerformanceStatus";

interface Props {
  presenca: ReactNode;
  estado: "ativo" | "pendente" | "inativo";
  turnoAberto: { label: string; fecha: string } | null;
  proximoTurno: string | null;
  empreendimentos: string[];
  perf: RoletaPerformanceStatus | null | undefined;
  onEntrar: () => void;
  entrando: boolean;
  semAlocacao: boolean;
  onDetalhes: () => void;
}

function Req({ label, valor, ok }: { label: string; valor: string; ok: boolean | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0 text-sm">
      <span>{label}</span>
      <span className={cn("font-semibold", ok === true && "text-emerald-600 dark:text-emerald-400", ok === false && "text-destructive", ok === null && "text-muted-foreground")}>
        {valor}
      </span>
    </div>
  );
}

/** Cartão da Roleta na tela de Início (celular). Só aparência — ações são as mesmas da barra. */
export function RoletaInicioCardMobile(p: Props) {
  const { data: vis } = useRoletaRequisitos();
  const crmPct = p.perf?.crm?.estado === "calculado" && p.perf.crm.pct != null ? Math.round(p.perf.crm.pct) : null;
  const crmMin = p.perf?.crm_minimo_pct ?? 80;
  const melhorVis = vis ? Math.max(vis.semanaPassada, vis.semanaAtual) : null;
  const visOk = vis ? melhorVis! >= vis.meta : null;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm border border-border/60">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[17px] font-bold">Roleta</p>
          <p className={cn("text-xs font-medium",
            p.estado === "ativo" ? "text-emerald-600 dark:text-emerald-400" : p.estado === "pendente" ? "text-amber-600" : "text-muted-foreground")}>
            {p.estado === "ativo" ? "● Você está na Roleta" : p.estado === "pendente" ? "⏳ Aguardando aprovação" : "Fora da Roleta"}
          </p>
        </div>
        <button type="button" onClick={p.onDetalhes} className="flex items-center text-xs font-medium text-primary">
          Detalhes <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2">{p.presenca}</div>

      {p.empreendimentos.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground truncate">🏢 {p.empreendimentos.join(" · ")}</p>
      )}

      {p.estado === "inativo" && (
        <>
          <div className="mt-3 rounded-xl bg-muted/50 px-3">
            <Req label="Visitas realizadas" valor={vis ? `${melhorVis} de ${vis.meta} ${visOk ? "✓" : "✗"}` : "—"} ok={visOk} />
            <Req label="CRM em dia" valor={crmPct != null ? `${crmPct}% ${crmPct >= crmMin ? "✓" : "✗"}` : "—"} ok={crmPct != null ? crmPct >= crmMin : null} />
          </div>
          {p.turnoAberto ? (
            <>
              <button
                type="button"
                onClick={p.onEntrar}
                disabled={p.entrando || p.semAlocacao}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[16px] font-bold text-primary-foreground shadow disabled:opacity-50"
              >
                {p.entrando && <Loader2 className="h-5 w-5 animate-spin" />}
                Entrar na Roleta {p.turnoAberto.label}
              </button>
              <p className="mt-1.5 text-center text-xs text-muted-foreground">
                {p.semAlocacao ? "Você não tem empreendimentos alocados. Fale com o gestor." : `Entrada fecha às ${p.turnoAberto.fecha}`}
              </p>
            </>
          ) : (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {p.proximoTurno ? `Próxima entrada: ${p.proximoTurno}` : "Entrada na Roleta encerrada por hoje"}
            </p>
          )}
        </>
      )}
    </div>
  );
}
