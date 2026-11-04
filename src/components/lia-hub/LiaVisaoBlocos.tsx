import { Skeleton } from "@/components/ui/skeleton";
import type { useLiaPainelDados } from "./useLiaPainelDados";

type Dados = ReturnType<typeof useLiaPainelDados>;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const custoPor = (t: number, n: number) => (n > 0 ? brl(t / n) : "—");

function Bloco({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold text-foreground">{titulo}</h2>
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
      <div className="mt-3 space-y-1.5">{children}</div>
    </section>
  );
}
function Linha({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{v}</span>
    </div>
  );
}

export function LiaHojeCard({ kpis, loading }: { kpis: Dados["kpis"]; loading: boolean }) {
  return (
    <Bloco titulo="Hoje" dica="Movimento do dia (horário de Brasília)">
      {loading ? <Skeleton className="h-24 w-full" /> : (<>
        <Linha label="Conversas" v={kpis.conversasHojeCount} />
        <Linha label="Clientes novos" v={kpis.novosHoje} />
        <Linha label="Qualificados" v={kpis.qualificadosHoje} />
        <Linha label="Quentes" v={kpis.quentesHoje} />
        <Linha label="Apresentações agendadas" v={kpis.agendadasHoje} />
      </>)}
    </Bloco>
  );
}

export function LiaRepasseCard({ repasse }: { repasse: Dados["repasse"] }) {
  return (
    <Bloco titulo="Passagem para o corretor" dica="A Lia avisa o cliente; aqui você vê se o time assumiu">
      <Linha label="Avisados do repasse" v={repasse.avisados} />
      <Linha label="Assumidos por um corretor" v={repasse.assumidos} />
      {repasse.avisados > 0 && <Linha label="Taxa assumida" v={`${Math.round((repasse.assumidos / repasse.avisados) * 100)}%`} />}
    </Bloco>
  );
}

export function LiaDescartesCard({ descartes, loading }: { descartes: Dados["descartes"]; loading: boolean }) {
  return (
    <Bloco titulo="Descartados por motivo" dica={`${descartes.total} tirados da fila da Lia à mão`}>
      {loading ? <Skeleton className="h-24 w-full" /> : descartes.total === 0
        ? <p className="py-3 text-center text-sm text-muted-foreground">Nenhum descarte ainda.</p>
        : descartes.linhas.slice(0, 6).map(([m, n]) => <Linha key={m} label={m} v={n} />)}
    </Bloco>
  );
}

export function LiaCustoCard({ custo, loading, funil }: { custo: Dados["custo"]; loading: boolean; funil: Dados["funil"] }) {
  return (
    <Bloco titulo="Investimento e custo" dica="Gasto real dos anúncios que trouxeram clientes para a Lia">
      {loading ? <Skeleton className="h-14 w-full" /> : !custo?.ok ? (
        <p className="text-sm text-muted-foreground">
          {custo?.motivo === "sem_token" ? "Meta Ads ainda não conectado nas configurações." : "Não foi possível carregar o investimento agora."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[["Investimento", brl(custo.investimento)], ["Custo por contato", custoPor(custo.investimento, funil.falaram)],
            ["Custo por qualificado", custoPor(custo.investimento, funil.qualificados)],
            ["Custo por apresentação", custoPor(custo.investimento, funil.agendaram)]].map(([l, v]) => (
            <div key={l} className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="text-lg font-bold tabular-nums text-foreground">{v}</p>
            </div>
          ))}
        </div>
      )}
    </Bloco>
  );
}
