import { useMemo } from "react";
import { fmtMoney } from "@/lib/fmtMoney";
import { somarMetricas, type MetricaCorretor } from "@/lib/metricasSSOT";
import PerfKpiCard from "./PerfKpiCard";
import PerfMetaCard from "./PerfMetaCard";
import PerfEvolucao from "./PerfEvolucao";
import PerfTopCorretores from "./PerfTopCorretores";
import type { PontoEvolucao } from "@/hooks/useEvolucaoSSOT";
import type { MetasMes, PaceMes } from "@/hooks/useMetasSSOT";
import type { DetalheTipo } from "@/hooks/useMetricasDetalhe";

interface Props {
  linhas: MetricaCorretor[];
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
}

export default function PerfVisaoGeral({
  linhas,
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
}: Props) {
  const t = useMemo(() => somarMetricas(linhas), [linhas]);

  const anterior = pontos.length > 1 ? pontos[pontos.length - 2] : null;
  const deltaVgv = anterior && anterior.vgv > 0 ? ((t.vgv_assinado - anterior.vgv) / anterior.vgv) * 100 : null;

  const convVisita = t.leads_recebidos > 0 ? (t.visitas_realizadas / t.leads_recebidos) * 100 : 0;
  const convVenda = t.visitas_realizadas > 0 ? (t.vendas / t.visitas_realizadas) * 100 : 0;

  /** progresso real contra meta (0-100). Sem meta cadastrada → barra vazia + hint explícito. */
  const pctMeta = (real: number, meta?: number) => (meta && meta > 0 ? (real / meta) * 100 : 0);
  const hintMeta = (real: number, meta?: number, fmt: (n: number) => string = String) =>
    meta && meta > 0 ? `${((real / meta) * 100).toFixed(0)}% de ${fmt(meta)}` : "sem meta";

  const noShowPct = t.visitas_realizadas + t.visitas_no_show > 0
    ? (t.visitas_no_show / (t.visitas_realizadas + t.visitas_no_show)) * 100
    : 0;

  return (
    <div className="space-y-6">
      <PerfMetaCard realizado={t.vgv_assinado} metas={metas} pace={pace} loading={loading || metasLoading} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PerfKpiCard
          label="VGV assinado"
          value={fmtMoney(t.vgv_assinado, "short")}
          hint={deltaVgv !== null ? `${deltaVgv >= 0 ? "+" : ""}${deltaVgv.toFixed(1)}% vs mês anterior` : undefined}
          hintTone={deltaVgv !== null && deltaVgv >= 0 ? "success" : "muted"}
          progress={pctMeta(t.vgv_assinado, metas?.meta_vgv)}
          loading={loading}
          onClick={onDrilldown ? () => onDrilldown("vgv") : undefined}
        />
        <PerfKpiCard
          label="Vendas"
          value={String(t.vendas)}
          hint={
            metas?.meta_vendas
              ? hintMeta(t.vendas, metas.meta_vendas)
              : t.vendas > 0
                ? `ticket ${fmtMoney(t.vgv_assinado / t.vendas, "short")}`
                : undefined
          }
          progress={pctMeta(t.vendas, metas?.meta_vendas)}
          barClass="bg-success"
          loading={loading}
          onClick={onDrilldown ? () => onDrilldown("vendas") : undefined}
        />
        <PerfKpiCard
          label="Visitas realizadas"
          value={String(t.visitas_realizadas)}
          hint={hintMeta(t.visitas_realizadas, metas?.meta_visitas_realizadas)}
          progress={pctMeta(t.visitas_realizadas, metas?.meta_visitas_realizadas)}
          loading={loading}
          onClick={onDrilldown ? () => onDrilldown("visitas_realizadas") : undefined}
        />
        <PerfKpiCard
          label="Leads recebidos"
          value={t.leads_recebidos.toLocaleString("pt-BR")}
          hint={hintMeta(t.leads_recebidos, metas?.meta_leads, (n) => n.toLocaleString("pt-BR"))}
          progress={pctMeta(t.leads_recebidos, metas?.meta_leads)}
          loading={loading}
          onClick={onDrilldown ? () => onDrilldown("leads") : undefined}
        />
      </div>

      {noShowPct > 0 && (
        <button
          type="button"
          onClick={() => onDrilldown?.("visitas_no_show")}
          className="w-full text-left bg-card border border-border rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-3 transition-colors hover:border-primary/30"
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Maior vazamento do período</span>
            <p className="text-sm text-foreground mt-1">
              <strong className="tabular-nums">{t.visitas_no_show}</strong> no-shows em{" "}
              <strong className="tabular-nums">{t.visitas_marcadas}</strong> visitas marcadas
            </p>
          </div>
          <span
            className={`text-2xl font-bold tabular-nums ${noShowPct >= 30 ? "text-destructive" : "text-foreground"}`}
          >
            {noShowPct.toFixed(0)}%
          </span>
        </button>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PerfEvolucao pontos={pontos} loading={evolucaoLoading} meses={meses} onMesesChange={onMesesChange} />

          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-bold text-foreground mb-5">Funil de conversão</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm text-muted-foreground">Lead → visita realizada</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">{convVisita.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.min(100, convVisita * 4)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm text-muted-foreground">Visita → venda</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">{convVenda.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full transition-all duration-500" style={{ width: `${Math.min(100, convVenda * 8)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <PerfTopCorretores linhas={linhas} totalCorretores={t.corretores} loading={loading} onVerTudo={onVerRanking} />
      </div>
    </div>
  );
}
