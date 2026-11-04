import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import FiltroImovel from "./FiltroImovel";
import { NIVEL_META } from "./useLiaHub";
import { useLiaPainelDados } from "./useLiaPainelDados";
import { LiaHojeCard, LiaRepasseCard, LiaDescartesCard, LiaCustoCard } from "./LiaVisaoBlocos";

const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : 0);

function Numero({ label, valor, dica, loading }: { label: string; valor: number; dica: string; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
        {loading ? <Skeleton className="h-8 w-16" /> : valor}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{dica}</p>
    </div>
  );
}

export default function LiaVisaoGeral() {
  const [produto, setProduto] = useState("todos");
  const [, setParams] = useSearchParams();
  const d = useLiaPainelDados(produto);
  const f = d.funil;
  const etapas = [
    { label: "Contato", v: f.falaram },
    { label: "Qualificado", v: f.qualificados },
    { label: "Agendou", v: f.agendaram },
    { label: "Visita", v: f.visitaram },
    { label: "Venda", v: f.venderam },
  ];
  const acoes = [
    { label: "Quentes sem apresentação agendada", v: d.atencao.quentesSemAgenda, area: "conversas", aba: "leads" },
    { label: "Qualificados aguardando na fila", v: d.atencao.naFila, area: "conversas", aba: "leads" },
    { label: "Esfriando (follow-up pendente)", v: d.atencao.esfriando, area: "conversas", aba: "followups" },
    { label: "Pediram para parar hoje", v: d.atencao.optoutsHoje, area: "conversas", aba: "leads" },
  ];

  return (
    <div className="space-y-4">
      <FiltroImovel produtos={d.produtos} valor={produto} onChange={setProduto} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero label="Conversas" valor={f.falaram} dica="clientes que falaram com a Lia" loading={d.isLoading} />
        <Numero label="Qualificados" valor={f.qualificados} dica={`${pct(f.qualificados, f.falaram)}% das conversas`} loading={d.isLoading} />
        <Numero label="Assumidos por corretor" valor={d.repasse.assumidos} dica={`de ${d.repasse.avisados} avisados do repasse`} loading={d.isLoading} />
        <Numero label="Vendas" valor={f.venderam} dica={f.venderam ? "vindas da Lia" : "nenhuma venda vinda da Lia ainda"} loading={d.isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="font-semibold text-foreground">Caminho do cliente</h2>
          <p className="text-xs text-muted-foreground">Do primeiro contato com a Lia até a venda</p>
          {d.isLoading ? <Skeleton className="mt-3 h-20 w-full" /> : (
            <>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {etapas.map((e, i) => (
                  <div key={e.label} className="rounded-lg bg-primary px-2 py-2.5 text-primary-foreground sm:px-3"
                    style={{ opacity: 1 - i * 0.15 }}>
                    <p className="truncate text-[11px] sm:text-xs">{e.label}</p>
                    <p className="text-base font-bold tabular-nums sm:text-lg">{e.v}</p>
                    <p className="text-[10px] opacity-90">{pct(e.v, f.falaram)}%</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["quente", "morno", "frio"] as const).map((n) => (
                  <div key={n} className={cn("rounded-lg border px-3 py-2", NIVEL_META[n].cls)}>
                    <span className="text-xs font-semibold">{NIVEL_META[n].emoji} {NIVEL_META[n].label}</span>
                    <span className="ml-2 font-bold tabular-nums">{f[n]}</span>
                  </div>
                ))}
              </div>
              {d.recuperacao.cutucados > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Follow-up trouxe de volta <b className="text-foreground">{d.recuperacao.voltaram}</b> de {d.recuperacao.cutucados} clientes.
                </p>
              )}
            </>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold text-foreground">Precisa de você agora</h2>
          <div className="mt-3 space-y-2">
            {acoes.map((a) => (
              <button key={a.label} type="button" onClick={() => setParams({ area: a.area, aba: a.aba }, { replace: true })}
                className="flex w-full items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-left text-sm transition-colors duration-fast hover:bg-muted">
                <span className="text-foreground">{a.label}</span>
                <span className="flex items-center gap-1">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                    a.v > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{a.v}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <LiaHojeCard kpis={d.kpis} loading={d.isLoading || d.loadingConv} />
        <LiaRepasseCard repasse={d.repasse} />
        <LiaDescartesCard descartes={d.descartes} loading={d.isLoading} />
      </div>
      <LiaCustoCard custo={d.custo} loading={d.loadingCusto} funil={f} />
    </div>
  );
}
