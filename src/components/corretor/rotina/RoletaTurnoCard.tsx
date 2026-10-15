/** Bloco da Roleta do turno: aviso de estado (CrmMetaAviso) + as 3 regras com ✓/✗. Só lê — não credencia. */
import { Check, X } from "lucide-react";
import RoletaStatusBar from "@/components/corretor/RoletaStatusBar";
import { SaudeLinks } from "@/components/corretor/rotina/MinhaEvolucaoKpis";
import { useRoletaPerformanceStatus } from "@/hooks/useRoletaPerformanceStatus";
import { useMinhaEvolucao } from "@/hooks/useMinhaEvolucao";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function Regra({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn("flex h-4 w-4 items-center justify-center rounded-full",
        ok ? "bg-success-600 text-primary-foreground" : "bg-destructive text-destructive-foreground")}>
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span className="text-foreground">{texto}</span>
    </span>
  );
}

export default function RoletaTurnoCard() {
  const { data: perf } = useRoletaPerformanceStatus();
  const { data: evo } = useMinhaEvolucao();
  const aAtualizar = perf?.crm.a_atualizar ?? 0;

  const regras: { ok: boolean; texto: string }[] = [];
  if (perf?.crm.estado === "calculado" && perf.crm.pct != null) {
    regras.push({ ok: perf.crm_atende, texto: `CRM ${fmt(perf.crm.pct)}% (mín. ${fmt(perf.crm_minimo_pct)}%)` });
  }
  if (evo) {
    regras.push({ ok: evo.semanaAnterior >= evo.meta, texto: `${evo.semanaAnterior} visita${evo.semanaAnterior === 1 ? "" : "s"} na semana passada (mín. ${evo.meta})` });
    regras.push({ ok: evo.bloqueio?.codigo !== "descartes", texto: evo.bloqueio?.codigo === "descartes" ? "Teto de 100 descartes no mês atingido" : "Descartes do mês dentro do limite (máx. 100)" });
  }

  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-2">
      <RoletaStatusBar />
      {regras.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-2 pb-1">
          <span className="text-xs font-semibold text-muted-foreground">Regras da Roleta:</span>
          {regras.map((r) => <Regra key={r.texto} {...r} />)}
          {perf && !perf.crm_atende && aAtualizar > 0 && (
            <span className="ml-auto"><SaudeLinks vermelho={perf.crm.vermelho} ambar={perf.crm.ambar} total={aAtualizar} /></span>
          )}
        </div>
      )}
    </section>
  );
}
