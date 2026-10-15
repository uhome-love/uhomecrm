import { useNavigate } from "react-router-dom";
import { useMinhaEvolucao } from "@/hooks/useMinhaEvolucao";
import { useMinhaEvolucaoMes } from "@/hooks/useMinhaEvolucaoMes";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SIT = {
  apto: { t: "Apto ✓", c: "text-success-600" },
  evolucao: { t: "Em evolução", c: "text-warning" },
  retomada: { t: "Plano de retomada", c: "text-destructive" },
} as const;

/** Mesmas 3 bolinhas do Pipeline (verde/amarelo/vermelho), com link para o filtro. */
export function SaudeLinks({ verde, vermelho, ambar }: { verde?: number; vermelho?: number; ambar?: number }) {
  const navigate = useNavigate();
  const pill = "inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[11px] font-semibold hover:opacity-80";
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <button type="button" title="Em dia" onClick={() => navigate("/pipeline-leads?filtro=em_dia")} className={cn(pill, "bg-success-600/10 text-success-600")}>● {verde ?? 0}</button>
      <button type="button" title="Em atenção" onClick={() => navigate("/pipeline-leads?filtro=sem_tarefa")} className={cn(pill, "bg-warning/10 text-warning")}>● {ambar ?? 0}</button>
      <button type="button" title="Desatualizado" onClick={() => navigate("/pipeline-leads?filtro=atrasado")} className={cn(pill, "bg-destructive/10 text-destructive")}>● {vermelho ?? 0}</button>
    </div>
  );
}

const brl = (v: number) => v >= 1_000_000
  ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
  : `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;

export default function MinhaEvolucaoKpis() {
  const { data: evo } = useMinhaEvolucao();
  const { data: mes, isLoading } = useMinhaEvolucaoMes();

  const card = "rounded-xl border border-border bg-card p-3 sm:p-4";
  const lbl = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  const big = "mt-1 text-3xl font-black text-foreground";
  const sk = <Skeleton className="mt-1 h-8 w-16" />;

  const faltam = evo ? Math.max(0, evo.meta - evo.semanaAtual) : 0;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Minha evolução{mes ? ` · ${mes.mesAtual}` : ""}
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className={card}>
          <p className={lbl}>Leads</p>
          {isLoading || !mes ? sk : <>
            <p className={big}>{mes.atual.leads_recebidos}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">recebidos no mês</p>
          </>}
        </div>
        <div className={card}>
          <p className={lbl}>Visitas realizadas</p>
          {isLoading || !mes ? sk : <>
            <p className={big}>{mes.atual.visitas_realizadas}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{mes.atual.leads_recebidos > 0 ? `${Math.round((mes.atual.visitas_realizadas / mes.atual.leads_recebidos) * 1000) / 10}`.replace(".", ",") + "% dos leads viraram visita" : "—"}</p>
          </>}
        </div>
        <div className={card}>
          <p className={lbl}>Vendas</p>
          {isLoading || !mes ? sk : <>
            <p className={big}>{mes.atual.vendas}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {mes.atual.vgv_assinado > 0 ? `${brl(mes.atual.vgv_assinado)} de VGV` : "Sem VGV no mês"}
            </p>
          </>}
        </div>
      </div>

      {evo && (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-foreground">
            <b>Esta semana:</b> {evo.semanaAtual} de {evo.meta} visitas
            {faltam > 0 ? ` — faltam ${faltam} para a Roleta da próxima semana` : " — próxima semana garantida 🎯"}
          </span>
          <span className={cn("font-semibold", SIT[evo.situacao].c)}>
            {SIT[evo.situacao].t}
            {evo.situacao === "retomada" && <span className="font-normal text-muted-foreground"> · seu gerente vai fazer um 1:1</span>}
          </span>
        </div>
      )}
    </section>
  );
}
