import { useMemo } from "react";
import { fmtMoney } from "@/lib/fmtMoney";
import { somarMetricas, type MetricaCorretor } from "@/lib/metricasSSOT";
import { delta, fmtDelta } from "@/lib/perfPeriodo";
import PerfKpiCard from "./PerfKpiCard";
import PerfMetaCard from "./PerfMetaCard";
import PerfEvolucao from "./PerfEvolucao";
import PerfTopCorretores from "./PerfTopCorretores";
import type { PontoEvolucao } from "@/hooks/useEvolucaoSSOT";
import type { MetasMes, PaceMes } from "@/hooks/useMetasSSOT";
import type { DetalheTipo } from "@/hooks/useMetricasDetalhe";

interface Props {
  linhas: MetricaCorretor[];
  linhasAnterior?: MetricaCorretor[];
  prevLabel?: string;
  loading?: boolean;
  pontos: PontoEvolucao[];
  evolucaoLoading?: boolean;
  meses: number;
  onMesesChange: (n: number) => void;
  onVerRanking: () => void;
  metas?: MetasMes;
  pace?: PaceMes;
  metasLoading?: boolean;
  onDrilldown?: (tipo: DetalheTipo) => void;
  mostrarRanking?: boolean;
}

export default function PerfVisaoGeral({
  linhas,
  linhasAnterior = [],
  prevLabel = "período anterior",
  loading,
  pontos,
  evolucaoLoading,
  meses,
  onMesesChange,
  onVerRanking,
  metas,
  pace,
  metasLoading,
  onDrilldown,
  mostrarRanking = true,
}: Props) {
  const t = useMemo(() => somarMetricas(linhas), [linhas]);
  const ant = useMemo(() => somarMetricas(linhasAnterior), [linhasAnterior]);

  const dVgv = delta(t.vgv_assinado, ant.vgv_assinado);
  const dVendas = delta(t.vendas, ant.vendas);
  const dVisitas = delta(t.visitas_realizadas, ant.visitas_realizadas);
  const dLeads = delta(t.leads_recebidos, ant.leads_recebidos);

  /** progresso real contra meta (0-100). Sem meta cadastrada → barra vazia + hint explícito. */
  const pctMeta = (real: number, meta?: number) => (meta && meta > 0 ? (real / meta) * 100 : 0);
  const hintMeta = (real: number, meta?: number, fmt: (n: number) => string = String) =>
    meta && meta > 0 ? `${((real / meta) * 100).toFixed(0)}% de ${fmt(meta)}` : undefined;

  /** hint = meta quando existe; senão comparativo com o período anterior */
  const hint = (metaHint: string | undefined, d: number | null) => metaHint ?? fmtDelta(d, prevLabel) ?? "sem meta";
  const tone = (metaHint: string | undefined, d: number | null): "success" | "muted" =>
    !metaHint && d !== null && d >= 0 ? "success" : "muted";

  const noShowPct =
    t.visitas_realizadas + t.visitas_no_show > 0
      ? (t.visitas_no_show / (t.visitas_realizadas + t.visitas_no_show)) * 100
      : 0;

  /** funil com larguras proporcionais reais (base = leads, ou maior etapa quando não há leads) */
  const etapas = useMemo(() => {
    const base = Math.max(t.leads_recebidos, t.visitas_agendadas, t.visitas_realizadas, t.vendas, 1);
    const passos = [
      { label: "Leads recebidos", valor: t.leads_recebidos, cor: "bg-primary/40" },
      { label: "Visitas agendadas", valor: t.visitas_agendadas, cor: "bg-primary/60" },
      { label: "Visitas realizadas", valor: t.visitas_realizadas, cor: "bg-primary" },
      { label: "Vendas", valor: t.vendas, cor: "bg-success" },
    ];
    return passos.map((p, i) => {
      const anterior = i === 0 ? null : passos[i - 1].valor;
      return {
        ...p,
        largura: (p.valor / base) * 100,
        conversao: anterior && anterior > 0 ? (p.valor / anterior) * 100 : null,
      };
    });
  }, [t]);

  const metaHintVgv = hintMeta(t.vgv_assinado, metas?.meta_vgv, (n) => fmtMoney(n, "short"));
  const metaHintVendas = hintMeta(t.vendas, metas?.meta_vendas);
  const metaHintVisitas = hintMeta(t.visitas_realizadas, metas?.meta_visitas_realizadas);
  const metaHintLeads = hintMeta(t.leads_recebidos, metas?.meta_leads, (n) => n.toLocaleString("pt-BR"));

  return (
    <div className="space-y-6">
      <PerfMetaCard realizado={t.vgv_assinado} metas={metas} pace={pace} loading={loading || metasLoading} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <PerfKpiCard
          label="VGV assinado"
          value={fmtMoney(t.vgv_assinado, "short")}
          hint={hint(metaHintVgv, dVgv)}
          hintTone={tone(metaHintVgv, dVgv)}
          progress={pctMeta(t.vgv_assinado, metas?.meta_vgv)}
          loading={loading}
          onClick={onDrilldown ? () => onDrilldown("vgv") : undefined}
        />
        <PerfKpiCard
          label="Vendas"
          value={String(t.vendas)}
          hint={hint(metaHintVendas, dVendas)}
          hintTone={tone(metaHintVendas, dVendas)}
          progress={pctMeta(t.vendas, metas?.meta_vendas)}
          barClass="bg-success"
          loading={loading}
          onClick={onDrilldown ? () => onDrilldown("vendas") : undefined}
        />
        <PerfKpiCard
          label="Visitas realizadas"
          value={String(t.visitas_realizadas)}
          hint={hint(metaHintVisitas, dVisitas)}
          hintTone={tone(metaHintVisitas, dVisitas)}
          progress={pctMeta(t.visitas_realizadas, metas?.meta_visitas_realizadas)}
          loading={loading}
          onClick={onDrilldown ? () => onDrilldown("visitas_realizadas") : undefined}
        />
        <PerfKpiCard
          label="Leads recebidos"
          value={t.leads_recebidos.toLocaleString("pt-BR")}
          hint={hint(metaHintLeads, dLeads)}
          hintTone={tone(metaHintLeads, dLeads)}
          progress={pctMeta(t.leads_recebidos, metas?.meta_leads)}
          loading={loading}
          onClick={onDrilldown ? () => onDrilldown("leads") : undefined}
        />
      </div>

      {noShowPct > 0 && (
        <button
          type="button"
          onClick={() => onDrilldown?.("visitas_no_show")}
          className="w-full text-left bg-card border border-border rounded-xl px-5 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 transition-colors hover:border-primary/30"
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Maior vazamento do período</span>
            <p className="text-sm text-foreground mt-1">
              <strong className="tabular-nums">{t.visitas_no_show}</strong> no-shows em{" "}
              <strong className="tabular-nums">{t.visitas_agendadas}</strong> visitas agendadas
            </p>
          </div>
          <span className={`text-2xl font-bold tabular-nums ${noShowPct >= 30 ? "text-destructive" : "text-foreground"}`}>
            {noShowPct.toFixed(0)}%
          </span>
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={mostrarRanking ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"}>
          <PerfEvolucao pontos={pontos} loading={evolucaoLoading} meses={meses} onMesesChange={onMesesChange} />

          <div className="bg-card border border-border rounded-xl p-5 md:p-6">
            <h3 className="font-bold text-foreground mb-1">Funil de conversão</h3>
            <p className="text-xs text-muted-foreground mb-5">Barras proporcionais ao volume real de cada etapa</p>
            <div className="space-y-4">
              {etapas.map((e) => (
                <div key={e.label}>
                  <div className="flex justify-between items-end mb-1.5 gap-3">
                    <span className="text-sm text-muted-foreground">{e.label}</span>
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {e.valor.toLocaleString("pt-BR")}
                      {e.conversao !== null && (
                        <span className="ml-2 text-xs font-medium text-muted-foreground">{e.conversao.toFixed(1)}%</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${e.cor}`}
                      style={{ width: `${Math.max(e.valor > 0 ? 2 : 0, Math.min(100, e.largura))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {mostrarRanking && (
          <PerfTopCorretores linhas={linhas} totalCorretores={t.corretores} loading={loading} onVerTudo={onVerRanking} />
        )}
      </div>
    </div>
  );
}
