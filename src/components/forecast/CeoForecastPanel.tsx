import { useMemo } from "react";
import { useForecast } from "@/hooks/useForecast";
import ForecastCards from "./ForecastCards";
import IaCoreAction from "@/components/IaCoreAction";
import { AlertTriangle, TrendingUp, Crown, BarChart3, Info } from "lucide-react";

import { formatBRLCompact } from "@/lib/utils";
const fmtCurrency = formatBRLCompact;

export default function CeoForecastPanel() {
  const { gerentes, consolidado, loading } = useForecast();

  // Scenarios
  const scenarios = useMemo(() => {
    if (gerentes.length === 0) return null;
    const c = consolidado;
    const conservador = {
      vendas: Math.max(0, Math.round(c.vendas_previstas * 0.7)),
      vgv: c.vgv_previsto * 0.7,
    };
    const provavel = {
      vendas: c.vendas_previstas,
      vgv: c.vgv_previsto,
    };
    const otimista = {
      vendas: Math.round(c.vendas_previstas * 1.3),
      vgv: c.vgv_previsto * 1.3,
    };
    return { conservador, provavel, otimista };
  }, [gerentes, consolidado]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando previsão consolidada...</div>;
  if (gerentes.length === 0) return <div className="text-center py-12 text-muted-foreground">Sem dados para gerar previsão.</div>;

  const gap = consolidado.meta_vendas > 0 ? consolidado.meta_vendas - consolidado.vendas_previstas : 0;

  const contextData = {
    consolidado,
    ranking: gerentes.map(g => ({
      gerente: g.gerente_nome,
      vendas_previstas: g.vendas_previstas,
      vgv_previsto: g.vgv_previsto,
      visitas: g.visitas_realizadas,
      conv_vp: `${(g.conv_visita_proposta * 100).toFixed(0)}%`,
      conv_pv: `${(g.conv_proposta_venda * 100).toFixed(0)}%`,
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          Previsão Consolidada do Mês
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Projeção de vendas e VGV de toda a empresa</p>
      </div>

      <ForecastCards
        visitas={consolidado.visitas_realizadas}
        propostas={consolidado.propostas_estimadas}
        vendas={consolidado.vendas_previstas}
        vgv={consolidado.vgv_previsto}
      />

      {/* ═══ CENÁRIOS ═══ */}
      {scenarios && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] px-2 py-0.5 rounded bg-destructive/10 text-destructive font-semibold">CONSERVADOR</span>
            </div>
            <p className="text-xs text-muted-foreground">Vendas previstas</p>
            <p className="text-xl font-display font-bold text-foreground">{scenarios.conservador.vendas}</p>
            <p className="text-xs text-muted-foreground mt-1">VGV previsto</p>
            <p className="text-sm font-bold text-foreground">{fmtCurrency(scenarios.conservador.vgv)}</p>
          </div>
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">PROVÁVEL</span>
            </div>
            <p className="text-xs text-muted-foreground">Vendas previstas</p>
            <p className="text-xl font-display font-bold text-foreground">{scenarios.provavel.vendas}</p>
            <p className="text-[10px] text-muted-foreground">Faixa: {scenarios.conservador.vendas} a {scenarios.otimista.vendas}</p>
            <p className="text-xs text-muted-foreground mt-1">VGV previsto</p>
            <p className="text-sm font-bold text-foreground">{fmtCurrency(scenarios.provavel.vgv)}</p>
            <p className="text-[10px] text-muted-foreground">Faixa: {fmtCurrency(scenarios.conservador.vgv)} a {fmtCurrency(scenarios.otimista.vgv)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] px-2 py-0.5 rounded bg-success/10 text-success font-semibold">OTIMISTA</span>
            </div>
            <p className="text-xs text-muted-foreground">Vendas previstas</p>
            <p className="text-xl font-display font-bold text-foreground">{scenarios.otimista.vendas}</p>
            <p className="text-xs text-muted-foreground mt-1">VGV previsto</p>
            <p className="text-sm font-bold text-foreground">{fmtCurrency(scenarios.otimista.vgv)}</p>
          </div>
        </div>
      )}

      {/* Alert */}
      {gap > 0 && consolidado.meta_vendas > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border bg-destructive/5 border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-foreground">⚠️ Previsão abaixo da meta mensal</p>
            <p className="text-xs text-muted-foreground mt-1">
              Previsão: <strong>{consolidado.vendas_previstas} vendas</strong> · Meta: <strong>{consolidado.meta_vendas}</strong> · Gap: <strong>{gap} vendas</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              VGV previsto: <strong>{fmtCurrency(consolidado.vgv_previsto)}</strong> · Meta VGV: <strong>{fmtCurrency(consolidado.meta_vgv)}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Metodologia */}
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-xs font-semibold text-muted-foreground">Metodologia do Cálculo</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px] text-muted-foreground">
          <div>
            <p className="font-medium">Visitas Realizadas</p>
            <p>Dados dos checkpoints do mês</p>
          </div>
          <div>
            <p className="font-medium">Propostas Estimadas</p>
            <p>Visitas × Taxa histórica V→P ({gerentes.length > 0 ? `${(gerentes[0].conv_visita_proposta * 100).toFixed(0)}%` : "22%"})</p>
          </div>
          <div>
            <p className="font-medium">Vendas Previstas</p>
            <p>Propostas × Taxa histórica P→V ({gerentes.length > 0 ? `${(gerentes[0].conv_proposta_venda * 100).toFixed(0)}%` : "33%"})</p>
          </div>
          <div>
            <p className="font-medium">Cenários</p>
            <p>Conservador: -30% · Otimista: +30%</p>
          </div>
        </div>
      </div>

      {/* Ranking por Gerente */}
      <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Ranking por Gerente — Previsão
          </h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-3 py-2 font-display font-semibold">Gerente</th>
              <th className="px-2 py-2 text-center">Visitas</th>
              <th className="px-2 py-2 text-center">Prop. Est.</th>
              <th className="px-2 py-2 text-center">Vendas Prev.</th>
              <th className="px-2 py-2 text-center">VGV Previsto</th>
              <th className="px-2 py-2 text-center">Conv. V→P</th>
              <th className="px-2 py-2 text-center">Conv. P→V</th>
            </tr>
          </thead>
          <tbody>
            {gerentes.map((g, i) => (
              <tr key={g.gerente_id} className="border-b border-border hover:bg-muted/10">
                <td className="px-3 py-2 font-medium">
                  {i === 0 && "🥇 "}{i === 1 && "🥈 "}{i === 2 && "🥉 "}
                  {g.gerente_nome}
                </td>
                <td className="px-2 py-2 text-center">{g.visitas_realizadas}</td>
                <td className="px-2 py-2 text-center">{g.propostas_estimadas}</td>
                <td className="px-2 py-2 text-center font-bold">{g.vendas_previstas}</td>
                <td className="px-2 py-2 text-center font-bold">{fmtCurrency(g.vgv_previsto)}</td>
                <td className="px-2 py-2 text-center">{(g.conv_visita_proposta * 100).toFixed(0)}%</td>
                <td className="px-2 py-2 text-center">{(g.conv_proposta_venda * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* IA Actions */}
      <div className="flex flex-wrap gap-2">
        <IaCoreAction
          module="ceo"
          prompt={`Como CEO, gere um DIAGNÓSTICO EXECUTIVO da previsão de vendas consolidada. Inclua: 1) Resumo macro 2) Ranking dos gerentes 3) Gargalos por gerente 4) Decisões recomendadas (5-8 ações) 5) Plano de alinhamento. Dados: ${JSON.stringify(contextData)}`}
          context={contextData}
          label="Gerar Diagnóstico CEO"
          variant="default"
        />
        <IaCoreAction
          module="ceo"
          prompt={`Gere um PLANO DE AÇÃO ESTRATÉGICO para aumentar as vendas previstas da empresa. Considere cada gerente individualmente e sugira onde treinar, onde cobrar, onde mudar rotina e onde priorizar produto. Dados: ${JSON.stringify(contextData)}`}
          context={contextData}
          label="Gerar Plano Estratégico"
        />
      </div>
    </div>
  );
}
