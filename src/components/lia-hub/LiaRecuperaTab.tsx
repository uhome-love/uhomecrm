import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Filter, Hourglass, PauseCircle, ShieldCheck } from "lucide-react";
import { BALDE_ROTULO, CADENCIA, RECUPERA_CONFIG, grupoDoBalde } from "@/lia/recupera";
import { useLiaAguardando24h, useLiaResumoRecupera } from "./useLiaRecuperaDados";
import LiaLeituraAviso from "./LiaLeituraAviso";
import LiaRecuperaSimulacao from "./LiaRecuperaSimulacao";

export default function LiaRecuperaTab() {
  const resumo = useLiaResumoRecupera();
  const recentes = useLiaAguardando24h();
  const porBalde = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of resumo.data ?? []) m.set(r.balde, (m.get(r.balde) ?? 0) + Number(r.n || 0));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [resumo.data]);
  const elegiveis = porBalde.filter(([b]) => grupoDoBalde(b) === "entra").reduce((s, [, n]) => s + n, 0);
  const espera90 = porBalde.filter(([b]) => grupoDoBalde(b) === "espera_90").reduce((s, [, n]) => s + n, 0);
  const max = Math.max(porBalde[0]?.[1] ?? 0, 1);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start gap-3 border-y border-border py-4 sm:items-center">
        <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Preparação do piloto</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Destino dos recuperados: Fila CEO, com perfil e contexto para seu repasse.</p>
        </div>
        <span className="rounded-full bg-warning/10 px-3 py-1.5 text-[11px] font-medium text-warning-700 dark:text-warning">Sem ativar envios</span>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi titulo="Base recuperável" valor={elegiveis} pendente={resumo.isLoading} erro={resumo.isError} dica="Motivos que permitem recuperação." icon={Filter} />
        <Kpi titulo="Descartados há menos de 24h" valor={recentes.data ?? 0} pendente={recentes.isLoading} erro={recentes.isError} dica="Contagem separada da base recuperável." icon={Hourglass} />
        <Kpi titulo="Espera de 90 dias" valor={espera90} pendente={resumo.isLoading} erro={resumo.isError} dica="Desistência ou condição financeira." icon={Clock} className="col-span-2 sm:col-span-1" />
      </div>
      {resumo.isError && <LiaLeituraAviso titulo="Não foi possível consultar a base recuperável." tentar={() => { void resumo.refetch(); }} />}
      {recentes.isError && <LiaLeituraAviso titulo="Não foi possível consultar os descartes das últimas 24 horas." tentar={() => { void recentes.refetch(); }} />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Motivos de descarte</h2>
          <p className="mb-4 mt-1 text-xs leading-relaxed text-muted-foreground">Mesma base atual, sem duplicados, bloqueados e clientes ativos.</p>
          {resumo.isLoading && <Skeleton className="h-48 w-full" />}
          {!resumo.isLoading && !resumo.isError && porBalde.length === 0 && <p className="border-y border-border py-8 text-sm text-muted-foreground">Nenhum descarte encontrado nesta base.</p>}
          {!resumo.isError && porBalde.map(([balde, n]) => {
            const espera = grupoDoBalde(balde) === "espera_90";
            return <div key={balde} className="border-b border-border py-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0 text-foreground">{BALDE_ROTULO[balde] ?? balde}{espera && <p className="mt-1 text-[10px] text-muted-foreground">Espera de 90 dias</p>}</div>
                <b className="shrink-0 tabular-nums text-foreground">{n.toLocaleString("pt-BR")}</b>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className={espera ? "h-full bg-warning" : "h-full bg-primary"} style={{ width: `${(n / max) * 100}%` }} /></div>
            </div>;
          })}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Resultados do piloto: leitura específica ainda indisponível.</p>
        </section>
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Parâmetros do piloto</h2>
            <Linha rotulo="Limite planejado" valor={`${RECUPERA_CONFIG.limiteDia} contatos/dia`} />
            <Linha rotulo="Horário previsto" valor={`${RECUPERA_CONFIG.dias} · ${RECUPERA_CONFIG.janela} BRT`} />
            <Linha rotulo="Espera inicial" valor={`${RECUPERA_CONFIG.esperaHoras} horas após o descarte`} />
            <Linha rotulo="Número" valor="WhatsApp da Lia" />
            <Linha rotulo="Destino" valor="Fila CEO · repasse manual" />
            <Linha rotulo="Corretor anterior" valor="Não recebe de volta" />
          </section>
          <section>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Cadência planejada</h2>
            <ol className="ml-1 border-l border-border pl-4">
              {CADENCIA.map((c) => <li key={c.dia} className="relative pb-5 last:pb-0">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                <p className="text-xs font-semibold text-foreground">{c.dia} · {c.titulo}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{c.texto}</p>
              </li>)}
            </ol>
          </section>
        </div>
      </div>
      <LiaRecuperaSimulacao />
      <footer className="flex gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
        <p>Quem pediu para sair, já comprou ou tem telefone inválido não recebe contato. Clientes ativos permanecem com seus corretores.</p>
      </footer>
    </div>
  );
}

function Kpi({ titulo, valor, dica, icon: Icon, pendente, erro, className = "" }: { titulo: string; valor: number; dica: string; icon: typeof Filter; pendente: boolean; erro: boolean; className?: string }) {
  return <div className={`min-w-0 rounded-xl border border-border bg-card p-3 sm:p-5 ${className}`}>
    <div className="flex items-start justify-between gap-2 text-[11px] text-muted-foreground sm:text-xs"><h3>{titulo}</h3><Icon className="h-4 w-4 shrink-0" /></div>
    {pendente ? <Skeleton className="my-3 h-8 w-20" /> : <p className="my-2 text-2xl font-bold tabular-nums text-foreground sm:text-3xl">{erro ? "—" : valor.toLocaleString("pt-BR")}</p>}
    <p className="text-[10px] leading-relaxed text-muted-foreground sm:text-[11px]">{erro ? "Leitura indisponível" : dica}</p>
  </div>;
}
function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="flex justify-between gap-4 border-b border-border py-3 text-xs leading-relaxed"><span className="text-muted-foreground">{rotulo}</span><b className="max-w-[60%] text-right font-medium text-foreground">{valor}</b></div>;
}
