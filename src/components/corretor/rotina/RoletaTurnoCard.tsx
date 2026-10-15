/** Bloco da Roleta do turno: barra de status + as 3 regras em cartões alinhados. Só lê — não credencia. */
import { Check, X } from "lucide-react";
import RoletaStatusBar from "@/components/corretor/RoletaStatusBar";
import { useRoletaPerformanceStatus } from "@/hooks/useRoletaPerformanceStatus";
import { useMinhaEvolucao } from "@/hooks/useMinhaEvolucao";
import { cn } from "@/lib/utils";
import { SaudeLinks } from "@/components/corretor/rotina/MinhaEvolucaoKpis";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

interface RegraProps { ok: boolean; titulo: string; valor: string; detalhe?: string; extra?: React.ReactNode }

function Regra({ ok, titulo, valor, detalhe, extra }: RegraProps) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
        ok ? "bg-success-600 text-primary-foreground" : "bg-destructive text-destructive-foreground")}>
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className={cn("text-sm font-bold", ok ? "text-success-600" : "text-destructive")}>
          {valor}{detalhe && <span className="ml-1 text-xs font-normal text-muted-foreground">{detalhe}</span>}
        </p>
        {extra}
      </div>
    </div>
  );
}

export default function RoletaTurnoCard() {
  const { data: perf } = useRoletaPerformanceStatus();
  const { data: evo } = useMinhaEvolucao();

  const regras: RegraProps[] = [];
  if (perf?.crm.estado === "calculado" && perf.crm.pct != null) {
    regras.push({ ok: perf.crm_atende, titulo: "Saúde do CRM", valor: `${fmt(perf.crm.pct)}%`, detalhe: `/ mín. ${fmt(perf.crm_minimo_pct)}%`, extra: <SaudeLinks verde={perf.crm.em_dia} ambar={perf.crm.ambar} vermelho={perf.crm.vermelho} /> });
  }
  if (evo) {
    const okVis = evo.semanaAnterior >= evo.meta || evo.semanaAtual >= evo.meta;
    const falta = Math.max(0, evo.meta - evo.semanaAtual);
    regras.push({ ok: okVis, titulo: "Visitas", valor: `${evo.semanaAnterior} sem. passada`, detalhe: `/ mín. ${evo.meta}`,
      extra: <p className="text-xs text-muted-foreground">Esta semana {evo.semanaAtual}/{evo.meta}{evo.semanaAnterior < evo.meta && falta > 0 ? ` · faltam ${falta} p/ liberar` : ""}</p> });
    const estourou = evo.bloqueio?.codigo === "descartes";
    regras.push({ ok: !estourou, titulo: "Descartes do mês", valor: estourou ? "Limite atingido" : "Dentro do limite", detalhe: "máx. 100" });
  }

  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-2.5">
      <RoletaStatusBar />
      {regras.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {regras.map((r) => <Regra key={r.titulo} {...r} />)}
        </div>
      )}
    </section>
  );
}
