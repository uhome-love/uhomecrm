import type { UseQueryResult } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney } from "@/lib/fmtMoney";
import { delta } from "@/lib/perfPeriodo";
import { presencaPct, somarFunil, type FunilLinha } from "@/hooks/useFunilPerformance";
import { FunilVisitas } from "@/components/central-v2/shared/FunilVisitas";
import { AlertTriangle } from "lucide-react";

function Delta({ v }: { v: number | null }) {
  if (v === null || !Number.isFinite(v)) return null;
  const zero = Math.round(v) === 0;
  return (
    <span
      className={
        zero ? "text-muted-foreground text-[10px] font-semibold" : v > 0 ? "text-success-500 text-[10px] font-semibold" : "text-danger-500 text-[10px] font-semibold"
      }
      title="vs. período anterior"
    >
      {zero ? "→" : v > 0 ? "▲" : "▼"} {Math.abs(Math.round(v))}%
    </span>
  );
}



interface Props {
  linhas: FunilLinha[];
  linhasAnterior: FunilLinha[];
  loading: boolean;
  prevLabel: string;
  /** Funil de 6 etapas (get_relatorio_funil) — coorte × período + visitas. */
  funilQuery: UseQueryResult<Record<string, unknown>>;
}

/** Tela inicial de KPIs — funil de etapas + visitas + sinais de atenção. */
export default function PerfHome({ linhas, linhasAnterior, loading, prevLabel, funilQuery }: Props) {
  const t = somarFunil(linhas);
  const p = somarFunil(linhasAnterior);
  const diasBase = t.dias_uteis_decorridos || t.dias_uteis;

  const kpis = [
    {
      label: "Presença",
      value: `${Math.round(presencaPct(t))}%`,
      sub: `${t.presenca_dias} presenças · ${diasBase} dias úteis · ${t.corretores_ativos} ativos`,
      d: delta(presencaPct(t), presencaPct(p)),
      ajuda: "Dias em que os corretores estiveram na empresa, dividido pelos dias úteis já decorridos do período vezes o número de corretores ativos. Mesma fonte da página Presença.",
    },
    { label: "Leads recebidos", value: t.leads_recebidos.toLocaleString("pt-BR"), d: delta(t.leads_recebidos, p.leads_recebidos), ajuda: "Leads que entraram para os corretores dentro do período." },
    { label: "Visitas totais", value: t.visitas_total.toLocaleString("pt-BR"), d: delta(t.visitas_total, p.visitas_total), ajuda: "Toda visita que existiu no período — agendada nele ou realizada nele, sem duplicar. Nunca menor que as realizadas." },
    { label: "Visitas realizadas", value: t.visitas_realizadas.toLocaleString("pt-BR"), d: delta(t.visitas_realizadas, p.visitas_realizadas), ajuda: "Visitas que aconteceram dentro do período." },
    { label: "Negócios abertos", value: t.negocios_abertos.toLocaleString("pt-BR"), d: delta(t.negocios_abertos, p.negocios_abertos), ajuda: "Negócios criados dentro do período." },
    { label: "VGV gerado", value: fmtMoney(t.vgv_gerado, "short"), d: delta(t.vgv_gerado, p.vgv_gerado), ajuda: "Valor dos negócios ativos agora — em negociação e em contrato — excluindo os que caíram." },
    { label: "VGV assinado", value: fmtMoney(t.vgv_assinado, "short"), d: delta(t.vgv_assinado, p.vgv_assinado), ajuda: "Vendas com contrato assinado no período, com rateio 50/50 em parcerias." },
  ];

  const semVisita = linhas.filter((l) => l.corretor_ativo && l.visitas_realizadas === 0).length;
  const vgvZero = linhas.filter((l) => l.corretor_ativo && l.vgv_assinado === 0).length;
  const descarteAlto = linhas.filter((l) => l.leads_recebidos >= 5 && l.descartes / Math.max(l.leads_recebidos, 1) > 0.6).length;
  const presencaBaixa = linhas.filter(
    (l) => l.corretor_ativo && (l.dias_uteis_decorridos || l.dias_uteis) > 0 && l.presenca_dias / (l.dias_uteis_decorridos || l.dias_uteis) < 0.6
  ).length;

  const alertas = [
    { txt: `${semVisita} sem visita realizada`, on: semVisita > 0 },
    { txt: `${descarteAlto} com descarte acima de 60%`, on: descarteAlto > 0 },
    { txt: `${vgvZero} com VGV zerado`, on: vgvZero > 0 },
    { txt: `${presencaBaixa} com presença abaixo de 60%`, on: presencaBaixa > 0 },
  ].filter((a) => a.on);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[86px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
        {kpis.map((k) => (
          <StatCard
            key={k.label}
            label={k.label}
            title={k.ajuda}
            value={k.value}

            tone={k.label === "VGV assinado" ? "primary" : "neutral"}
            sub={
              <span className="inline-flex items-center gap-1.5">
                <Delta v={k.d} />
                {k.sub && <span className="text-muted-foreground/70 truncate">{k.sub}</span>}
              </span>
            }
            className="p-3.5 rounded-xl"
          />
        ))}
      </div>


      {/* Funil de 6 etapas + Visitas (coorte × período) */}
      <FunilVisitas query={funilQuery} />

      {/* Sinais de atenção */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning-500" /> Sinais de atenção
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {alertas.length === 0 && <p className="text-xs text-muted-foreground">Nenhum sinal de alerta no período.</p>}
          {alertas.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {alertas.map((a) => (
                <div key={a.txt} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">
                  {a.txt}
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
            <StatCard label="Pipeline ativo (agora)" value={t.pipeline_ativo.toLocaleString("pt-BR")} className="p-3 rounded-xl" />
            <StatCard label="Descartes no período" value={t.descartes.toLocaleString("pt-BR")} tone="warning" className="p-3 rounded-xl" />
          </div>
          <p className="text-[10.5px] text-muted-foreground mt-1">Comparativo vs. {prevLabel}.</p>
        </CardContent>
      </Card>
    </div>
  );
}
