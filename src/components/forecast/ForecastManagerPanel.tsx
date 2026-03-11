import { useForecast } from "@/hooks/useForecast";
import ForecastCards from "./ForecastCards";
import IaCoreAction from "@/components/IaCoreAction";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { formatBRLCompact } from "@/lib/utils";

export default function ForecastManagerPanel() {
  const { gerentes, loading, reload } = useForecast();
  const g = gerentes[0]; // manager sees own team

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando previsão...</div>;
  if (!g) return <div className="text-center py-12 text-muted-foreground">Sem dados de checkpoint/funil para gerar previsão.</div>;

  const gap = g.meta_vendas > 0 ? g.meta_vendas - g.vendas_previstas : 0;

  const contextData = {
    gerente: g.gerente_nome,
    visitas_realizadas: g.visitas_realizadas,
    propostas_reais: g.propostas_reais,
    propostas_estimadas: g.propostas_estimadas,
    vendas_reais: g.vendas_reais,
    vendas_previstas: g.vendas_previstas,
    vgv_previsto: g.vgv_previsto,
    conv_visita_proposta: `${(g.conv_visita_proposta * 100).toFixed(0)}%`,
    conv_proposta_venda: `${(g.conv_proposta_venda * 100).toFixed(0)}%`,
    ticket_medio: g.ticket_medio,
    meta_vendas: g.meta_vendas,
    meta_vgv: g.meta_vgv,
    gap_vendas: gap > 0 ? gap : 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Previsão de Vendas <span className="text-primary">Forecast IA</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Equipe {g.gerente_nome} — Projeção do mês atual</p>
      </div>

      <ForecastCards
        visitas={g.visitas_realizadas}
        propostas={g.propostas_estimadas}
        vendas={g.vendas_previstas}
        vgv={g.vgv_previsto}
      />

      {/* Conversion rates */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Conv. Visita → Proposta</p>
          <p className="text-lg font-bold text-foreground">{(g.conv_visita_proposta * 100).toFixed(0)}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Conv. Proposta → Venda</p>
          <p className="text-lg font-bold text-foreground">{(g.conv_proposta_venda * 100).toFixed(0)}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Ticket Médio</p>
          <p className="text-lg font-bold text-foreground">
            {formatBRLCompact(g.ticket_medio)}
          </p>
        </div>
      </div>

      {/* Alert if below target */}
      {gap > 0 && g.meta_vendas > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border bg-destructive/5 border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-foreground">⚠️ Alerta: Previsão abaixo da meta</p>
            <p className="text-xs text-muted-foreground mt-1">
              Previsão atual: <strong>{g.vendas_previstas} vendas</strong> · Meta: <strong>{g.meta_vendas} vendas</strong> · Gap: <strong>{gap} vendas</strong>
            </p>
          </div>
        </div>
      )}

      {/* IA Analysis */}
      <div className="flex flex-wrap gap-2">
        <IaCoreAction
          module="funil"
          prompt={`Gere um DIAGNÓSTICO completo da previsão de vendas da equipe com base nos dados abaixo. Inclua: 1) Situação atual 2) O que está funcionando 3) Gargalo do funil 4) O que fazer agora. Dados: ${JSON.stringify(contextData)}`}
          context={contextData}
          label="Gerar Diagnóstico IA"
          variant="default"
        />
        <IaCoreAction
          module="funil"
          prompt={`Gere um PLANO DE AÇÃO detalhado para aumentar as vendas previstas da equipe. Considere os dados atuais e sugira ações específicas para cada gargalo. Dados: ${JSON.stringify(contextData)}`}
          context={contextData}
          label="Gerar Plano de Ação"
        />
      </div>
    </div>
  );
}
