import { useMemo } from "react";
import { fmtMoney } from "@/lib/fmtMoney";
import { somarMetricas, type MetricaCorretor } from "@/lib/metricasSSOT";
import PerfKpiCard from "./PerfKpiCard";
import PerfEvolucao from "./PerfEvolucao";
import PerfTopCorretores from "./PerfTopCorretores";
import type { PontoEvolucao } from "@/hooks/useEvolucaoSSOT";

interface Props {
  linhas: MetricaCorretor[];
  loading?: boolean;
  pontos: PontoEvolucao[];
  evolucaoLoading?: boolean;
  meses: number;
  onMesesChange: (n: number) => void;
  onVerRanking: () => void;
}

export default function PerfVisaoGeral({ linhas, loading, pontos, evolucaoLoading, meses, onMesesChange, onVerRanking }: Props) {
  const t = useMemo(() => somarMetricas(linhas), [linhas]);

  const anterior = pontos.length > 1 ? pontos[pontos.length - 2] : null;
  const deltaVgv = anterior && anterior.vgv > 0 ? ((t.vgv_assinado - anterior.vgv) / anterior.vgv) * 100 : null;

  const convVisita = t.leads_recebidos > 0 ? (t.visitas_realizadas / t.leads_recebidos) * 100 : 0;
  const convVenda = t.visitas_realizadas > 0 ? (t.vendas / t.visitas_realizadas) * 100 : 0;
  const maxVgv = Math.max(1, ...pontos.map((p) => p.vgv));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PerfKpiCard
          label="VGV assinado"
          value={fmtMoney(t.vgv_assinado, "short")}
          hint={deltaVgv !== null ? `${deltaVgv >= 0 ? "+" : ""}${deltaVgv.toFixed(1)}%` : undefined}
          hintTone={deltaVgv !== null && deltaVgv >= 0 ? "success" : "muted"}
          progress={(t.vgv_assinado / maxVgv) * 100}
          loading={loading}
        />
        <PerfKpiCard
          label="Vendas"
          value={String(t.vendas)}
          hint={t.vendas > 0 ? `ticket ${fmtMoney(t.vgv_assinado / t.vendas, "short")}` : undefined}
          progress={Math.min(100, t.vendas * 10)}
          barClass="bg-success"
          loading={loading}
        />
        <PerfKpiCard
          label="Visitas realizadas"
          value={String(t.visitas_realizadas)}
          hint={`no-show ${t.visitas_realizadas + t.visitas_no_show > 0 ? ((t.visitas_no_show / (t.visitas_realizadas + t.visitas_no_show)) * 100).toFixed(0) : 0}%`}
          progress={t.visitas_marcadas > 0 ? (t.visitas_realizadas / t.visitas_marcadas) * 100 : 0}
          loading={loading}
        />
        <PerfKpiCard
          label="Leads recebidos"
          value={t.leads_recebidos.toLocaleString("pt-BR")}
          hint={`${t.corretores} corretores`}
          progress={Math.min(100, convVisita * 5)}
          loading={loading}
        />
      </div>

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
