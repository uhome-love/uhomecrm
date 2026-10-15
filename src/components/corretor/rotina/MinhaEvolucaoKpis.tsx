import { useNavigate } from "react-router-dom";
import { useRoletaPerformanceStatus } from "@/hooks/useRoletaPerformanceStatus";
import { useMinhaEvolucao } from "@/hooks/useMinhaEvolucao";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function Barra({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

const SIT = {
  apto: { t: "Apto ✓", c: "text-success-600" },
  evolucao: { t: "Em evolução", c: "text-warning" },
  retomada: { t: "Plano de retomada", c: "text-destructive" },
} as const;

export function SaudeLinks({ vermelho, ambar, total }: { vermelho?: number; ambar?: number; total?: number }) {
  const navigate = useNavigate();
  if (!total) return <p className="mt-1.5 text-xs text-muted-foreground">Carteira em dia</p>;
  const v = vermelho ?? 0, a = ambar ?? (vermelho == null ? total : 0);
  return (
    <p className="mt-1.5 text-xs">
      {v > 0 && <button type="button" onClick={() => navigate("/pipeline-leads?filtro=atrasado")} className="font-semibold text-destructive hover:underline">{v} desatualizado{v === 1 ? "" : "s"}</button>}
      {v > 0 && a > 0 && <span className="text-muted-foreground"> · </span>}
      {a > 0 && <button type="button" onClick={() => navigate("/pipeline-leads?filtro=sem_tarefa")} className="font-semibold text-warning hover:underline">{a} em atenção</button>}
    </p>
  );
}

export default function MinhaEvolucaoKpis() {
  const navigate = useNavigate();
  const { data: perf, isLoading: l1 } = useRoletaPerformanceStatus();
  const { data: evo, isLoading: l2 } = useMinhaEvolucao();
  const pct = perf?.crm.pct ?? null;

  const card = "rounded-xl border border-border bg-card p-3 sm:p-4";
  const lbl = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  const sk = <Skeleton className="mt-1 h-8 w-16" />;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Minha evolução</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className={card}>
          <p className={lbl}>Saúde do CRM</p>
          {l1 ? sk : (
            <p className={cn("mt-1 text-3xl font-black", perf?.crm_atende ? "text-success-600" : "text-foreground")}>
              {pct != null ? `${fmt(pct)}%` : "—"}
            </p>
          )}
          <Barra pct={pct ?? 0} />
          <SaudeLinks vermelho={perf?.crm.vermelho} ambar={perf?.crm.ambar} total={perf?.crm.a_atualizar} />
        </div>

        <div className={card}>
          <p className={lbl}>Visitas desta semana</p>
          {l2 || !evo ? sk : (
            <p className="mt-1 text-3xl font-black text-foreground">
              {evo.semanaAtual} <span className="text-base font-semibold text-muted-foreground">de {evo.meta}</span>
            </p>
          )}
          <Barra pct={evo ? (evo.semanaAtual / evo.meta) * 100 : 0} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {evo && evo.semanaAtual < evo.meta
              ? `Falta${evo.meta - evo.semanaAtual === 1 ? "" : "m"} ${evo.meta - evo.semanaAtual} para garantir a próxima semana`
              : "Meta da semana batida 🎯"}
          </p>
        </div>

        <div className={card}>
          <p className={lbl}>Minha situação</p>
          {l2 || !evo ? sk : <p className={cn("mt-1 text-xl font-black", SIT[evo.situacao].c)}>{SIT[evo.situacao].t}</p>}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {!evo ? "" : evo.situacao === "apto"
              ? `Garantido até domingo pelas ${evo.semanaAnterior} visitas da semana passada`
              : evo.situacao === "evolucao"
                ? `Você fez ${evo.semanaAnterior} visita na semana passada. Faça ${evo.meta} esta semana.`
                : `Vamos juntos: marque ${evo.meta} visitas esta semana. Seu gerente vai fazer um 1:1 com você.`}
          </p>
        </div>
      </div>
    </section>
  );
}
